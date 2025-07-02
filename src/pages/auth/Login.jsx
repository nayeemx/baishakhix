import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, googleLogin, setUser } from '../../redux/features/authSlice';
import { FaEnvelope, FaLock, FaGoogle } from 'react-icons/fa';
import Logo from '../../assets/logo.png';
import { ToastContainer } from 'react-toastify';
import Loader from '../../components/Loader';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firestore } from '../../firebase/firebase.config';
import { doc, getDoc } from 'firebase/firestore';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading } = useSelector((state) => state.auth);
  const darkMode = useSelector((state) => state.theme.darkMode);

  // Sync Firebase Auth state to Redux on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
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
    });
    return () => unsubscribe();
  }, [dispatch]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const resultAction = await dispatch(loginUser({ email: form.email, password: form.password }));
      const userData = resultAction.payload;
      if (userData?.role === 'super_user') {
        navigate('/dashboard');
      } else if (userData?.role === 'user') {
        navigate('/');
      } else if (userData?.error) {
        setError(userData.error);
      }
    } catch (error) {
      setError("Login failed. Please try again.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const resultAction = await dispatch(googleLogin());
      const userData = resultAction.payload;
      if (userData?.role === 'super_user') {
        navigate('/dashboard');
      } else if (userData?.role === 'user') {
        navigate('/');
      } else if (userData?.error) {
        setError(userData.error);
      }
    } catch (error) {
      setError("Google login failed. Please try again.");
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-screen ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <ToastContainer />
      {/* Loader overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <Loader />
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className={`p-8 rounded-md shadow-md w-full max-w-md space-y-4 ${
          darkMode ? "bg-gray-800 text-white shadow-sm shadow-gray-50" : "bg-white text-gray-800"
        }`}
      >
        <div>
          <Link to="/">
            <img src={Logo} alt="Logo" className="mx-auto mb-4" />
          </Link>
        </div>
        <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>

        <div className="flex items-center border rounded px-3">
          <FaEnvelope className="text-gray-400 mr-2" />
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="w-full py-2 outline-none bg-transparent text-inherit"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="flex items-center border rounded px-3">
          <FaLock className="text-gray-400 mr-2" />
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoComplete="on"
            className="w-full py-2 outline-none bg-transparent text-inherit"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm text-center" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center bg-red-500 text-white py-2 rounded hover:bg-red-600 transition mt-2 disabled:opacity-50"
          disabled={loading}
        >
          <FaGoogle className="mr-2" /> Login with Google
        </button>

        <div className="text-center text-sm mt-2">
          Don't have an account?{" "}
          <Link to="/register" className="text-emerald-600 font-bold underline">
            Register
          </Link>
        </div>

        <div className="text-center text-sm mt-1">
          <Link to="/reset" className="text-red-600 font-semibold hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Login;