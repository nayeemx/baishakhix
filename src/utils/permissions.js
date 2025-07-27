// Permission utility for checking user access based on UserRole settings
import { useSelector } from 'react-redux';

// Define the pages that have permissions
export const PERMISSION_PAGES = {
  PRODUCT_LIST: 'ProductList',
  CUSTOMER_LIST: 'CustomerList', 
  SUPPLIER_LIST: 'SupplierList',
  EXPENSE_LIST: 'ExpenseList'
};

// Define the actions that can be performed
export const PERMISSION_ACTIONS = {
  CREATE: 'create',
  EDIT: 'edit', 
  DELETE: 'delete'
};

// Role hierarchy for fallback permissions
const ROLE_HIERARCHY = [
  'super_user',
  'admin', 
  'manager',
  'sales_man',
  'stock_boy',
  't_staff',
  'user'
];

/**
 * Check if user has permission for a specific action on a specific page
 * @param {Object} user - User object from Redux state
 * @param {string} pageKey - Page key (e.g., 'ProductList', 'CustomerList')
 * @param {string} action - Action (e.g., 'create', 'edit', 'delete')
 * @returns {boolean} - Whether user has permission
 */
export const hasPermission = (user, pageKey, action) => {
  // Super users have all permissions
  if (user?.role === 'super_user') {
    return true;
  }

  // If user has no role, they have no permissions
  if (!user?.role) {
    return false;
  }

  // Check if user has specific permissions set
  if (user?.permissions && user.permissions[pageKey]) {
    return user.permissions[pageKey][action] === true;
  }

  // Fallback: Use role-based permissions
  return hasRoleBasedPermission(user.role, pageKey, action);
};

/**
 * Fallback role-based permission system
 * @param {string} role - User role
 * @param {string} pageKey - Page key
 * @param {string} action - Action
 * @returns {boolean} - Whether user has permission
 */
const hasRoleBasedPermission = (role, pageKey, action) => {
  const roleIndex = ROLE_HIERARCHY.indexOf(role);
  
  // Users with role 'user' have no permissions by default
  if (roleIndex === -1 || role === 'user') {
    return false;
  }

  // Admin and manager have all permissions except super_user specific ones
  if (role === 'admin' || role === 'manager') {
    return true;
  }

  // Sales man can create and edit products, view customers and suppliers
  if (role === 'sales_man') {
    if (pageKey === PERMISSION_PAGES.PRODUCT_LIST) {
      return action === PERMISSION_ACTIONS.CREATE || action === PERMISSION_ACTIONS.EDIT;
    }
    if (pageKey === PERMISSION_PAGES.CUSTOMER_LIST || pageKey === PERMISSION_PAGES.SUPPLIER_LIST) {
      return action === PERMISSION_ACTIONS.CREATE || action === PERMISSION_ACTIONS.EDIT;
    }
    return false;
  }

  // Stock boy can only view and edit products
  if (role === 'stock_boy') {
    if (pageKey === PERMISSION_PAGES.PRODUCT_LIST) {
      return action === PERMISSION_ACTIONS.EDIT;
    }
    return false;
  }

  // T staff can view products and customers
  if (role === 't_staff') {
    if (pageKey === PERMISSION_PAGES.PRODUCT_LIST || pageKey === PERMISSION_PAGES.CUSTOMER_LIST) {
      return action === PERMISSION_ACTIONS.CREATE || action === PERMISSION_ACTIONS.EDIT;
    }
    return false;
  }

  return false;
};

/**
 * Hook to get current user permissions
 * @returns {Object} - User permissions object
 */
export const usePermissions = () => {
  const user = useSelector(state => state.auth?.user);
  
  return {
    user,
    hasPermission: (pageKey, action) => hasPermission(user, pageKey, action),
    canCreate: (pageKey) => hasPermission(user, pageKey, PERMISSION_ACTIONS.CREATE),
    canEdit: (pageKey) => hasPermission(user, pageKey, PERMISSION_ACTIONS.EDIT),
    canDelete: (pageKey) => hasPermission(user, pageKey, PERMISSION_ACTIONS.DELETE),
    isSuperUser: user?.role === 'super_user',
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager'
  };
};

/**
 * Get permission status for all actions on a page
 * @param {Object} user - User object
 * @param {string} pageKey - Page key
 * @returns {Object} - Permission status for all actions
 */
export const getPagePermissions = (user, pageKey) => {
  return {
    create: hasPermission(user, pageKey, PERMISSION_ACTIONS.CREATE),
    edit: hasPermission(user, pageKey, PERMISSION_ACTIONS.EDIT),
    delete: hasPermission(user, pageKey, PERMISSION_ACTIONS.DELETE)
  };
}; 