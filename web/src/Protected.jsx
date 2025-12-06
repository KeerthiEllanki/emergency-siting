import { useEffect, useState, useRef } from "react";
import { auth } from "./firebase.js";
import { signOut } from "firebase/auth";
import Login from "./Login.jsx";
import MyBookings from "./MyBookings.jsx";
import MySavedLocations from "./MySavedLocations.jsx";

export default function Protected({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [showSavedLocations, setShowSavedLocations] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setDropdownOpen(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleShowBookings = () => {
    setDropdownOpen(false);
    setShowBookings(true);
  };

  const handleShowSavedLocations = () => {
    setDropdownOpen(false);
    setShowSavedLocations(true);
  };

  const getUserDisplayName = () => {
    return user?.displayName || user?.email || "User";
  };

  const getUserInitials = () => {
    const name = user?.displayName;
    if (name) {
      // Get first letter of each word, max 2
      const words = name.split(' ');
      if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
      } else {
        return words[0][0].toUpperCase();
      }
    }

    // Fallback to email initial
    const email = user?.email;
    if (email) {
      return email[0].toUpperCase();
    }

    return "U";
  };

  if (!ready) return <div className="p-4">Loading…</div>;
  if (!user) return <Login />;

  return (
    <>
      {/* Minimal Header with Profile Dropdown */}
      <div className="w-full bg-white px-6 py-3 flex justify-end border-b border-gray-100">
        <div className="relative" ref={dropdownRef}>
          {/* Profile Button */}
          <button
            className="w-9 h-9 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white rounded-full flex items-center justify-center text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:scale-105"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title={getUserDisplayName()}
          >
            {getUserInitials()}
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
              {/* User Info Header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                    {getUserInitials()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {getUserDisplayName()}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                {/* My Bookings */}
                <button
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  onClick={handleShowBookings}
                >
                  <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  My Bookings
                </button>

                {/* My Saved Locations */}
                <button
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  onClick={handleShowSavedLocations}
                >
                  <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  My Saved Locations
                </button>

                {/* Divider */}
                <div className="border-t border-gray-100 my-1"></div>

                {/* Sign Out */}
                <button
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-3 transition-colors"
                  onClick={handleSignOut}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="-mt-1">
        {children}
      </div>

      {/* Modals */}
      <MyBookings
        isOpen={showBookings}
        onClose={() => setShowBookings(false)}
        user={user}
      />

      <MySavedLocations
        isOpen={showSavedLocations}
        onClose={() => setShowSavedLocations(false)}
        user={user}
      />
    </>
  );
}