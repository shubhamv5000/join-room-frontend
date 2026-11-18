import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export default function ProfilePhotoModal({ isOpen, onClose, currentUser, onPhotoUpdated }) {
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const file = fileList.item(0);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPreview(compressedDataUrl);
      };
      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!preview) return alert('Please select an image first!');

    const uid = currentUser?.id || currentUser?._id;
    if (!uid) return alert('User ID missing. Please re-login!');

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/users/update-photo/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePhoto: preview })
      });
      const data = await res.json();

      if (res.ok && data.profilePhoto) {
        if (onPhotoUpdated) onPhotoUpdated(data.profilePhoto);
        setPreview('');
        onClose();
      } else {
        alert(data.message || 'Failed to update photo');
      }
    } catch (err) {
      alert('Network Error: Make sure backend server is running!');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#121624] border border-white/15 rounded-3xl p-6 shadow-2xl text-center">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-5">
          <h3 className="text-sm font-extrabold text-white">📸 Change Profile Photo</h3>
          <button
            onClick={() => {
              setPreview('');
              onClose();
            }}
            className="text-gray-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <img
          src={preview || currentUser?.profilePhoto}
          alt="Preview"
          className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-cyan-400 shadow-lg mb-4"
        />

        <form onSubmit={handleUpload} className="space-y-4">
          <label className="block w-full cursor-pointer bg-white/[0.05] hover:bg-white/[0.1] border border-dashed border-white/20 rounded-2xl py-3 px-4 text-xs text-cyan-300 font-semibold transition-all">
            {preview ? 'Photo Selected ✓ (Click to change)' : 'Choose New Photo'}
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>

          <button
            type="submit"
            disabled={loading || !preview}
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-90 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-40 shadow-lg"
          >
            {loading ? 'Saving...' : 'Save New Photo'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
