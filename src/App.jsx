import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nexusUser');
    return saved ? JSON.parse(saved) : null;
  });

  const handleSetUser = (userData) => {
    setUser(userData);
    if (userData) localStorage.setItem('nexusUser', JSON.stringify(userData));
    else localStorage.removeItem('nexusUser');
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login setUser={handleSetUser} />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={user ? <Dashboard currentUser={user} setUser={handleSetUser} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
