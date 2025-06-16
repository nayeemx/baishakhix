import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as FaIcons from 'react-icons/fa'
import Logo from '../assets/logo.png'
import { useSelector } from 'react-redux'

const SideNavbar = ({ isMobileMenuOpen, closeMobileMenu }) => {
  const [openMenu, setOpenMenu] = useState(null)
  const location = useLocation()
  const darkMode = useSelector((state) => state.theme.darkMode)
  const { user } = useSelector((state) => state.auth)

  const handleMenuClick = (itemName) => {
    setOpenMenu(openMenu === itemName ? null : itemName)
  }

  const menuItems = [
    { name: 'Dashboard', icon: FaIcons.FaHome, path: '/dashboard' },
    ...(user?.role === 'super_user'
      ? [
          {
            name: 'POS',
            icon: FaIcons.FaCashRegister,
            path: '/pos',
            className: 'block md:hidden',
          },
        ]
      : []),
    {
      name: 'Approvals',
      icon: FaIcons.FaCheckCircle,
      children: [
        { name: 'Leave Approval', icon: FaIcons.FaCalendarAlt, path: '/approvals/leave' },
        { name: 'Reset Approval', icon: FaIcons.FaHistory, path: '/settings/reset-approval' },
      ],
    },
    {
      name: 'Report',
      icon: FaIcons.FaChartLine,
      children: [
        { name: 'Sale Report', icon: FaIcons.FaShoppingCart, path: '/report/sale-report' },
      ],
    },
    {
      name: 'Inventory',
      icon: FaIcons.FaBox,
      children: [
        { name: 'Product List', icon: FaIcons.FaList, path: '/inventory/products' },
        { name: 'Add Product', icon: FaIcons.FaPlusSquare, path: '/inventory/add-product' },
        { name: 'Print Barcode', icon: FaIcons.FaBarcode, path: '/inventory/barcode' },
        { name: 'Old Product', icon: FaIcons.FaArchive, path: '/inventory/old-product' },
      ],
    },
    { name: 'Expenses', icon: FaIcons.FaMoneyBillWave, path: '/expenses' },
    {
      name: 'People',
      icon: FaIcons.FaUsers,
      children: [
        { name: 'Customers', icon: FaIcons.FaUserTie, path: '/people/customers' },
        { name: 'Suppliers', icon: FaIcons.FaTruck, path: '/people/suppliers' },
      ],
    },
    {
      name: 'Adjustment',
      icon: FaIcons.FaSyncAlt,
      children: [
        { name: 'Supplier Return', icon: FaIcons.FaTruckLoading, path: '/adjustment/supplier-return' },
        { name: 'Customer Return', icon: FaIcons.FaShoppingCart, path: '/adjustment/customer-return' },
        { name: 'Dump Product', icon: FaIcons.FaTrashAlt, path: '/adjustment/dump-product' },
      ],
    },
    {
      name: 'Staff',
      icon: FaIcons.FaBriefcase,
      children: [
        { name: 'Attendance', icon: FaIcons.FaClock, path: '/staff/attendance' },
        { name: 'Leave', icon: FaIcons.FaCalendarMinus, path: '/staff/leave' },
        { name: 'Salary', icon: FaIcons.FaMoneyCheckAlt, path: '/staff/salary' },
      ],
    },
    {
      name: 'Tools',
      icon: FaIcons.FaTools,
      children: [
        { name: 'Todo', icon: FaIcons.FaTasks, path: '/tools/todo' },
        { name: 'Kanban', icon: FaIcons.FaTrello, path: '/tools/kanban' },
        { name: 'Upload', icon: FaIcons.FaCloudUploadAlt, path: '/tools/upload' },
        { name: 'Database', icon: FaIcons.FaDatabase, path: '/tools/database' },
      ],
    },
    {
      name: 'Settings',
      icon: FaIcons.FaCog,
      children: [
        { name: 'Profile', icon: FaIcons.FaUserCog, path: '/settings/profile' },
        { name: 'User Role', icon: FaIcons.FaUserShield, path: '/settings/user-role' },
        { name: 'Logs', icon: FaIcons.FaClipboardList, path: '/settings/logs' },
      ],
    },
  ]

  return (
    <div
      className={`
        ${darkMode ? 'bg-gray-800 text-white border-r border-gray-100' : 'bg-white text-gray-800 border-r border-gray-800'}
        flex-shrink-0 h-[81rem] overflow-y-auto transition-transform duration-300 ease-in-out z-40
        fixed top-0 right-0 w-full transform print:hidden
        ${isMobileMenuOpen ? 'translate-x-0 flex' : '-translate-x-full hidden'}
        flex-col md:static md:translate-x-0 md:flex md:w-56
      `}
    >
      <div className={`p-4 text-2xl font-bold border-b md:hidden ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
        <Link to="/" className="flex justify-center md:justify-start">
          <img src={Logo} alt="Logo" className="w-[74.4%] xs:w-[73.59%] sm:w-[73.1%] ml-4 h-auto md:w-[100vw]" />
        </Link>
      </div>

      <nav className="flex-grow p-4">
        <ul>
          {menuItems.map((item) => (
            <li key={item.name} className="mb-2">
              {item.children ? (
                <>
                  <button
                    className={`flex items-center w-full text-left p-2 rounded transition-all duration-300 
                      ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}
                      ${item.className || ''}
                    `}
                    onClick={() => handleMenuClick(item.name)}
                  >
                    <item.icon className="mr-3" />
                    <span>{item.name}</span>
                    <FaIcons.FaChevronDown
                      className={`ml-auto transition-transform duration-300 ${openMenu === item.name ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <ul
                    className={`ml-6 mt-1 border-l overflow-hidden transition-all duration-300 
                      ${openMenu === item.name ? 'max-h-screen' : 'max-h-0'} 
                      ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  >
                    {item.children.map((child) => (
                      <li key={child.name} className="mb-1">
                        <Link
                          to={child.path}
                          className={`flex items-center p-2 rounded transition-all duration-300
                            ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}
                            ${location.pathname === child.path ? (darkMode ? 'bg-gray-700 font-semibold' : 'bg-gray-200 font-semibold') : ''}
                          `}
                          onClick={closeMobileMenu}
                        >
                          <child.icon className="mr-3 text-sm" />
                          <span>{child.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <Link
                  to={item.path}
                  className={`flex items-center p-2 rounded transition-all duration-300
                    ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}
                    ${location.pathname === item.path ? (darkMode ? 'bg-gray-700 font-semibold' : 'bg-gray-200 font-semibold') : ''}
                    ${item.className || ''}
                  `}
                  onClick={closeMobileMenu}
                >
                  <item.icon className="mr-3" />
                  <span>{item.name}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default SideNavbar