// src/features/auth/Guard.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { getUser, onAuthChange } from "./auth.js";

export default function Guard({ role, children }) {
  const [user, setUser] = useState(() => getUser());
  const location = useLocation();

  useEffect(() => {
    // Listen for auth changes
    const cleanup = onAuthChange(setUser);
    return cleanup;
  }, []);

  // Show nothing while checking (prevent flash)
  if (user === undefined) {
    return null;
  }

  // No user - redirect to login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Role check
  if (role && user.role !== role) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
