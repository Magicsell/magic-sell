// src/components/NavBar.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUser, logout, onAuthChange } from "../features/auth/auth.js";

function AppNavLink({ to, children, end = false }) {
  const { pathname } = useLocation();
  const active = end
    ? pathname === to // sadece tam eşleşme
    : (pathname === to || pathname.startsWith(to + "/")); // alt rotaları da kapsa

  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`px-3 py-2 rounded-md text-sm transition ${
        active ? "bg-emerald-600 text-white"
               : "text-zinc-300 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  );
}

export default function NavBar() {
  const [user, setUser] = useState(getUser());
  const navigate = useNavigate();
  useEffect(() => onAuthChange(setUser), []);

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <header className="border-b border-white/10 bg-black/30 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <Link to={user?.role === "driver" ? "/driver" : "/admin"} className="font-semibold">
          MagicSell
        </Link>

        <nav className="flex gap-2 items-center">
          {user?.role === "admin" && (
            <>
              <AppNavLink to="/admin" end>Dashboard</AppNavLink>
              <AppNavLink to="/admin/orders">Orders</AppNavLink>
              <AppNavLink to="/admin/customers">Customers</AppNavLink>
              <AppNavLink to="/admin/driver-board">Driver Board</AppNavLink>
            </>
          )}
          {user?.role === "driver" && <AppNavLink to="/driver" end>Driver</AppNavLink>}

          {!user ? (
            <AppNavLink to="/login">Login</AppNavLink>
          ) : (
            <button
              onClick={handleLogout}
              className="ml-2 px-3 py-2 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              Logout
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
