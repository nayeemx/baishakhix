import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { toast } from 'react-toastify';
import AppLoader from '../../components/AppLoader';

const roleHierarchy = [
  'super_user',
  'admin',
  'manager',
  'sales_man',
  'stock_boy',
  't_staff',
  'user'
];

const roles = [
  { value: 'super_user', label: 'Super User' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales_man', label: 'Sales Man' },
  { value: 'stock_boy', label: 'Stock Boy' },
  { value: 't_staff', label: 'T Staff' },
  { value: 'user', label: 'User' }
];

// Synced with SideNavbar.jsx menuKeyMap/menuItemsRaw
const pages = [
  // Dashboard
  { key: "Dashboard", label: "Dashboard" },

  // Report
  { key: "SaleReport", label: "Sale Report" },
  { key: "AdminSaleReport", label: "Admin Sale Report" },
  { key: "PurchaseReport", label: "Purchase Report" },

  // Inventory
  { key: "ProductList", label: "Product List" },
  { key: "AddProduct", label: "Add Product" },
  { key: "PrintBarcode", label: "Print Barcode" },
  { key: "OldProduct", label: "Old Product" },
  { key: "BarcodeHistory", label: "Barcode History" },
  { key: "ManualStocks", label: "Manual Stock Import" },

  // Expenses
  { key: "ExpenseList", label: "Expense List" },

  // People
  { key: "CustomerList", label: "Customer List" },
  { key: "SupplierList", label: "Supplier List" },

  // Adjustment
  { key: "SupplierReturn", label: "Supplier Return" },
  { key: "CustomerReturn", label: "Customer Return" },
  { key: "DumpProduct", label: "Dump Product" },

  // Staff
  { key: "Attendance", label: "Attendance" },
  { key: "Leave", label: "Leave" },
  { key: "Salary", label: "Salary" },

  // Tools
  { key: "ToDo", label: "To-Do List" },
  { key: "KanBan", label: "KanBan Board" },
  { key: "Upload", label: "Data Upload/Convert" },
  { key: "Database", label: "Database Tools" },
  { key: "ManualStocks", label: "Manual Stock Import" },
  { key: "FileManager", label: "File Manager" },
  { key: "Faker", label: "Data Faker/Generator" },

  // Approvals
  { key: "LeaveApproval", label: "Leave Approval" },
  { key: "ResetApproval", label: "Reset Approval" },

  // Settings
  { key: "Profile", label: "Profile" },
  { key: "UserRole", label: "User Role" },
  { key: "Logs", label: "Logs" },

  // Other (add any additional keys as needed)
  { key: "CustomerDue", label: "Customer Due" },
  { key: "CustomerAdjustment", label: "Customer Adjustment" },
  { key: "CustomerExchange", label: "Customer Exchange" },
  { key: "ViewSupplier", label: "View Supplier" },
  { key: "SupplierAdjustment", label: "Supplier Adjustment" },
  { key: "SupplierTransaction", label: "Supplier Transaction" },
  { key: "SalaryManagement", label: "Salary Management" },
  { key: "AttendanceManagement", label: "Attendance Management" },
  { key: "AdminSalaryDashboard", label: "Admin Salary Dashboard" },
  { key: "SalarySettings", label: "Salary Settings" },
  { key: "SalaryTransactionHistory", label: "Salary Transaction History" },
  { key: "AttendanceEdit", label: "Attendance Edit" },
  { key: "AttendanceModal", label: "Attendance Modal" },
  { key: "Invoice", label: "Invoice" },
  { key: "PaymentForm", label: "Payment Form" },
  { key: "PosCart", label: "POS Cart" },
  { key: "PosProduct", label: "POS Product" },
  { key: "CameraScanner", label: "Camera Scanner" },
  { key: "CodeScanner", label: "Code Scanner" },
  { key: "QrCode", label: "QR Code" },
  { key: "Show_Qrdata", label: "Show QR Data" },
  { key: "UnitList", label: "Unit List" },
  { key: "AddUnit", label: "Add Unit" },
  { key: "EditUnit", label: "Edit Unit" },
  { key: "OldunitList", label: "Old Unit List" },
  { key: "AddoldUnit", label: "Add Old Unit" },
  { key: "EditoldUnit", label: "Edit Old Unit" },
  { key: "AddoldProductModal", label: "Add Old Product Modal" },
  { key: "EditOldProductModal", label: "Edit Old Product Modal" },
  { key: "ViewOldProductModal", label: "View Old Product Modal" },
  { key: "AdjustmentDelete", label: "Adjustment Delete" },
  { key: "GenericDeleteComponent", label: "Generic Delete Component" },
  { key: "ProtectedRoute", label: "Protected Route" },
  { key: "AppLoader", label: "App Loader" },
  { key: "Loader", label: "Loader" },
  { key: "Footer", label: "Footer" },
  { key: "Header", label: "Header" },
  { key: "SideNavbar", label: "Side Navbar" },
  { key: "TiptapEditor", label: "Tiptap Editor" },
  { key: "LintedEditorWrapper", label: "Linted Editor Wrapper" },
  { key: "UnderConstruction", label: "Under Construction" },
  { key: "NotFoundPage", label: "Not Found Page" },
  { key: "AttendanceModal", label: "Attendance Modal" },
  { key: "Profile", label: "Profile" },
  { key: "FileManager", label: "File Manager" },
  { key: "Database", label: "Database Tools" },
  { key: "Upload", label: "Data Upload/Convert" },
  { key: "Faker", label: "Data Faker/Generator" },
  { key: "KanBan", label: "KanBan Board" },
  { key: "ToDo", label: "To-Do List" },
  { key: "POS", label: "POS" },
  { key: "Invoice", label: "Invoice" },
  { key: "PaymentForm", label: "Payment Form" },
  { key: "PosCart", label: "POS Cart" },
  { key: "PosProduct", label: "POS Product" },
  { key: "CameraScanner", label: "Camera Scanner" },
  { key: "CodeScanner", label: "Code Scanner" },
  { key: "QrCode", label: "QR Code" },
  { key: "Show_Qrdata", label: "Show QR Data" },
  { key: "UnitList", label: "Unit List" },
  { key: "AddUnit", label: "Add Unit" },
  { key: "EditUnit", label: "Edit Unit" },
  { key: "OldunitList", label: "Old Unit List" },
  { key: "AddoldUnit", label: "Add Old Unit" },
  { key: "EditoldUnit", label: "Edit Old Unit" },
  { key: "AddoldProductModal", label: "Add Old Product Modal" },
  { key: "EditOldProductModal", label: "Edit Old Product Modal" },
  { key: "ViewOldProductModal", label: "View Old Product Modal" },
  { key: "AdjustmentDelete", label: "Adjustment Delete" },
  { key: "GenericDeleteComponent", label: "Generic Delete Component" },
  { key: "ProtectedRoute", label: "Protected Route" },
  { key: "AppLoader", label: "App Loader" },
  { key: "Loader", label: "Loader" },
  { key: "Footer", label: "Footer" },
  { key: "Header", label: "Header" },
  { key: "SideNavbar", label: "Side Navbar" },
  { key: "TiptapEditor", label: "Tiptap Editor" },
  { key: "LintedEditorWrapper", label: "Linted Editor Wrapper" },
  { key: "UnderConstruction", label: "Under Construction" },
  { key: "NotFoundPage", label: "Not Found Page" },
];
const actions = ["create", "edit", "delete"];

const UserRole = () => {
  const currentUser = useSelector((state) => state.auth.user);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  // Menu Access Modal State
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuUser, setMenuUser] = useState(null);
  const [menuDraft, setMenuDraft] = useState([]);
  // Button Control Modal State (for super_user)
  const [showButtonControl, setShowButtonControl] = useState(false);
  const [buttonAccessDraft, setButtonAccessDraft] = useState([]); // [{id, manage, menu}]
  const [savingButtonAccess, setSavingButtonAccess] = useState(false);

  // Open Button Control Modal
  const openButtonControl = () => {
    // Prepare draft: all users except super_user
    setButtonAccessDraft(
      users
        .filter(u => u.role !== 'super_user')
        .map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          manage: u.buttonAccess?.manage ?? true,
          menu: u.buttonAccess?.menu ?? true
        }))
    );
    setShowButtonControl(true);
  };
  const closeButtonControl = () => {
    setShowButtonControl(false);
    setButtonAccessDraft([]);
  };
  const handleButtonAccessChange = (userId, key, checked) => {
    setButtonAccessDraft(prev =>
      prev.map(u =>
        u.id === userId ? { ...u, [key]: checked } : u
      )
    );
  };
  const saveButtonAccess = async () => {
    setSavingButtonAccess(true);
    try {
      // Update each user in Firestore
      await Promise.all(
        buttonAccessDraft.map(u =>
          updateDoc(doc(firestore, 'users', u.id), {
            buttonAccess: { manage: u.manage, menu: u.menu }
          })
        )
      );
      // Update local state
      setUsers(prev =>
        prev.map(u => {
          const found = buttonAccessDraft.find(bu => bu.id === u.id);
          return found ? { ...u, buttonAccess: { manage: found.manage, menu: found.menu } } : u;
        })
      );
      toast.success('Button access updated!');
      closeButtonControl();
    } catch (err) {
      toast.error('Failed to update button access: ' + err.message);
    } finally {
      setSavingButtonAccess(false);
    }
  };
  // Menu Modal Handlers
  const openMenuModal = (user) => {
    setMenuUser(user);
    setMenuDraft(user.allowedMenus || []);
    setShowMenuModal(true);
  };
  const closeMenuModal = () => {
    setShowMenuModal(false);
    setMenuUser(null);
    setMenuDraft([]);
  };
  const handleMenuChange = (menuKey, checked) => {
    setMenuDraft(prev =>
      checked ? [...prev, menuKey] : prev.filter(key => key !== menuKey)
    );
  };
  const saveMenus = async () => {
    if (!menuUser) return;
    setSavingPermissions(true);
    try {
      await updateDoc(doc(firestore, 'users', menuUser.id), {
        allowedMenus: menuDraft,
      });
      toast.success("Menu access updated!");
      setUsers(prev =>
        prev.map(u =>
          u.id === menuUser.id ? { ...u, allowedMenus: menuDraft } : u
        )
      );
      closeMenuModal();
    } catch (err) {
      toast.error("Failed to update menu access: " + err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  // Check if current user has permission to manage roles
  const canManageRoles = currentUser && roleHierarchy.indexOf(currentUser.role) >= 0 && currentUser.role !== 'user';
  const currentUserRoleIndex = roleHierarchy.indexOf(currentUser?.role);

  // Helper function to check if current user can manage a specific user
  const canManageUser = (targetUser) => {
    if (!targetUser || !currentUser) return false;
    const targetUserRoleIndex = roleHierarchy.indexOf(targetUser.role || 'user');
    return targetUserRoleIndex > currentUserRoleIndex;
  };

  // Fetch all users from Firestore
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersCollection = collection(firestore, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Update user role
  const updateUserRole = async (userId, newRole) => {
    // Check permissions
    if (!canManageRoles) {
      toast.error('You do not have permission to manage user roles');
      return;
    }

    // Prevent changing your own role
    if (userId === currentUser?.uid) {
      toast.error('You cannot change your own role');
      return;
    }

    // Get the target user's current role
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      toast.error('User not found');
      return;
    }

    const targetUserRoleIndex = roleHierarchy.indexOf(targetUser.role || 'user');

    // CRITICAL FIX: Prevent changing roles of users with higher or equal role
    if (targetUserRoleIndex <= currentUserRoleIndex) {
      toast.error('You cannot change the role of users with higher or equal role than yours.');
      return;
    }

    // Prevent assigning super_user to anyone
    if (newRole === 'super_user') {
      toast.error('You cannot assign the Super User role to anyone.');
      return;
    }

    // Prevent assigning a role higher than your own
    if (roleHierarchy.indexOf(newRole) < currentUserRoleIndex) {
      toast.error('You cannot assign a role higher than your own.');
      return;
    }

    try {
      setUpdating(prev => ({ ...prev, [userId]: true }));
      const userDocRef = doc(firestore, 'users', userId);
      await updateDoc(userDocRef, { role: newRole });
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
      toast.success('User role updated successfully');
    } catch (error) {
      console.error('Error updating user role:', error);
      if (error.code === 'permission-denied') {
        toast.error('Permission denied. Only higher roles can manage lower roles.');
      } else if (error.message.includes('Missing or insufficient permissions')) {
        toast.error('Insufficient permissions. Please check your Firestore security rules.');
      } else {
        toast.error('Failed to update user role: ' + error.message);
      }
    } finally {
      setUpdating(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Handle role change
  const handleRoleChange = (userId, newRole) => {
    updateUserRole(userId, newRole);
  };

  const openPermissionModal = (user) => {
    // CRITICAL FIX: Check if current user can manage this user's permissions
    const targetUserRoleIndex = roleHierarchy.indexOf(user.role || 'user');
    
    if (targetUserRoleIndex <= currentUserRoleIndex) {
      toast.error('You cannot manage permissions for users with higher or equal role than yours.');
      return;
    }

    setSelectedUser(user);
    setPermissionDraft(user.permissions || {});
    setShowPermissionModal(true);
  };

  const closePermissionModal = () => {
    setShowPermissionModal(false);
    setSelectedUser(null);
    setPermissionDraft({});
  };

  const handlePermissionChange = (pageKey, action, checked) => {
    setPermissionDraft(prev => ({
      ...prev,
      [pageKey]: {
        ...prev[pageKey],
        [action]: checked
      }
    }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSavingPermissions(true);
    try {
      await updateDoc(doc(firestore, 'users', selectedUser.id), {
        permissions: permissionDraft
      });
      toast.success("Permissions updated!");
      setUsers(prev =>
        prev.map(u =>
          u.id === selectedUser.id ? { ...u, permissions: permissionDraft } : u
        )
      );
      closePermissionModal();
    } catch (err) {
      toast.error("Failed to update permissions: " + err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) {
    return <AppLoader />;
  }

  if (!canManageRoles) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-700">
            You do not have permission to manage user roles. Only privileged users can access this feature.
          </p>
          <p className="text-red-600 mt-2">
            Your current role: <span className="font-semibold">{currentUser?.role || 'Unknown'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 w-[100vw] xl:w-[82vw]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">User Role Management</h1>
        <p className="text-gray-600 mt-2">Manage user roles and permissions</p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Note:</strong> You can only manage users with lower roles than yours. You cannot change your own role or manage users with equal or higher roles.
          </p>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img 
                          className="h-10 w-10 rounded-full" 
                          src={user.avatarUrl || 'https://via.placeholder.com/40'} 
                          alt={user.name}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name}
                          {user.id === currentUser?.uid && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              You
                            </span>
                          )}
                          {!canManageUser(user) && user.id !== currentUser?.uid && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Higher Role
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.gender && `${user.gender}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                    <div className="text-sm text-gray-500">
                      {user.emailVerified ? '✓ Verified' : '✗ Not Verified'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.status === 'verified' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role || 'user'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={
                        updating[user.id] || 
                        user.id === currentUser?.uid ||
                        roleHierarchy.indexOf(user.role || 'user') <= currentUserRoleIndex
                      }
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                        (updating[user.id] || user.id === currentUser?.uid || roleHierarchy.indexOf(user.role || 'user') <= currentUserRoleIndex) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {roles
                        .filter(role =>
                          // Never allow assigning super_user to anyone
                          role.value !== 'super_user' &&
                          // Only allow roles at or below your own level
                          roleHierarchy.indexOf(role.value) >= currentUserRoleIndex
                        )
                        .map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                    </select>
                    {updating[user.id] && (
                      <div className="mt-1">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 inline-block"></div>
                        <span className="ml-2 text-xs text-gray-500">Updating...</span>
                      </div>
                    )}
                    {user.id === currentUser?.uid && (
                      <div className="mt-1">
                        <span className="text-xs text-gray-500">Cannot change your own role</span>
                      </div>
                    )}
                    {roleHierarchy.indexOf(user.role || 'user') <= currentUserRoleIndex && user.id !== currentUser?.uid && (
                      <div className="mt-1">
                        <span className="text-xs text-red-500">Cannot change higher/equal role</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Button logic: super_user can see for all except self; others only for themselves. Now controlled by buttonAccess. */}
                    {user.role === "super_user" && user.id === currentUser?.uid && (
                      <>
                        <span className="text-xs text-gray-400 mr-2">All Access</span>
                        <button
                          className="bg-purple-600 text-white px-3 py-1 rounded"
                          onClick={openButtonControl}
                        >
                          Button Control
                        </button>
                      </>
                    )}
                    {user.role !== "super_user" && (
                      <>
                        {/* super_user: can manage all except self */}
                        {currentUser?.role === "super_user" && user.id !== currentUser?.uid && (
                          <>
                            {user.buttonAccess?.manage !== false && (
                              <button
                                className="bg-blue-500 text-white px-3 py-1 rounded mr-2"
                                onClick={() => openPermissionModal(user)}
                              >
                                Manage
                              </button>
                            )}
                            {user.buttonAccess?.menu !== false && (
                              <button
                                className="bg-green-500 text-white px-3 py-1 rounded"
                                onClick={() => openMenuModal(user)}
                              >
                                Menu Access
                              </button>
                            )}
                            {user.buttonAccess?.manage === false && user.buttonAccess?.menu === false && (
                              <span className="text-xs text-gray-400">No Permission</span>
                            )}
                          </>
                        )}
                        {/* non-super_user: can manage lower roles only (not self, not equal/higher) */}
                        {currentUser?.role !== "super_user" && user.id !== currentUser?.uid && canManageUser(user) && (
                          <>
                            {user.buttonAccess?.manage !== false && (
                              <button
                                className="bg-blue-500 text-white px-3 py-1 rounded mr-2"
                                onClick={() => openPermissionModal(user)}
                              >
                                Manage
                              </button>
                            )}
                            {user.buttonAccess?.menu !== false && (
                              <button
                                className="bg-green-500 text-white px-3 py-1 rounded"
                                onClick={() => openMenuModal(user)}
                              >
                                Menu Access
                              </button>
                            )}
                            {user.buttonAccess?.manage === false && user.buttonAccess?.menu === false && (
                              <span className="text-xs text-gray-400">No Permission</span>
                            )}
                          </>
                        )}
                        {/* All other cases: No Permission */}
                        {currentUser?.role !== "super_user" && (user.id === currentUser?.uid || !canManageUser(user)) && (
                          <span className="text-xs text-gray-400">No Permission</span>
                        )}
                      </>
                    )}
      {/* --- Button Control Modal (Super User) --- */}
      {showButtonControl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">Button Access Control</h2>
            <table className="min-w-full mb-4">
              <thead>
                <tr>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-center p-2">Manage</th>
                  <th className="text-center p-2">Menu Access</th>
                </tr>
              </thead>
              <tbody>
                {buttonAccessDraft.map(u => (
                  <tr key={u.id}>
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="text-center p-2">
                      <input
                        type="checkbox"
                        checked={u.manage}
                        onChange={e => handleButtonAccessChange(u.id, 'manage', e.target.checked)}
                      />
                    </td>
                    <td className="text-center p-2">
                      <input
                        type="checkbox"
                        checked={u.menu}
                        onChange={e => handleButtonAccessChange(u.id, 'menu', e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 rounded"
                onClick={closeButtonControl}
                disabled={savingButtonAccess}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded"
                onClick={saveButtonAccess}
                disabled={savingButtonAccess}
              >
                {savingButtonAccess ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
                  </td>
      {/* --- Menu Access Modal --- */}
      {showMenuModal && menuUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[96vw] max-w-lg h-[96vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">
              Menu Access for {menuUser.name}
            </h2>
            <div className="mb-6">
              <div className="flex flex-wrap gap-3">
                {pages.map(page => (
                  <label key={page.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={menuDraft.includes(page.key)}
                      onChange={e => handleMenuChange(page.key, e.target.checked)}
                    />
                    <span>{page.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 rounded"
                onClick={closeMenuModal}
                disabled={savingPermissions}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded"
                onClick={saveMenus}
                disabled={savingPermissions}
              >
                {savingPermissions ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p>Total Users: {users.length}</p>
        <p>Current User: {currentUser?.name} ({currentUser?.role})</p>
      </div>

      {showPermissionModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[96vw] max-w-4xl h-[94vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">
              Manage Permissions for {selectedUser.name}
            </h2>
            <table className="min-w-full mb-4">
              <thead>
                <tr>
                  <th className="text-left p-2">Page</th>
                  {actions.map(a => (
                    <th key={a} className="text-center p-2 capitalize">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map(page => (
                  <tr key={page.key}>
                    <td className="p-2">{page.label}</td>
                    {actions.map(action => (
                      <td key={action} className="text-center p-2">
                        <input
                          type="checkbox"
                          checked={!!permissionDraft?.[page.key]?.[action]}
                          onChange={e =>
                            handlePermissionChange(page.key, action, e.target.checked)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 rounded"
                onClick={closePermissionModal}
                disabled={savingPermissions}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={savePermissions}
                disabled={savingPermissions}
              >
                {savingPermissions ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRole;