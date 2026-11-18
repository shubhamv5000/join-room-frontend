import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import VideoCallManager from '../components/VideoCallManager';
import GroupCallManager from '../components/GroupCallManager';

const socket = io('http://localhost:5000', { autoConnect: false });

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) {}
};

export default function Dashboard({ currentUser, setUser }) {
  const [currentRoom, setCurrentRoom] = useState('');
  const [inActiveRoom, setInActiveRoom] = useState(false);
  const [liveRoomMembers, setLiveRoomMembers] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [allDbUsers, setAllDbUsers] = useState([]);
  const [selectedPrivateUser, setSelectedPrivateUser] = useState(null);
  const [roomMessages, setRoomMessages] = useState([]);
  const [privateChats, setPrivateChats] = useState({});
  const [text, setText] = useState('');

  const [typingStatus, setTypingStatus] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});

  const endRef = useRef(null);
  const selectedUserRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    selectedUserRef.current = selectedPrivateUser;
    if (selectedPrivateUser?.id && currentUser?.id) {
      setUnreadCounts((prev) => ({ ...prev, [selectedPrivateUser.id]: 0 }));
      if (document.visibilityState === 'visible') {
        socket.emit('markMessagesSeen', {
          senderId: selectedPrivateUser.id,
          receiverId: currentUser.id
        });
      }
    }
    setTypingStatus('');
  }, [selectedPrivateUser, currentUser?.id]);

  // Send Blue Tick when user switches back to this browser tab while chat is open
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        selectedUserRef.current?.id &&
        currentUser?.id
      ) {
        socket.emit('markMessagesSeen', {
          senderId: selectedUserRef.current.id,
          receiverId: currentUser.id
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser?.id]);

  useEffect(() => {
    fetch('http://localhost:5000/api/users')
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setAllDbUsers(data))
      .catch((err) => console.error('Failed to load users:', err));
  }, []);
  useEffect(() => {
    if (!currentUser?.id) return;

    const registerMe = () => socket.emit('registerUser', String(currentUser.id));

    socket.on('connect', registerMe);
    socket.on('onlineUsersList', (ids) => setOnlineUserIds(ids));
    socket.on('roomData', ({ users }) => setLiveRoomMembers(users));
    socket.on('roomHistory', (history) => setRoomMessages(history));

    socket.on('message', (msg) => {
      setRoomMessages((prev) => [...prev, msg]);
      if (msg.senderId !== currentUser.id) playNotificationSound();
    });

    socket.on('privateMessage', (msg) => {
      setPrivateChats((prev) => {
        const existing = prev[msg.senderId] || [];
        if (msg._id && existing.some((m) => m._id === msg._id)) return prev;
        return { ...prev, [msg.senderId]: [...existing, msg] };
      });

      if (msg.senderId !== currentUser.id) {
        playNotificationSound();
        if (
          selectedUserRef.current?.id === msg.senderId &&
          document.visibilityState === 'visible'
        ) {
          socket.emit('markMessagesSeen', {
            senderId: msg.senderId,
            receiverId: currentUser.id
          });
        } else {
          setUnreadCounts((prev) => ({
            ...prev,
            [msg.senderId]: (prev[msg.senderId] || 0) + 1
          }));
        }
      }
    });

    socket.on('privateMessageSaved', (savedMsg) => {
      setPrivateChats((prev) => {
        const list = prev[savedMsg.receiverId] || [];
        if (list.some((m) => m._id === savedMsg._id)) return prev;
        return { ...prev, [savedMsg.receiverId]: [...list, savedMsg] };
      });
    });

    socket.on('messagesDelivered', ({ toUserId }) => {
      setPrivateChats((prev) => {
        const list = prev[toUserId] || [];
        return {
          ...prev,
          [toUserId]: list.map((m) => (m.status === 'sent' ? { ...m, status: 'delivered' } : m))
        };
      });
    });

    socket.on('messagesMarkedSeen', ({ byUserId }) => {
      setPrivateChats((prev) => {
        const list = prev[byUserId] || [];
        return {
          ...prev,
          [byUserId]: list.map((m) => ({ ...m, status: 'seen' }))
        };
      });
    });

    socket.on('userTyping', ({ chatType, senderId, senderName }) => {
      if (chatType === 'private' && selectedUserRef.current?.id === senderId) {
        setTypingStatus('typing...');
      } else if (chatType === 'room' && !selectedUserRef.current && senderId !== currentUser.id) {
        setTypingStatus(`${senderName} is typing...`);
      }
    });

    socket.on('userStopTyping', ({ chatType, senderId }) => {
      if (chatType === 'private' && selectedUserRef.current?.id === senderId) {
        setTypingStatus('');
      } else if (chatType === 'room' && !selectedUserRef.current) {
        setTypingStatus('');
      }
    });

    socket.on('messageDeleted', (deletedId) => {
      setRoomMessages((prev) => prev.filter((m) => m._id !== deletedId));
      setPrivateChats((prev) => {
        const updated = {};
        for (const uid in prev) {
          updated[uid] = prev[uid].filter((m) => m._id !== deletedId);
        }
        return updated;
      });
    });

    socket.on('chatCleared', ({ chatType, user1, user2 }) => {
      if (chatType === 'room') {
        setRoomMessages([]);
      } else if (chatType === 'private') {
        const partnerId = user1 === currentUser?.id ? user2 : user1;
        setPrivateChats((prev) => ({ ...prev, [partnerId]: [] }));
      }
    });

    socket.connect();
    if (socket.connected) registerMe();

    const handleTabClose = () => socket.disconnect();
    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      socket.off('connect', registerMe);
      socket.off('onlineUsersList');
      socket.off('roomData');
      socket.off('roomHistory');
      socket.off('message');
      socket.off('privateMessage');
      socket.off('privateMessageSaved');
      socket.off('messagesDelivered');
      socket.off('messagesMarkedSeen');
      socket.off('userTyping');
      socket.off('userStopTyping');
      socket.off('messageDeleted');
      socket.off('chatCleared');
      socket.disconnect();
    };
  }, [currentUser?.id]);
  useEffect(() => {
    if (!selectedPrivateUser || !currentUser?.id) return;
    fetch(`http://localhost:5000/api/messages/private/${currentUser.id}/${selectedPrivateUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPrivateChats((prev) => ({ ...prev, [selectedPrivateUser.id]: data }));
        }
      })
      .catch((err) => console.error('Failed to load private history:', err));
  }, [selectedPrivateUser, currentUser?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages, privateChats, selectedPrivateUser]);

  const handleJoinRoom = () => {
    if (!currentRoom.trim()) return alert('Enter Room ID!');
    socket.emit('joinRoom', { roomID: currentRoom.trim(), user: currentUser });
    setInActiveRoom(true);
    setSelectedPrivateUser(null);
  };

  const handleLogout = () => {
    socket.disconnect();
    setUser(null);
  };  const handlePhotoUpdated = (newPhotoUrl) => {
    const updated = { ...currentUser, profilePhoto: newPhotoUrl };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
    setAllDbUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, photo: newPhotoUrl } : u))
    );
  };

  const handleDeleteSingleMessage = async (msgId) => {
    if (!msgId) return;
    if (!window.confirm('Delete this message?')) return;
    try {
      await fetch(`http://localhost:5000/api/messages/${msgId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  const handleClearEntireChat = async () => {
    if (!window.confirm('Are you sure you want to clear all messages in this chat?')) return;
    try {
      if (selectedPrivateUser) {
        await fetch(`http://localhost:5000/api/messages/private/clear/${currentUser.id}/${selectedPrivateUser.id}`, {
          method: 'DELETE'
        });
        setPrivateChats((prev) => ({ ...prev, [selectedPrivateUser.id]: [] }));
      } else if (inActiveRoom) {
        await fetch(`http://localhost:5000/api/messages/room/clear/${currentRoom}`, {
          method: 'DELETE'
        });
        setRoomMessages([]);
      }
    } catch (err) {
      console.error('Clear chat error:', err);
    }
  };

  const handleInputChange = (e) => {
    setText(e.target.value);
    if (!currentUser?.id) return;

    const payload = selectedPrivateUser
      ? { chatType: 'private', receiverId: selectedPrivateUser.id, senderId: currentUser.id, senderName: currentUser.name }
      : { chatType: 'room', roomID: currentRoom, senderId: currentUser.id, senderName: currentUser.name };

    socket.emit('typing', payload);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', payload);
    }, 1500);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() || (!inActiveRoom && !selectedPrivateUser)) return;

    const payload = {
      messageType: 'text',
      senderId: currentUser.id,
      senderName: currentUser.name,
      photo: currentUser.profilePhoto,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (selectedPrivateUser) {
      socket.emit('sendPrivateMessage', {
        receiverId: selectedPrivateUser.id,
        messageData: payload
      });
      socket.emit('stopTyping', { chatType: 'private', receiverId: selectedPrivateUser.id, senderId: currentUser.id });
    } else {
      socket.emit('sendMessage', { roomID: currentRoom, messageData: payload });
      socket.emit('stopTyping', { chatType: 'room', roomID: currentRoom, senderId: currentUser.id });
    }
    setText('');
  };

  const mergedMembers = allDbUsers.map((dbUser) => {
    const isOnline = onlineUserIds.includes(String(dbUser.id));
    const liveMatch = liveRoomMembers.find((m) => m.id === dbUser.id);
    return {
      ...dbUser,
      isOnline,
      socketId: isOnline ? (liveMatch?.socketId || 'online') : null
    };
  });

  const otherMembers = mergedMembers.filter((m) => m.id !== currentUser.id);
  const displayMemberCount = inActiveRoom ? liveRoomMembers.length : mergedMembers.length;
  const activeMessages = selectedPrivateUser ? privateChats[selectedPrivateUser.id] || [] : roomMessages;
  const canChat = inActiveRoom || Boolean(selectedPrivateUser);

    return (
    <div className="h-screen w-full bg-[#050811] text-white flex flex-col overflow-hidden relative">
      <Navbar
        currentUser={currentUser}
        currentRoom={currentRoom}
        setCurrentRoom={setCurrentRoom}
        inActiveRoom={inActiveRoom}
        handleJoinRoom={handleJoinRoom}
        onLogout={handleLogout}
        onPhotoUpdated={handlePhotoUpdated}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          otherMembers={otherMembers}
          totalCount={displayMemberCount}
          selectedPrivateUser={selectedPrivateUser}
          setSelectedPrivateUser={setSelectedPrivateUser}
          unreadCounts={unreadCounts}
        />

        <main className="flex-1 flex flex-col justify-between bg-[radial-gradient(ellipse_at_top,#0F172A,#050811)] h-full min-w-0">
          <div className="h-14 px-5 border-b border-white/10 bg-white/[0.02] backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {selectedPrivateUser ? (
                <>
                  <img src={selectedPrivateUser.photo} alt="" className="w-7 h-7 rounded-full object-cover border border-cyan-400" />
                  <div>
                    <p className="text-xs font-bold text-cyan-300">{selectedPrivateUser.name}</p>
                    <p className={`text-[9px] font-semibold ${typingStatus ? 'text-emerald-400 animate-pulse' : onlineUserIds.includes(String(selectedPrivateUser.id)) ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {typingStatus ? typingStatus : onlineUserIds.includes(String(selectedPrivateUser.id)) ? '● Online • Direct Chat' : '● Offline • Direct Chat History'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-xs">#</div>
                  <div>
                    <p className="text-xs font-bold text-white">{inActiveRoom ? `Room #${currentRoom}` : 'Lobby'}</p>
                    <p className={`text-[9px] ${typingStatus ? 'text-emerald-400 font-bold animate-pulse' : 'text-gray-400'}`}>
                      {typingStatus ? typingStatus : inActiveRoom ? 'Group Broadcast Channel' : 'Select a contact or join a room'}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!selectedPrivateUser && inActiveRoom && (
                <GroupCallManager
                  socket={socket}
                  currentUser={currentUser}
                  currentRoom={currentRoom}
                  inActiveRoom={inActiveRoom}
                />
              )}

              <VideoCallManager
                socket={socket}
                currentUser={currentUser}
                selectedPrivateUser={selectedPrivateUser}
              />

              {canChat && (
                <button
                  onClick={handleClearEntireChat}
                  title="Clear Entire Chat"
                  className="bg-rose-600/15 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                >
                  🧹 Clear Chat
                </button>
              )}

              {selectedPrivateUser && inActiveRoom && (
                <button
                  onClick={() => setSelectedPrivateUser(null)}
                  className="text-[11px] bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-200 px-3 py-1.5 rounded-xl font-bold transition-all"
                >
                  ← Room
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 p-5 custom-scrollbar">
            {activeMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-2xl mb-3">
                  {selectedPrivateUser ? '🔒' : '💬'}
                </div>
                <p className="text-xs font-semibold text-gray-300">
                  {selectedPrivateUser ? `Private chat with ${selectedPrivateUser.name}` : 'No messages yet'}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">Type below to start sending real-time messages</p>
              </div>
            )}

            {activeMessages.map((msg, i) => {
              const isMe = msg.senderId === currentUser.id;

              if (msg.messageType === 'call') {
                return (
                  <div key={msg._id || i} className="flex justify-center my-2 group">
                    <div className="bg-white/[0.06] border border-cyan-500/30 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-md">
                      <span className="text-xs font-bold text-cyan-300">{msg.text}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{msg.time}</span>
                      {msg._id && (
                        <button
                          onClick={() => handleDeleteSingleMessage(msg._id)}
                          className="text-rose-400 hover:text-rose-300 text-xs opacity-60 group-hover:opacity-100 transition-opacity"
                          title="Delete call log"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg._id || i} className={`flex items-end gap-2.5 group ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && <img src={msg.photo} alt="" className="w-7 h-7 rounded-full object-cover border border-white/20 shrink-0" />}

                  {isMe && msg._id && (
                    <button
                      onClick={() => handleDeleteSingleMessage(msg._id)}
                      className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 text-xs p-1 transition-opacity"
                      title="Delete message"
                    >
                      🗑️
                    </button>
                  )}

                  <div
                    className={`max-w-[75%] sm:max-w-sm px-4 py-2.5 rounded-2xl text-xs shadow-xl break-words ${
                      isMe
                        ? 'bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-600 text-white rounded-br-none'
                        : 'bg-white/[0.06] border border-white/10 text-gray-100 rounded-bl-none backdrop-blur-md'
                    }`}
                  >
                    {!isMe && !selectedPrivateUser && <p className="text-[10px] text-cyan-400 font-bold mb-1">{msg.senderName}</p>}
                    <p className="leading-relaxed">{msg.text}</p>

                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <span className="text-[9px] text-white/70 font-mono">{msg.time}</span>
                      {isMe && selectedPrivateUser && (
                        <>
                          {msg.status === 'seen' ? (
                            <span className="text-[11px] font-black text-[#00E5FF] bg-black/30 px-1 rounded tracking-tighter">
                              ✓✓
                            </span>
                          ) : msg.status === 'delivered' ? (
                            <span className="text-[11px] font-bold text-gray-300/80 tracking-tighter">
                              ✓✓
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-gray-300/70">
                              ✓
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {!isMe && msg._id && (
                    <button
                      onClick={() => handleDeleteSingleMessage(msg._id)}
                      className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 text-xs p-1 transition-opacity"
                      title="Delete message"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSend} className="p-3.5 border-t border-white/10 bg-[#080B13] flex gap-2.5 shrink-0">
            <input
              type="text"
              placeholder={
                !canChat
                  ? 'Select a user or join a room first...'
                  : selectedPrivateUser
                  ? `Message ${selectedPrivateUser.name} privately...`
                  : `Message Room #${currentRoom}...`
              }
              disabled={!canChat}
              value={text}
              onChange={handleInputChange}
              className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 flex-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 disabled:opacity-40 transition-all"
            />
            <button
              type="submit"
              disabled={!canChat}
              className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-90 px-6 py-3 text-xs font-bold rounded-xl transition-all disabled:opacity-40 shadow-lg"
            >
              Send
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
