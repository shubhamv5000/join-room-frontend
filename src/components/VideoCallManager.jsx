import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function VideoCallManager({ socket, currentUser, selectedPrivateUser }) {
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState('video');
  const [callerInfo, setCallerInfo] = useState(null);
  const [activeCallPartner, setActiveCallPartner] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  const [callSeconds, setCallSeconds] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [callLogs, setCallLogs] = useState([]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const callSecondsRef = useRef(0);
  const isInitiatorRef = useRef(false);
  const hasLoggedCallRef = useRef(false);

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const remSecs = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${remSecs}`;
  };

  useEffect(() => {
    let interval = null;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallSeconds((prev) => {
          const next = prev + 1;
          callSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      setCallSeconds(0);
      callSecondsRef.current = 0;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  const saveCallLogToChat = (partnerId, type, durationSecs) => {
    if (!partnerId || !currentUser?.id || hasLoggedCallRef.current) return;
    hasLoggedCallRef.current = true;

    const isCompleted = durationSecs > 0;
    const durationText = isCompleted ? formatDuration(durationSecs) : 'Missed / Declined';
    const label = type === 'video' ? '📹 Video Call' : '📞 Audio Call';

    const payload = {
      messageType: 'call',
      senderId: currentUser.id,
      senderName: currentUser.name,
      photo: currentUser.profilePhoto,
      text: `${label} • ${durationText}`,
      callDetails: {
        callType: type,
        duration: durationText,
        status: isCompleted ? 'completed' : 'missed'
      },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit('sendPrivateMessage', {
      toSocketId: null,
      receiverId: partnerId,
      messageData: payload
    });
  };
  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallState('idle');
    setCallerInfo(null);
    setActiveCallPartner(null);
    setIsMuted(false);
    setIsCamOff(false);
    isInitiatorRef.current = false;
  };

  useEffect(() => {
    if (!socket) return;
    if (currentUser?.id) socket.emit('registerUser', currentUser.id);

    const handleIncomingCall = ({ signal, from, name, callType: incomingType }) => {
      isInitiatorRef.current = false;
      hasLoggedCallRef.current = false;
      setCallerInfo({ signal, from, name, callType: incomingType });
      setCallType(incomingType);
      setActiveCallPartner({ id: from, name });
      setCallState('incoming');
    };

    const handleCallAccepted = async (signal) => {
      setCallState('connected');
      if (peerRef.current && signal) {
        try {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        } catch (err) {
          console.error('Set Remote Description Error:', err);
        }
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('ICE Error:', e);
        }
      }
    };

    const handleCallFailed = ({ message }) => {
      alert(message);
      cleanupCall();
    };

    const handleCallEnded = () => {
      if (isInitiatorRef.current && activeCallPartner?.id) {
        saveCallLogToChat(activeCallPartner.id, callType, callSecondsRef.current);
      }
      cleanupCall();
    };

    socket.on('incomingCall', handleIncomingCall);
    socket.on('callAccepted', handleCallAccepted);
    socket.on('iceCandidate', handleIceCandidate);
    socket.on('callFailed', handleCallFailed);
    socket.on('callEnded', handleCallEnded);

    return () => {
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callAccepted', handleCallAccepted);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('callFailed', handleCallFailed);
      socket.off('callEnded', handleCallEnded);
    };
  }, [socket, currentUser?.id, activeCallPartner, callType]);

  const getSafeMediaStream = async (type) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser blocked media! Use http://localhost:5173');
    }
    try {
      return await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
    } catch (firstErr) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      } catch (secondErr) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx.createMediaStreamDestination().stream;
      }
    }
  };
  const createPeerConnection = (stream) => {
    const stunHost = ['stun', 'l', 'google', 'com'].join('.');
    const peer = new RTCPeerConnection({ iceServers: [{ urls: `stun:${stunHost}:19302` }] });
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    peerRef.current = peer;
    return peer;
  };

  const startCall = async (type) => {
    if (!selectedPrivateUser) return;
    cleanupCall();
    isInitiatorRef.current = true;
    hasLoggedCallRef.current = false;

    try {
      setCallType(type);
      setCallState('calling');
      setActiveCallPartner({ id: selectedPrivateUser.id, name: selectedPrivateUser.name });

      const stream = await getSafeMediaStream(type);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peer = createPeerConnection(stream);
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('iceCandidate', { to: selectedPrivateUser.id, candidate: event.candidate });
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit('callUser', {
        userToCall: selectedPrivateUser.id,
        signalData: offer,
        from: currentUser.id,
        name: currentUser.name,
        photo: currentUser.profilePhoto,
        callType: type
      });
    } catch (err) {
      alert(`Call Error: ${err.message}`);
      cleanupCall();
    }
  };

  const answerIncomingCall = async () => {
    if (!callerInfo) return;
    try {
      setCallState('connected');
      const stream = await getSafeMediaStream(callerInfo.callType);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peer = createPeerConnection(stream);
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('iceCandidate', { to: callerInfo.from, candidate: event.candidate });
        }
      };

      await peer.setRemoteDescription(new RTCSessionDescription(callerInfo.signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit('answerCall', { to: callerInfo.from, signal: answer });
    } catch (err) {
      alert(`Answer Error: ${err.message}`);
      handleEndCall();
    }
  };

  const handleEndCall = () => {
    if (activeCallPartner?.id) {
      socket.emit('endCall', { to: activeCallPartner.id });
      if (isInitiatorRef.current) {
        saveCallLogToChat(activeCallPartner.id, callType, callSecondsRef.current);
      }
    }
    cleanupCall();
  };

  const openCallHistory = async () => {
    setShowHistoryModal(true);
    try {
      const res = await fetch(`http://localhost:5000/api/calls/${currentUser.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setCallLogs(data);
    } catch (err) {
      console.error('Failed to fetch call logs:', err);
    }
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
  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={openCallHistory}
          className="bg-white/5 hover:bg-white/15 border border-white/10 text-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold"
        >
          📋 Calls
        </button>

        {selectedPrivateUser && (
          <>
            <button
              onClick={() => startCall('audio')}
              className="bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold"
            >
              📞 Audio
            </button>
            <button
              onClick={() => startCall('video')}
              className="bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/40 text-cyan-300 px-3 py-1.5 rounded-xl text-xs font-bold"
            >
              📹 Video
            </button>
          </>
        )}
      </div>

      {showHistoryModal &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#121624] border border-white/15 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <h3 className="text-base font-extrabold text-white">📋 Recent Call History</h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-rose-500/30 text-gray-300 flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2.5 custom-scrollbar">
                {callLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-10">No calls made or received yet.</p>
                ) : (
                  callLogs.map((log, idx) => {
                    const isOutgoing = log.senderId === currentUser.id;
                    return (
                      <div key={idx} className="flex items-center justify-between bg-white/[0.04] border border-white/10 p-3.5 rounded-2xl">
                        <div>
                          <p className="text-xs font-bold text-white">
                            {isOutgoing ? '↗️ Outgoing Call' : `↙️ Incoming (${log.senderName})`}
                          </p>
                          <p className="text-[11px] text-cyan-400 mt-0.5">{log.text}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">{log.time}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {callState !== 'idle' &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-[#101422] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
              <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-1">
                {callType === 'video' ? '📹 Encrypted Video Call' : '📞 Encrypted Audio Call'}
              </p>
              <h2 className="text-xl font-extrabold text-white text-center">
                {callState === 'incoming'
                  ? `${callerInfo?.name} is calling...`
                  : callState === 'calling'
                  ? `Calling ${activeCallPartner?.name}...`
                  : `${activeCallPartner?.name || 'Connected'}`}
              </h2>
              {callState === 'connected' && (
                <p className="text-xs font-mono text-emerald-400 mt-1 mb-2">⏱️ {formatDuration(callSeconds)}</p>
              )}

              <div className={`relative w-full h-72 sm:h-80 bg-black rounded-2xl overflow-hidden border border-white/10 my-4 ${callType === 'audio' ? 'flex items-center justify-center' : ''}`}>
                <video ref={remoteVideoRef} autoPlay playsInline className={callType === 'video' ? 'w-full h-full object-cover' : 'hidden'} />
                {callType === 'audio' && (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center text-3xl animate-pulse shadow-lg">🎧</div>
                )}
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={callType === 'video' ? 'w-28 h-20 sm:w-36 sm:h-24 object-cover rounded-xl border-2 border-cyan-400 absolute bottom-3 right-3 bg-zinc-900' : 'hidden'}
                />
              </div>

              <div className="flex items-center gap-4">
                {callState === 'incoming' ? (
                  <>
                    <button onClick={answerIncomingCall} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-full text-xs font-bold shadow-lg">
                      ✅ Accept
                    </button>
                    <button onClick={handleEndCall} className="bg-rose-600 hover:bg-rose-500 px-6 py-3 rounded-full text-xs font-bold shadow-lg">
                      ❌ Reject
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={toggleMute} className={`px-4 py-3 rounded-full text-xs font-bold border ${isMuted ? 'bg-amber-600 border-amber-400' : 'bg-white/10 border-white/15'}`}>
                      {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
                    </button>
                    {callType === 'video' && (
                      <button onClick={toggleCamera} className={`px-4 py-3 rounded-full text-xs font-bold border ${isCamOff ? 'bg-amber-600 border-amber-400' : 'bg-white/10 border-white/15'}`}>
                        {isCamOff ? '📷 Start Video' : '🎥 Stop Video'}
                      </button>
                    )}
                    <button onClick={handleEndCall} className="bg-rose-600 hover:bg-rose-500 px-6 py-3 rounded-full text-xs font-bold shadow-lg">
                      📴 End Call
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
