import React, { useState } from 'react';
import ProfilePhotoModal from './ProfilePhotoModal';

export default function Navbar({
  currentUser,
  currentRoom,
  setCurrentRoom,
  inActiveRoom,
  handleJoinRoom,
  onLogout,
  onPhotoUpdated
}) {
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  return (
    <>
      <header className="h-20 w-full bg-[#090D16]/95 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-4 sm:px-8 shrink-0 z-20 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        {/* Top-Left Corner: Logged-in User Profile Photo (Click to Change) */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            onClick={() => setShowPhotoModal(true)}
            title="Click to change profile photo"
            className="relative shrink-0 group cursor-pointer"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-cyan-400 rounded-full blur opacity-80 group-hover:opacity-100 transition duration-300"></div>
            <img
              src={currentUser.profilePhoto}
              alt="My Avatar"
              className="relative w-11 h-11 rounded-full border-2 border-[#090D16] object-cover group-hover:brightness-75 transition"
            />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] opacity-0 group-hover:opacity-100 transition">
              📷
            </span>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#090D16] rounded-full"></span>
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-black tracking-wide text-white truncate">{currentUser.name}</p>
            <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> Online
            </p>
          </div>
        </div>

        {/* Center Brand Pill (Desktop Only) */}
        <div className="hidden md:flex items-center gap-2 bg-white/[0.03] border border-white/10 px-4 py-1.5 rounded-full">
          <span className="text-sm">⚡</span>
          <span className="text-xs font-black tracking-widest text-gray-300">
            NEXUS<span className="text-cyan-400">CHAT</span>
          </span>
        </div>

        {/* Right: Join Room Bar + Logout */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 focus-within:border-cyan-400/60 transition-all">
            <span className="text-cyan-400 text-xs font-mono pl-2 font-bold">#</span>
            <input
              type="text"
              placeholder="Room ID"
              value={currentRoom}
              onChange={(e) => setCurrentRoom(e.target.value)}
              disabled={inActiveRoom}
              className="bg-transparent text-xs text-white focus:outline-none w-20 sm:w-28 font-mono disabled:opacity-50"
            />
            <button
              onClick={handleJoinRoom}
              disabled={inActiveRoom}
              className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-90 text-white text-[10px] font-black tracking-wider px-3.5 py-2 rounded-lg shadow-md disabled:opacity-40 transition-all whitespace-nowrap"
            >
              {inActiveRoom ? '✓ JOINED' : 'JOIN ROOM'}
            </button>
          </div>

          <button
            onClick={onLogout}
            className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[11px] font-bold px-3.5 py-2.5 rounded-xl transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      <ProfilePhotoModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        currentUser={currentUser}
        onPhotoUpdated={onPhotoUpdated}
      />
    </>
  );
}
