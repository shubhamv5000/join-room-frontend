import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login({ setUser }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { identifier, password });
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#09090B] text-white flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-[#121216] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
        
        {/* Left Branding Panel */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-indigo-600 via-purple-700 to-fuchsia-600 relative overflow-hidden">
          <div className="flex items-center gap-3 z-10">
            <div className="w-10 h-10 bg-black/30 rounded-xl flex items-center justify-center text-xl">⚡</div>
            <span className="font-black text-xl tracking-wider">NEXUSCHAT</span>
          </div>
          <div className="z-10 my-auto">
            <h2 className="text-3xl font-black leading-tight">Connect with your squad in real-time.</h2>
            <p className="text-xs text-white/80 mt-3 leading-relaxed">
              Join instant chatrooms, track live online/offline members, and switch to 1-on-1 private chats effortlessly.
            </p>
          </div>
          <div className="text-[11px] font-medium text-white/80 z-10">● Secure Multi-Node Mesh</div>
        </div>

        {/* Right Login Form */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <h3 className="text-2xl font-extrabold">Welcome back</h3>
          <p className="text-xs text-zinc-400 mt-1 mb-6">Login using your Email or Phone Number</p>

          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl mb-4">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">Email or Phone Number</label>
              <input type="text" required autoComplete="username" placeholder="you@example.com or 9876543210" value={identifier} onChange={e => setIdentifier(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white focus:outline-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-zinc-400">Password</label>
                <Link to="/forgot-password" className="text-[11px] font-bold text-indigo-400 hover:underline">Forgot Password?</Link>
              </div>
              <input type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white focus:outline-none" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold text-xs py-3.5 rounded-xl shadow-lg transition-all">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-zinc-400 text-center mt-6">
            Don't have an account? <Link to="/signup" className="text-indigo-400 font-bold hover:underline">Sign up free</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
