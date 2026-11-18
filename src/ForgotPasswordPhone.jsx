import React, { useState } from "react";
import { auth } from "./firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const ForgotPasswordPhone = () => {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: New Password
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [firebaseToken, setFirebaseToken] = useState("");
  const [loading, setLoading] = useState(false);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
  };

  // Step 1: Send OTP directly via Firebase (NOT localhost:5000)
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (phone.length < 10) return alert("Please enter a valid 10-digit phone number.");

    setLoading(true);
    setupRecaptcha();
    const appVerifier = window.recaptchaVerifier;
    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

    try {
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setStep(2);
      alert("OTP sent successfully!");
    } catch (error) {
      console.error("Firebase OTP Error:", error.code, error.message);
      alert("Failed to send OTP: " + error.code);
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP via Firebase
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return alert("Please enter the OTP.");

    setLoading(true);
    try {
      const res = await confirmationResult.confirm(otp);
      const token = await res.user.getIdToken();
      setFirebaseToken(token);
      setStep(3);
    } catch (error) {
      alert("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Send Verified Token + New Password to your Backend
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return alert("Password must be at least 6 characters.");

    setLoading(true);
    try {
      // Notice the exact URL: /api/reset-password-phone
      const response = await fetch("http://localhost:5000/api/reset-password-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseToken: firebaseToken,
          newPassword: newPassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert("Password reset successfully! Please login.");
      } else {
        alert(data.message || "Failed to reset password.");
      }
    } catch (error) {
      alert("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Reset Password via Phone</h2>
      <div id="recaptcha-container"></div>

      {step === 1 && (
        <form onSubmit={handleSendOtp}>
          <input
            type="tel"
            placeholder="Enter 10-digit phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", margin: "10px 0" }}
          />
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px" }}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyOtp}>
          <input
            type="text"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", margin: "10px 0" }}
          />
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px" }}>
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleResetPassword}>
          <input
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", margin: "10px 0" }}
          />
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px" }}>
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>
      )}
    </div>
  );
};

export default ForgotPasswordPhone;
