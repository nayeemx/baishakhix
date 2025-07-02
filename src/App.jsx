// import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector, useDispatch } from 'react-redux';
import { Route, Routes } from 'react-router';
import Login from './pages/auth/Login';
import Footer from './components/Footer';
import Register from './pages/auth/Register';
import Reset from './pages/auth/Reset';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/DashBoard';
import { useEffect, useState } from 'react';
import { setUser, logoutUser, setAuthLoading } from './redux/features/authSlice';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firestore } from './firebase/firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import SideNavbar from './components/SideNavbar';
import LeaveApproval from './pages/approvals/LeaveApproval';
import ResetApprovals from './pages/settings/ResetApprovals';
import SalesReports from './pages/reports/SalesReports';
import ProductList from './pages/inventory/ProductList';
import AddProduct from './pages/inventory/AddProduct';
import BarCode from './pages/inventory/BarCode';
import OldProduct from './pages/inventory/OldProduct';
import ExpenseList from './pages/expenses/ExpenseList';
import CustomerList from './pages/people/CustomerList';
import SupplierList from './pages/people/SupplierList';
import SupplierReturn from './pages/adjustment/SupplierReturn';
import CustomerReturn from './pages/adjustment/CustomerReturn';
import DumpProduct from './pages/adjustment/DumpProduct';
import AttendanceList from './pages/stuffs/AttendanceList';
import LeaveList from './pages/stuffs/LeaveList';
import SalaryList from './pages/stuffs/SalaryList';
import ToDo from './pages/Tools/ToDo';
import KanBan from './pages/Tools/KanBan';
import Upload from './pages/Tools/Upload';
import Database from './pages/Tools/Database';
import Profile from './pages/settings/Profile';
import UserRole from './pages/settings/UserRole';
import Logs from './pages/settings/Logs';
import Loader from './components/Loader';
import QrCode from './components/Inventory/QrCode';
import Show_Qrdata from './components/Inventory/Show_Qrdata';
import POS from './pages/POS';
import { useLocation } from 'react-router-dom';
import ManualStocks from './pages/Tools/ManualStocks';
import FileManager from './pages/Tools/FileManager';
import Faker from './pages/Tools/Faker';

const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

// Placeholder component for demonstration
const Placeholder = ({ title }) => (
  <div className="p-8 text-2xl font-bold">{title} Page (Coming Soon)</div>
);

const App = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const authLoading = useSelector((state) => state.auth.authLoading);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Sync Firebase Auth state to Redux
  useEffect(() => {
    dispatch(setAuthLoading(true));
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch Firestore user data
        const userDoc = await getDoc(doc(firestore, "users", firebaseUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        
        // Helper function to validate if avatarUrl is a proper URL
        const isValidAvatarUrl = (url) => {
          if (!url) return false;
          try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
          } catch {
            return false;
          }
        };

        // Helper function to get the best available avatar URL
        const getBestAvatarUrl = (firebasePhotoURL, firestoreAvatarUrl) => {
          // Prefer Firestore avatarUrl if it's valid
          if (firestoreAvatarUrl && isValidAvatarUrl(firestoreAvatarUrl)) {
            return firestoreAvatarUrl;
          }
          // Fall back to Firebase photoURL if it's valid
          if (firebasePhotoURL && isValidAvatarUrl(firebasePhotoURL)) {
            return firebasePhotoURL;
          }
          // Return null if neither is valid
          return null;
        };

        dispatch(setUser({
          ...userData,
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || userData.name,
          avatarUrl: getBestAvatarUrl(firebaseUser.photoURL, userData.avatarUrl),
          emailVerified: firebaseUser.emailVerified,
        }));
      } else {
        dispatch(setUser(null));
      }
      dispatch(setAuthLoading(false)); // <-- Move this here, after Firestore/user is set
    });
    return () => unsubscribe();
  }, [dispatch]);

  // Inactivity logout logic
  useEffect(() => {
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        dispatch(logoutUser());
      }, INACTIVITY_LIMIT);
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    resetTimer();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('mousedown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [dispatch]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path='/login' element={<><Login /><Footer /></>} />
        <Route path='/register' element={<><Register /><Footer /></>} />
        <Route path='/reset' element={<><Reset /><Footer /></>} />
        <Route path='/' element={
          <>
            <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
            <HomePage />
            <Footer />
          </>
        } />

        {/* Protected routes: wrap the entire layout in ProtectedRoute */}
        <Route path='/dashboard' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <Dashboard />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/dashboard/overview' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <Placeholder title="Overview" />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/dashboard/settings' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <Placeholder title="Settings" />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />

        {/* Repeat for all other protected routes */}
        <Route path='/pos' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <div className="flex-1">
                  <POS />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/approvals/leave' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <LeaveApproval />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/settings/reset-approval' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <ResetApprovals />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/report/sale-report' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <SalesReports />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/inventory/products' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <ProductList />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/inventory/add-product' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <AddProduct />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/inventory/barcode' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <BarCode />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/inventory/old-product' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <OldProduct />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/expenses' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <ExpenseList />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/people/customers' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <CustomerList />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/people/suppliers' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <SupplierList />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/adjustment/supplier-return' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <SupplierReturn />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/adjustment/customer-return' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <CustomerReturn />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/adjustment/dump-product' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <DumpProduct />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/staff/attendance' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <AttendanceList />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/staff/leave' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <LeaveList />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/staff/salary' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <SalaryList />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/tools/todo' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <ToDo />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/tools/kanban' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <KanBan />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/tools/upload' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <Upload />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/tools/database' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <Database />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/tools/mstock' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <ManualStocks />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/tools/filemanager' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <FileManager />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/tools/faker' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <Faker />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/settings/profile' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <Profile />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/settings/user-role' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <UserRole />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />
        <Route path='/settings/logs' element={
          <ProtectedRoute allowedRoles={['super_user']}>
            <>
              <Header onMobileMenuClick={() => setIsMobileMenuOpen(true)} />
              <div className="flex">
                <SideNavbar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
                <div className="flex-1">
                  <Logs />
                </div>
              </div>
              <Footer />
            </>
          </ProtectedRoute>
        } />

        {/* Add this route for QR code scan details */}
        <Route path="/qr/:id" element={<Show_Qrdata isQrScan={true} />} />

        {/* If you want a page to show all QR codes, add this route */}
        <Route path="/qr" element={<QrCode />} />
      </Routes>
    </>
  );
};

export default App;