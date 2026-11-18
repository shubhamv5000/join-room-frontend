import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { auth } from '../firebase'; // Ensure firebase.js is in the same src folder
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
   
  // Firebase Phone Auth States
  const [isPhoneReset, setIsPhoneReset] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  const navigate = useNavigate();
  // Setup Invisible reCAPTCHA safely without duplicate rendering
  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    const container = document.getElementById('recaptcha-container');
    if (container) {
      container.innerHTML = '';
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
  };

 

  // STEP 1: SEND OTP (Decides automatically between Email & Phone)
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const trimmedInput = identifier.trim();
    const isEmail = trimmedInput.includes('@');

    try {
      if (isEmail) {
        // --- EMAIL FLOW (Existing Backend API) ---
        setIsPhoneReset(false);
        const res = await axios.post('http://localhost:5000/api/auth/forgot-password', {
          identifier: trimmedInput
        });
        setMessage(res.data.message || '6-Digit OTP has been sent to your registered Email!');
        setStep(2);
      } else {
        // --- PHONE FLOW (Firebase SMS OTP) ---
        setIsPhoneReset(true);
        const cleanDigits = trimmedInput.replace(/\D/g, '');
        if (cleanDigits.length < 10) {
          setLoading(false);
          return setError('Please enter a valid 10-digit phone number!');
        }

        const formattedPhone = trimmedInput.startsWith('+') ? trimmedInput : `+91${cleanDigits}`;
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;

        const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        setConfirmationResult(result);
        setMessage(`6-Digit SMS OTP has been sent to ${formattedPhone}!`);
        setStep(2);
      }
    } catch (err) {
      console.error('Send OTP Error:', err);
      if (isEmail) {
        setError(err.response?.data?.message || 'Failed to send Email OTP!');
      } else {
        setError(`Failed to send SMS OTP: ${err.code || err.message}`);
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (e) => {
    const onlyNums = e.target.value.replace(/[^0-9]/g, '');
    if (onlyNums.length <= 6) setOtp(onlyNums);
  };

  // STEP 2: VERIFY OTP & RESET PASSWORD
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return setError('Please enter exact 6-digit numeric OTP!');
    setError('');
    setLoading(true);

    try {
      if (!isPhoneReset) {
        // --- EMAIL VERIFY & RESET ---
        const res = await axios.post('http://localhost:5000/api/auth/reset-password', {
          identifier: identifier.trim(),
          otp,
          newPassword
        });
        alert(res.data.message);
        navigate('/login');
      } else {
        // --- PHONE VERIFY VIA FIREBASE & RESET VIA BACKEND ---
        const userCredential = await confirmationResult.confirm(otp);
        const firebaseToken = await userCredential.user.getIdToken();

        const res = await axios.post('http://localhost:5000/api/auth/reset-password-phone', {
          firebaseToken,
          newPassword
        });
        alert(res.data.message);
        navigate('/login');
      }
    } catch (err) {
      console.error('Reset Password Error:', err);
      if (!isPhoneReset) {
        setError(err.response?.data?.message || 'Invalid or expired Email OTP!');
      } else {
        setError(err.response?.data?.message || 'Invalid SMS OTP! Please check and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#09090B] text-white flex items-center justify-center p-4">
      {/* Required invisible container for Firebase Phone Auth */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md bg-[#121216] border border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-lg">🔐</div>
          <span className="font-black text-lg tracking-wider">RESET PASSWORD</span>
        </div>

        <p className="text-xs text-zinc-400 mb-6">
          {step === 1
            ? 'Enter your registered Email or Phone Number to receive a 6-digit numeric OTP.'
            : `Enter the 6-digit OTP sent to ${identifier} and set your new password.`}
        </p>

        {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl mb-4">{error}</div>}
        {message && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl mb-4">{message}</div>}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">Email or Phone Number</label>
              <input
                type="text"
                required
                placeholder="you@example.com or 9876543210"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white focus:outline-none"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold text-xs py-3.5 rounded-xl transition-all">
              {loading ? 'Sending OTP...' : 'Send 6-Digit OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">Enter 6-Digit Numeric OTP</label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                placeholder="• • • • • •"
                value={otp}
                onChange={handleOtpChange}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-center text-lg text-cyan-400 tracking-[0.5em] font-mono font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">New Password</label>
              <input
                type="password"
                required
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold text-xs py-3.5 rounded-xl transition-all disabled:opacity-40"
            >
              {loading ? 'Verifying...' : 'Verify 6-Digit OTP & Reset'}
            </button>
          </form>
        )}

        <p className="text-xs text-zinc-400 text-center mt-6">
          Remembered your password? <Link to="/login" className="text-indigo-400 font-bold hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
