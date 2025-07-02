import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../redux/features/authSlice";
import Logo from "../assets/logo.png";
import { FaUserCircle, FaMoon, FaSun, FaBars } from "react-icons/fa";
import { toggleTheme } from "../redux/features/themeSlice";
import { useEffect, useState } from "react";
import Loader from "./Loader";

const Header = ({ onMobileMenuClick }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useSelector((state) => state.auth);
  const darkMode = useSelector((state) => state.theme.darkMode);
  const [redirectLoading, setRedirectLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleLogoClick = () => {
    setRedirectLoading(true);
    if (user?.role === "super_user") {
      navigate("/dashboard");
    } else {
      navigate("/");
    }
    setTimeout(() => {
      setRedirectLoading(false);
    }, 500);
  };

  const isValidAvatarUrl = (url) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  if (redirectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <header
      className={`shadow p-4 print:hidden ${
        darkMode
          ? "bg-gray-900 text-white border-b-2 border-gray-100"
          : "bg-white text-gray-800 border-b-2 border-gray-500"
      }`}
    >
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-y-4">
        <div className="flex items-center justify-between md:justify-start w-full md:w-auto cursor-pointer">
          <div
            onClick={handleLogoClick}
            className="flex-1 flex justify-center md:justify-start"
          >
            <img src={Logo} alt="Logo" className="w-[70%] h-auto md:w-[150px]" />
          </div>
          {location.pathname !== "/pos" && (
            <button
              className="md:hidden p-2 ml-2"
              onClick={onMobileMenuClick}
              aria-label="Open menu"
              type="button"
            >
              <FaBars size={24} />
            </button>
          )}
        </div>

        <nav className="flex flex-col md:flex-row justify-center md:justify-end items-center space-x-4">
          <div className="flex items-center space-x-3 my-2">
            {user?.role === "super_user" && (
              <Link
                to="/pos"
                className={`px-3 py-1 rounded font-semibold transition ${
                  darkMode
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                }`}
              >
                POS
              </Link>
            )}
            <button
              onClick={() => dispatch(toggleTheme())}
              className={`text-xl ${
                darkMode ? "text-yellow-500" : "text-blue-400"
              }`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span
                  className={`${
                    darkMode ? "text-white" : "text-gray-800"
                  } font-medium`}
                >
                  {user.name || user.displayName || user.email}
                </span>
                {isValidAvatarUrl(user.avatarUrl) && !imgError ? (
                  <img
                    src={user.avatarUrl}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <FaUserCircle className="w-8 h-8 text-gray-400" />
                )}

                <button
                  onClick={() => dispatch(logoutUser())}
                  className="text-red-600 hover:underline ml-2"
                  disabled={loading}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className={`hover:underline ${
                  darkMode
                    ? "text-white hover:text-blue-400"
                    : "text-gray-700 hover:text-blue-600"
                }`}
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;