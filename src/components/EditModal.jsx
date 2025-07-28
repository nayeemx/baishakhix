import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { doc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { firestore, auth } from '../firebase/firebase.config';
import { setUser } from '../redux/features/authSlice';
import { FaCamera, FaEye, FaEyeSlash, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { usePermissions, PERMISSION_PAGES } from '../utils/permissions';

const EditModal = ({ open, onClose, user }) => {
  const dispatch = useDispatch();
  const darkMode = useSelector((state) => state.theme.darkMode);
  const { canEdit } = usePermissions();
  
  const [form, setForm] = useState({
    name: user?.name || '',
    gender: user?.gender || '',
    phone: user?.phone || '',
    address: user?.address || '',
    nid: user?.nid || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Password validation rules
  const passwordRules = [
    { label: "At least 8 characters", test: v => v.length >= 8 },
    { label: "At least one uppercase letter", test: v => /[A-Z]/.test(v) },
    { label: "At least one lowercase letter", test: v => /[a-z]/.test(v) },
    { label: "At least one number", test: v => /\d/.test(v) },
    { label: "At least one symbol", test: v => /[^A-Za-z0-9]/.test(v) },
  ];

  const newPasswordChecks = passwordRules.map(rule => rule.test(form.newPassword));
  const newPasswordValid = newPasswordChecks.every(Boolean);

  const handleChange = (e) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleOpenCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error('Unable to access camera');
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], "profile.png", { type: "image/png" });
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(blob));
      setShowCamera(false);
      cameraStream && cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }, 'image/png');
  };

  const uploadImageToImageBB = async (imageFile, uid) => {
    if (!imageFile) return null;
    
    const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;
    const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";
    
    const formData = new FormData();
    formData.append("key", IMGBB_API_KEY);
    formData.append("image", imageFile);
    formData.append("name", `baishakhi/avatar/${uid}_${Date.now()}`);
    
    try {
      const response = await fetch(IMGBB_UPLOAD_URL, { 
        method: 'POST', 
        body: formData 
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Image upload failed: ${errorText}`);
      }
      
      const result = await response.json();
      if (result && result.data && result.data.url) {
        return result.data.url;
      } else {
        throw new Error("Image upload successful, but URL not found in response.");
      }
    } catch (error) {
      console.error("Error during ImageBB upload:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      let avatarUrl = user?.avatarUrl;

      // Upload new avatar if selected
      if (avatarFile) {
        try {
          avatarUrl = await uploadImageToImageBB(avatarFile, currentUser.uid);
        } catch (uploadError) {
          toast.error('Failed to upload image. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Update Firestore user document
      const userDocRef = doc(firestore, "users", currentUser.uid);
      const updateData = {
        name: form.name,
        gender: form.gender,
        phone: form.phone,
        address: form.address,
        nid: form.nid,
        avatarUrl: avatarUrl,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userDocRef, updateData);

      // Note: Firebase Auth profile update is skipped to avoid read-only property errors
      // The profile will be updated through the existing auth state sync mechanism

      // Update Redux state
      const updatedUser = {
        ...user,
        ...updateData
      };
      dispatch(setUser(updatedUser));

      toast.success('Profile updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    
    if (!form.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (!newPasswordValid) {
      toast.error('New password does not meet requirements');
      return;
    }

    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(currentUser.email, form.currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password in Firebase Auth
      await updatePassword(currentUser, form.newPassword);

      toast.success('Password updated successfully!');
      
      // Clear password fields
      setForm(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect');
      } else if (error.code === 'auth/requires-recent-login') {
        toast.error('Please log out and log back in to change your password');
      } else {
        toast.error(error.message || 'Failed to update password');
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if user has permission to edit profile
  if (!canEdit(PERMISSION_PAGES.PROFILE)) {
    toast.error('You do not have permission to edit your profile');
    onClose();
    return null;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
      }`}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile Image Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <img
                src={avatarPreview || 'https://via.placeholder.com/120'}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
              />
              <div className="absolute bottom-0 right-0 flex space-x-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600"
                >
                  <FaCamera size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600"
                >
                  📷
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Camera Modal */}
          {showCamera && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white p-4 rounded-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  className="w-96 h-72 object-cover rounded"
                />
                <div className="flex justify-center space-x-4 mt-4">
                  <button
                    type="button"
                    onClick={handleCapture}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCamera(false);
                      cameraStream && cameraStream.getTracks().forEach(track => track.stop());
                      setCameraStream(null);
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Profile Information Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-lg ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Gender</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-lg ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+880 1XXX XXX XXX"
                  className={`w-full p-3 border rounded-lg ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">NID Number</label>
                <input
                  type="text"
                  name="nid"
                  value={form.nid}
                  onChange={handleChange}
                  placeholder="National ID Number"
                  className={`w-full p-3 border rounded-lg ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows="3"
                placeholder="Enter your full address"
                className={`w-full p-3 border rounded-lg ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300'
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-6 border-t">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Password Change Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Change Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    name="currentPassword"
                    value={form.currentPassword}
                    onChange={handleChange}
                    placeholder="Enter your current password"
                    className={`w-full p-3 pr-10 border rounded-lg ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="Enter new password"
                    className={`w-full p-3 pr-10 border rounded-lg ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {form.newPassword && (
                  <ul className="mt-2 text-sm">
                    {passwordRules.map((rule, i) => (
                      <li key={rule.label} className={newPasswordChecks[i] ? "text-green-600" : "text-red-600"}>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm new password"
                    className={`w-full p-3 pr-10 border rounded-lg ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePasswordChange}
                disabled={loading || !form.currentPassword || !form.newPassword || !form.confirmPassword || !newPasswordValid}
                className="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditModal; 