import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import EditModal from '../../components/EditModal';
import { usePermissions, PERMISSION_PAGES } from '../../utils/permissions';

const Profile = () => {
  const user = useSelector((state) => state.auth.user);
  const [editOpen, setEditOpen] = useState(false);
  const { canEdit } = usePermissions();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-500">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8 mt-8">
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <img
            src={user.avatarUrl || 'https://via.placeholder.com/120'}
            alt={user.name}
            className="w-28 h-28 rounded-full object-cover border-4 border-gray-200"
          />
        </div>
        <h2 className="mt-4 text-2xl font-semibold">{user.name || 'No Name'}</h2>
        <div className="text-gray-500">{user.role || 'User'}</div>
        {canEdit(PERMISSION_PAGES.PROFILE) ? (
          <button
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            onClick={() => setEditOpen(true)}
          >
            Edit Profile
          </button>
        ) : (
          <div className="mt-4 px-4 py-2 bg-gray-300 text-gray-600 rounded cursor-not-allowed">
            Edit Profile (Permission Required)
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-2 text-sm text-gray-500">Email Address</div>
          <div className="mb-4 text-gray-800">{user.email}</div>
          <div className="mb-2 text-sm text-gray-500">Gender</div>
          <div className="mb-4 text-gray-800">{user.gender || '-'}</div>
          <div className="mb-2 text-sm text-gray-500">Phone Number</div>
          <div className="mb-4 text-gray-800">{user.phone || '-'}</div>
          <div className="mb-2 text-sm text-gray-500">Status</div>
          <div className="mb-4 text-gray-800">{user.status || '-'}</div>
        </div>
        <div>
          <div className="mb-2 text-sm text-gray-500">UID</div>
          <div className="mb-4 text-gray-800 break-all">{user.uid}</div>
          <div className="mb-2 text-sm text-gray-500">NID Number</div>
          <div className="mb-4 text-gray-800">{user.nid || '-'}</div>
          <div className="mb-2 text-sm text-gray-500">Created At</div>
          <div className="mb-4 text-gray-800">{user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}</div>
        </div>
      </div>
      
      {/* Address Section */}
      <div className="mt-6">
        <div className="mb-2 text-sm text-gray-500">Address</div>
        <div className="text-gray-800 p-3 bg-gray-50 rounded-lg">
          {user.address || 'No address provided'}
        </div>
      </div>
      {editOpen && <EditModal open={editOpen} onClose={() => setEditOpen(false)} user={user} />}
    </div>
  );
}

export default Profile;