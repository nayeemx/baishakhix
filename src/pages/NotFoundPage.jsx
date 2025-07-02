// The exported code uses Tailwind CSS. Install Tailwind CSS in your dev environment to ensure all styles work.

import { useEffect, useState } from "react";
import illustration from "../assets/60d25215a82aed9e98a22d2ff8b8dd7b.jpg";
import { useSelector } from "react-redux";

const App = () => {
  const [countdown, setCountdown] = useState(15);
  const darkMode = useSelector((state) => state.theme.darkMode);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(timer);
          window.location.href = "/"; // Redirect to homepage when countdown reaches 0
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? "bg-gray-800" : "bg-white"}`}>
      {/* Main content */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="max-w-7xl w-full mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Error message and actions */}
          <div className="w-full lg:w-1/2 space-y-8">
            <div className="space-y-4">
              <h2 className="text-9xl font-extrabold text-indigo-600">404</h2>
              <h3 className="text-4xl font-bold text-gray-800">
                Page Not Found
              </h3>
              <p className="text-xl text-gray-600 mt-4">
                Oops! Looks like this page is taking a fashion break
              </p>
              <p className="text-gray-500 text-lg">
                The page you're looking for seems to have walked off our runway
              </p>
            </div>

            <div className="space-y-4">
              <button
                className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-button text-lg shadow-md hover:bg-indigo-700 transition-colors duration-300 cursor-pointer whitespace-nowrap"
                onClick={() => (window.location.href = "/")}
              >
                Return to Homepage
              </button>

              <div className="flex flex-wrap gap-4 mt-4">
                <button className="px-6 py-2.5 border border-indigo-600 text-indigo-600 font-medium rounded-button hover:bg-indigo-50 transition-colors duration-300 cursor-pointer whitespace-nowrap">
                  View Our Collections
                </button>
                <button className="px-6 py-2.5 border border-indigo-600 text-indigo-600 font-medium rounded-button hover:bg-indigo-50 transition-colors duration-300 cursor-pointer whitespace-nowrap">
                  Contact Support
                </button>
              </div>

              <p className="text-sm text-gray-500 mt-2">
                Redirecting to homepage in {countdown} seconds...
              </p>
            </div>

            {/* Quick links */}
            <div className="mt-8">
              <h4 className="text-lg font-semibold text-gray-700 mb-3">
                Quick Navigation
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  "Inventory Management",
                  "Sales Reports",
                  "Employee Dashboard",
                  "Expense Tracking",
                ].map((link, index) => (
                  <button
                    key={index}
                    className={`px-4 py-2 border rounded-button text-sm transition-colors duration-300 cursor-pointer whitespace-normal break-words text-wrap
                    ${
                      darkMode
                        ? "bg-gray-700 border-gray-600 hover:bg-gray-600"
                        : "bg-white border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => (window.location.href = "/")}
                  >
                    {link}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Illustration */}
          <div className="w-full lg:w-1/2 flex justify-center">
            <div className="relative w-full max-w-lg aspect-square overflow-hidden">
              <img
                src={illustration}
                alt="404 Illustration"
                className="w-full h-full object-contain object-top"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;