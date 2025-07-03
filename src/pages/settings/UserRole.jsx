import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { FaUserShield, FaUser, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useSelector } from 'react-redux';

// Role hierarchy from highest to lowest
const ROLE_HIERARCHY = [
  'super_user',
  'admin',
  'manager',
  'sales_man',
  'stock_boy',
  't_staff',
];

const ROLE_LABELS = {
  super_user: 'Super User',
  admin: 'Admin',
  manager: 'Manager',
  sales_man: 'Sales Man',
  stock_boy: 'Stock Boy',
  t_staff: 'T Staff',
};

const UserRole = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null); // uid of user being updated
  const currentUser = useSelector(state => state.auth.user);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const snap = await getDocs(collection(firestore, 'users'));
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchUsers();
  }, []);

  // Helper: can currentUser manage targetUser and are there valid roles to assign?
  const canShowDropdown = (targetUser) => {
    if (!currentUser || !targetUser) return false;
    if (currentUser.uid === targetUser.uid) return false; // cannot manage self
    const myRank = ROLE_HIERARCHY.indexOf(currentUser.role);
    const theirRank = ROLE_HIERARCHY.indexOf(targetUser.role);
    // Only show if current user is higher in hierarchy and there are valid roles to assign
    const assignable = ROLE_HIERARCHY.slice(myRank + 1).filter(role => ROLE_HIERARCHY.indexOf(role) > theirRank);
    return myRank < theirRank && assignable.length > 0;
  };

  // Helper: which roles can currentUser assign to this targetUser?
  const assignableRolesForUser = (targetUser) => {
    if (!currentUser || !targetUser) return [];
    const myRank = ROLE_HIERARCHY.indexOf(currentUser.role);
    const theirRank = ROLE_HIERARCHY.indexOf(targetUser.role);
    // Only allow roles lower than both current user and target user
    return ROLE_HIERARCHY.slice(myRank + 1).filter(role => ROLE_HIERARCHY.indexOf(role) > theirRank);
  };

  // Handle role change
  const handleRoleChange = async (uid, newRole) => {
    setUpdating(uid);
    try {
      await updateDoc(doc(firestore, 'users', uid), { role: newRole });
      setUsers(users => users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    }
    setUpdating(null);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">User List</h1>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="min-w-full bg-white dark:bg-gray-800">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white">
                <th className="py-3 px-4 text-left">Avatar</th>
                <th className="py-3 px-4 text-left">Name</th>
                <th className="py-3 px-4 text-left">Email</th>
                <th className="py-3 px-4 text-left">Role</th>
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-left">Created At</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.uid || user.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2 px-4">
                    <img
                      src={user.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || user.email || 'User')}
                      alt={user.name || user.email}
                      className="w-10 h-10 rounded-full object-cover border"
                      onError={e => {
                        e.target.onerror = null;
                        e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || user.email || 'User');
                      }}
                    />
                  </td>
                  <td className="py-2 px-4 font-medium text-white dark:text-white">{user.name || <span className="italic">N/A</span>}</td>
                  <td className="py-2 px-4 dark:text-white">{user.email}</td>
                  <td className="py-2 px-4 dark:text-white">
                    {/* Show dropdown only if currentUser can manage this user and there are valid roles, else just show role */}
                    {canShowDropdown(user) ? (
                      <select
                        className="bg-gray-700 text-white rounded px-2 py-1"
                        value={user.role}
                        disabled={updating === user.uid}
                        onChange={e => handleRoleChange(user.uid, e.target.value)}
                      >
                        <option value={user.role}>{ROLE_LABELS[user.role] || user.role}</option>
                        {assignableRolesForUser(user).map(role => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="flex items-center gap-2">
                        {user.role === 'super_user' ? <FaUserShield className="text-blue-500" title="Super User" /> : <FaUser className="text-gray-500" title="User" />}
                        <span className="capitalize">{ROLE_LABELS[user.role] || user.role}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    {user.status === 'verified' ? (
                      <span className="flex items-center gap-1 text-green-600"><FaCheckCircle /> Verified</span>
                    ) : user.status ? (
                      <span className="flex items-center gap-1 text-yellow-600"><FaTimesCircle /> {user.status}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-sm text-gray-500 dark:text-gray-300">
                    {user.createdAt ? new Date(user.createdAt).toLocaleString() : <span className="text-gray-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UserRole;