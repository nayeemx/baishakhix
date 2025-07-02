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
  const isPosPage = location.pathname === '/pos'

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
        { name: 'Manual_Stock', icon: FaIcons.FaClipboardList, path: '/tools/mstock' },
        { name: 'File_Manager', icon: FaIcons.FaFolderOpen, path: '/tools/filemanager' },
        { name: 'Faker', icon: FaIcons.FaCopy, path: '/tools/faker' },
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
    <>
      {/* Fullscreen sidebar container on mobile */}
      {isMobileMenuOpen && (
        <div className={`fixed inset-0 z-50 flex md:hidden ${darkMode ? 'bg-gray-800 bg-opacity-95' : 'bg-white bg-opacity-95'}`}>
          {/* Left menu panel */}
          <div
            className={`h-full w-full border-r flex-shrink-0 overflow-y-auto flex flex-col relative
              ${darkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-800 border-gray-200'}
              transform transition-transform duration-300 ease-in-out
              ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
          >
            {/* Mobile close button */}
            <button
              className={`md:hidden absolute top-[11vh] right-4 text-2xl z-50 ${darkMode ? 'text-white' : 'text-gray-700'}`}
              onClick={closeMobileMenu}
              aria-label="Close menu"
              type="button"
            >
              <FaIcons.FaTimes />
            </button>
            {!isPosPage && (
              <div className={`p-4 md:hidden text-2xl font-bold border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                <Link to="/" className="flex justify-center md:justify-start">
                  <img src={Logo} alt="Logo" className="w-[74.4%] xs:w-[73.59%] sm:w-[73.1%] ml-4 h-auto md:w-[100vw]" />
                </Link>
              </div>
            )}
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
          {/* Right overlay panel */}
          <div className="flex-1" onClick={closeMobileMenu} />
        </div>
      )}
      {/* Desktop sidebar */}
      <div
        className={`
          hidden md:flex md:static md:translate-x-0 md:w-64 h-full border-r flex-shrink-0 overflow-y-auto print:hidden flex-col
          ${darkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-800 border-gray-200'}
        `}
      >
        {!isPosPage && (
          <div className={`p-4 md:hidden text-2xl font-bold border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
            <Link to="/" className="flex justify-center md:justify-start">
              <img src={Logo} alt="Logo" className="w-[74.4%] xs:w-[73.59%] sm:w-[73.1%] ml-4 h-auto md:w-[100vw]" />
            </Link>
          </div>
        )}
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
    </>
  )
}

export default SideNavbar