import React from 'react';

export default function Sidebar({
  otherMembers,
  totalCount,
  selectedPrivateUser,
  setSelectedPrivateUser,
  unreadCounts = {}
}) {
  return (
    <aside className="w-64 sm:w-72 bg-[#080B13] border-r border-white/10 flex flex-col shrink-0">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
          Members ({totalCount})
        </span>
        <span className="text-[10px] bg-violet-600/20 text-violet-300 px-2 py-0.5 rounded-full font-bold">
          All Users
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {otherMembers.length === 0 ? (
          <p className="text-xs text-gray-500 text-center mt-10">No other members found</p>
        ) : (
          otherMembers.map((member) => {
            const isSelected = selectedPrivateUser?.id === member.id;
            const isOnline = Boolean(member.isOnline);
            const unread = unreadCounts[member.id] || 0;

            return (
              <button
                key={member.id}
                onClick={() => setSelectedPrivateUser(member)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all text-left border ${
                  isSelected
                    ? 'bg-cyan-600/20 border-cyan-400/50 shadow-lg'
                    : 'bg-white/[0.02] hover:bg-white/[0.06] border-transparent'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover border border-white/15"
                  />
                  <span
                    className={`w-3 h-3 rounded-full border-2 border-[#080B13] absolute bottom-0 right-0 ${
                      isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{member.name}</p>
                  <p
                    className={`text-[10px] font-semibold mt-0.5 ${
                      isOnline ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isOnline ? '● Online' : '● Offline'}
                  </p>
                </div>

                {/* Unread Message Red Badge */}
                {unread > 0 && !isSelected && (
                  <span className="bg-rose-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md animate-bounce">
                    {unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
