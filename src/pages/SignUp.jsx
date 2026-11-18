import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Signup() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      if (photo) data.append('profilePhoto', photo);

      await axios.post('http://localhost:5000/api/auth/signup', data);
      alert('Account Created! Now Login.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup Failed!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050811] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      <div className="absolute top-10 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* App Logo */}
      <div className="mb-5 text-center z-10 flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-tr from-violet-600 to-cyan-400 rounded-xl flex items-center justify-center text-xl shadow-lg">⚡</div>
        <h1 className="font-black text-2xl tracking-widest">NEXUS<span className="text-cyan-400 font-light">CHAT</span></h1>
      </div>

      {/* Glass Card */}
      <div className="w-full max-w-md bg-white/[0.03] border border-white/10 p-7 rounded-3xl backdrop-blur-2xl shadow-2xl z-10">
        <h2 className="text-lg font-extrabold text-center mb-1">Create Your Identity</h2>
        <p className="text-xs text-gray-400 text-center mb-4">Set up your profile photo and credentials</p>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-2.5 rounded-xl text-center mb-4">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-3">
          {/* Interactive Avatar Uploader */}
          <div className="flex flex-col items-center mb-2">
            <label className="relative cursor-pointer group">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-cyan-400 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-cyan-400/70 flex items-center justify-center overflow-hidden bg-[#0B0F19]">
                {preview ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">📸</span>
                )}
              </div>
              <span className="text-[10px] text-cyan-400 font-bold block text-center mt-1.5 group-hover:underline">
                {preview ? 'Change Avatar' : 'Choose Profile Photo'}
              </span>
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </label>
          </div>

          <input type="text" required placeholder="Full Name" onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-400" />
          <input type="email" required autoComplete="email" placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-400" />
          <input type="tel" required placeholder="Phone Number" onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-400" />
          <input type="password" required autoComplete="new-password" placeholder="Create Password" onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-400" />
          
          <button type="submit" disabled={loading} className="w-full mt-2 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 font-black text-xs tracking-widest py-3.5 rounded-xl shadow-lg transition-all">
            {loading ? 'REGISTERING...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-5">
          Already have an account? <Link to="/login" className="text-cyan-400 font-bold hover:underline">Login Here</Link>
        </p>
      </div>
    </div>
  );
}
