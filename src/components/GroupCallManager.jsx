import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Helper component to render each participant's video/audio stream
function RemoteParticipantTile({ peerObj, callType }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && peerObj.stream) {
      videoRef.current.srcObject = peerObj.stream;
    }
  }, [peerObj.stream]);

  return (
    <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/15 h-48 sm:h-56 flex items-center justify-center shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={callType === 'video' ? 'w-full h-full object-cover' : 'hidden'}
      />
      {callType === 'audio' && (
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center text-2xl animate-pulse">
          🎧
        </div>
      )}
      <span className="absolute bottom-2.5 left-3 bg-black/70 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white">
        {peerObj.user?.name || 'Member'}
      </span>
    </div>
  );
}

export default function GroupCallManager({ socket, currentUser, currentRoom, inActiveRoom }) {
  const [inGroupCall, setInGroupCall] = useState(false);
  const [callType, setCallType] = useState('video');
  const [incomingGroupAlert, setIncomingGroupAlert] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]); // Array of { socketId, user, stream }
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersMapRef = useRef({}); // { socketId: RTCPeerConnection }
  const inGroupCallRef = useRef(false);

  const getSafeMediaStream = async (type) => {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
    } catch (e) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      } catch (err) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx.createMediaStreamDestination().stream;
      }
    }
  };

  const createPeerForMember = (targetSocketId, targetUser, isInitiator) => {
    const stunHost = ['stun', 'l', 'google', 'com'].join('.');
    const peer = new RTCPeerConnection({ iceServers: [{ urls: `stun:${stunHost}:19302` }] });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current);
      });
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('groupCallIce', { toSocketId: targetSocketId, candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      const remoteStream = event.streams && event.streams;
      if (!remoteStream) return;
      setRemotePeers((prev) => {
        const exists = prev.find((p) => p.socketId === targetSocketId);
        if (exists) {
          return prev.map((p) => (p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p));
        }
        return [...prev, { socketId: targetSocketId, user: targetUser, stream: remoteStream }];
      });
    };

    peersMapRef.current[targetSocketId] = peer;
    return peer;
  };
  useEffect(() => {
    if (!socket) return;

    const handleGroupCallStarted = ({ roomID, starterName, callType: incomingType }) => {
      if (roomID === currentRoom && !inGroupCallRef.current) {
        setIncomingGroupAlert({ starterName, callType: incomingType });
      }
    };

    const handleUserJoined = async ({ socketId, user }) => {
      if (!inGroupCallRef.current) return;
      const peer = createPeerForMember(socketId, user, true);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('groupCallSignal', {
        toSocketId: socketId,
        signal: offer,
        fromUser: currentUser
      });
    };

    const handleReceiveSignal = async ({ fromSocketId, signal, fromUser }) => {
      if (!inGroupCallRef.current) return;
      let peer = peersMapRef.current[fromSocketId];
      if (!peer) {
        peer = createPeerForMember(fromSocketId, fromUser, false);
      }
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      if (signal.type === 'offer') {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('groupCallSignal', {
          toSocketId: fromSocketId,
          signal: answer,
          fromUser: currentUser
        });
      }
    };

    const handleReceiveIce = async ({ fromSocketId, candidate }) => {
      const peer = peersMapRef.current[fromSocketId];
      if (peer && candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Group ICE Error:', e);
        }
      }
    };

    const handleUserLeft = ({ socketId }) => {
      if (peersMapRef.current[socketId]) {
        peersMapRef.current[socketId].close();
        delete peersMapRef.current[socketId];
      }
      setRemotePeers((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    socket.on('groupCallStarted', handleGroupCallStarted);
    socket.on('userJoinedGroupCall', handleUserJoined);
    socket.on('groupCallSignal', handleReceiveSignal);
    socket.on('groupCallIce', handleReceiveIce);
    socket.on('userLeftGroupCall', handleUserLeft);

    return () => {
      socket.off('groupCallStarted', handleGroupCallStarted);
      socket.off('userJoinedGroupCall', handleUserJoined);
      socket.off('groupCallSignal', handleReceiveSignal);
      socket.off('groupCallIce', handleReceiveIce);
      socket.off('userLeftGroupCall', handleUserLeft);
    };
  }, [socket, currentRoom, currentUser]);

  const startOrJoinGroupCall = async (type) => {
    if (!currentRoom) return;
    setCallType(type);
    setIncomingGroupAlert(null);

    const stream = await getSafeMediaStream(type);
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    setInGroupCall(true);
    inGroupCallRef.current = true;

    socket.emit('joinGroupCall', {
      roomID: currentRoom,
      user: currentUser,
      callType: type
    });
  };

  const leaveGroupCall = () => {
    socket.emit('leaveGroupCall', { roomID: currentRoom });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    Object.values(peersMapRef.current).forEach((p) => p.close());
    peersMapRef.current = {};
    setRemotePeers([]);
    setInGroupCall(false);
    inGroupCallRef.current = false;
    setIsMuted(false);
    setIsCamOff(false);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsCamOff(!isCamOff);
  };

  if (!inActiveRoom) return null;

  return (
    <>
      {/* Group Call Buttons in Room Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => startOrJoinGroupCall('audio')}
          className="bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold"
        >
          📞 Group Audio
        </button>
        <button
          onClick={() => startOrJoinGroupCall('video')}
          className="bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/40 text-cyan-300 px-3 py-1.5 rounded-xl text-xs font-bold"
        >
          📹 Group Video
        </button>
      </div>

      {/* Incoming Group Call Popup */}
      {incomingGroupAlert &&
        !inGroupCall &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[#121624] border border-cyan-500/40 rounded-3xl p-6 text-center shadow-2xl">
              <p className="text-xs font-bold text-cyan-400 uppercase mb-1">Room #{currentRoom}</p>
              <h3 className="text-base font-extrabold text-white mb-2">
                {incomingGroupAlert.starterName} started a Group {incomingGroupAlert.callType === 'video' ? 'Video' : 'Audio'} Call!
              </h3>
              <div className="flex justify-center gap-3 mt-5">
                <button
                  onClick={() => startOrJoinGroupCall(incomingGroupAlert.callType)}
                  className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-full text-xs font-bold"
                >
                  ✅ Join Call
                </button>
                <button
                  onClick={() => setIncomingGroupAlert(null)}
                  className="bg-rose-600 hover:bg-rose-500 px-5 py-2.5 rounded-full text-xs font-bold"
                >
                  ✕ Ignore
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Multi-User Group Call Grid Screen */}
      {inGroupCall &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-[#101422] border border-white/15 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-extrabold text-white">
                  {callType === 'video' ? '📹' : '📞'} Room #{currentRoom} Group Call ({remotePeers.length + 1} Members)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6 max-h-[60vh] overflow-y-auto">
                {/* My Own Tile */}
                <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border-2 border-cyan-500/60 h-48 sm:h-56 flex items-center justify-center">
                  <video ref={localVideoRef} autoPlay muted playsInline className={callType === 'video' ? 'w-full h-full object-cover' : 'hidden'} />
                  {callType === 'audio' && <div className="text-3xl">🎙️</div>}
                  <span className="absolute bottom-2.5 left-3 bg-black/70 px-2.5 py-1 rounded-lg text-[11px] font-bold text-cyan-300">
                    You ({currentUser.name})
                  </span>
                </div>

                {/* All Other Joined Room Members */}
                {remotePeers.map((p) => (
                  <RemoteParticipantTile key={p.socketId} peerObj={p} callType={callType} />
                ))}
              </div>

              <div className="flex justify-center gap-4">
                <button onClick={toggleMute} className={`px-4 py-3 rounded-full text-xs font-bold border ${isMuted ? 'bg-amber-600 border-amber-400' : 'bg-white/10 border-white/15'}`}>
                  {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
                </button>
                {callType === 'video' && (
                  <button onClick={toggleCamera} className={`px-4 py-3 rounded-full text-xs font-bold border ${isCamOff ? 'bg-amber-600 border-amber-400' : 'bg-white/10 border-white/15'}`}>
                    {isCamOff ? '📷 Start Video' : '🎥 Stop Video'}
                  </button>
                )}
                <button onClick={leaveGroupCall} className="bg-rose-600 hover:bg-rose-500 px-6 py-3 rounded-full text-xs font-bold">
                  📴 Leave Call
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
