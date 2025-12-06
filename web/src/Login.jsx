import { useState } from "react";
import { auth, googleProvider } from "./firebase";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setError("");
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google sign in error:", err);
      setError(err.message || "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setLoading(true);

      if (!email || !password) {
        setError("Please enter email and password");
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Login error:", err);

      if (err.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else if (err.code === "auth/user-not-found") {
        setError("No account found with this email");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password");
      } else if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password");
      } else {
        setError(err.message || "Failed to login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setLoading(true);

      if (!name) {
        setError("Please enter your name");
        return;
      }

      if (!email || !password) {
        setError("Please enter email and password");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Update profile with name
      await updateProfile(userCredential.user, {
        displayName: name
      });

      // CRITICAL: Sign out the user after registration
      // This prevents automatic login and forces them to manually login
      await signOut(auth);

      // Show success message
      alert("User registered successfully! Please login with your credentials.");

      // Switch to login mode and clear form
      setMode("login");
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      console.error("Registration error:", err);

      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters");
      } else {
        setError(err.message || "Failed to create account");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-center text-cyan-900">
            Rescue Spot
          </h2>
          <p className="text-center text-gray-600 mt-2">
            {mode === "login" ? "Sign in to continue" : "Create a new account"}
          </p>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex gap-2">
          <button
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${mode === "login"
              ? "bg-cyan-900 text-white"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Login
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${mode === "register"
              ? "bg-cyan-900 text-white"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Register
          </button>
        </div>

        {/* Google Sign In */}
        <button
          className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with email</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
          {/* Name Field (Register Only) */}
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required={mode === "register"}
              />
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 6 characters
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-cyan-900 text-white px-4 py-2 rounded-lg hover:bg-cyan-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            disabled={loading}
          >
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>

        {/* Help Text */}
        <div className="text-center text-sm text-gray-600">
          {mode === "login" ? (
            <p>
              Don't have an account?{" "}
              <button
                className="text-cyan-700 hover:text-cyan-900 font-medium"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Register here
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                className="text-cyan-700 hover:text-cyan-900 font-medium"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Login here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}