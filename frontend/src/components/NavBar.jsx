// src/components/NavBar.jsx
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUser, logout, onAuthChange } from "../features/auth/auth.js";
import { Bell, ChevronDown, LogOut, Users } from "lucide-react";
import { apiGet, apiPatch } from "../lib/api";

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
        active ? "bg-sky-600/80 text-white"
               : "text-zinc-300 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  );
}

export default function NavBar() {
  const [user, setUser] = useState(getUser());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDriverMenu, setShowDriverMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const notificationDropdownRef = useRef(null);
  const driverMenuButtonRef = useRef(null);
  const driverMenuRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => onAuthChange(setUser), []);

  // Update cart count for customer users
  useEffect(() => {
    if (user?.role === "customer") {
      function updateCartCount() {
        try {
          const savedCart = localStorage.getItem("customerCart");
          if (savedCart) {
            const cart = JSON.parse(savedCart);
            const count = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
            setCartItemCount(count);
          } else {
            setCartItemCount(0);
          }
        } catch (e) {
          setCartItemCount(0);
        }
      }
      
      updateCartCount();
      // Listen for storage changes (when cart is updated in other tabs/components)
      window.addEventListener("storage", updateCartCount);
      // Also check periodically for same-tab updates
      const interval = setInterval(updateCartCount, 1000);
      
      return () => {
        window.removeEventListener("storage", updateCartCount);
        clearInterval(interval);
      };
    }
  }, [user]);

  // Calculate dropdown position when menu opens
  useEffect(() => {
    if (showUserMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px = mt-2 equivalent
        right: window.innerWidth - rect.right,
      });
    }
  }, [showUserMenu]);

  // Fetch notifications
  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  async function fetchNotifications() {
    try {
      const data = await apiGet("/api/notifications?unreadOnly=true");
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    }
  }

  async function markAsRead(notificationId) {
    try {
      await apiPatch(`/api/notifications/${notificationId}/read`);
      await fetchNotifications();
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) && !buttonRef.current?.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target) && 
          notificationButtonRef.current && !notificationButtonRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (driverMenuRef.current && !driverMenuRef.current.contains(event.target) && 
          driverMenuButtonRef.current && !driverMenuButtonRef.current.contains(event.target)) {
        setShowDriverMenu(false);
      }
    }
    if (showUserMenu || showNotifications || showDriverMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUserMenu, showNotifications, showDriverMenu]);

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate("/login", { replace: true });
  };

  // Get user initials for avatar
  const getUserInitials = (email) => {
    if (!email) return "U";
    const parts = email.split("@")[0].split(".");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  // Get user display name from email
  const getUserDisplayName = (email) => {
    if (!email) return "User";
    const username = email.split("@")[0];
    // Capitalize first letter of each word
    return username
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  // Get role display name
  const getRoleDisplayName = (role) => {
    const roleMap = {
      admin: "Administrator",
      driver: "Driver",
      customer: "Customer",
    };
    return roleMap[role] || role;
  };

  // Find active link for wave effect
  const { pathname } = useLocation();
  const getActiveLink = () => {
    if (user?.role === "admin") {
      if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
      if (pathname.startsWith("/admin/orders")) return "orders";
      if (pathname.startsWith("/admin/products")) return "products";
      if (pathname.startsWith("/admin/customers")) return "customers";
      if (pathname.startsWith("/admin/drivers") || pathname.startsWith("/admin/driver-board")) return "drivers";
    }
    return null;
  };
  const activeLink = getActiveLink();
  
  // Check if driver menu should be active
  const isDriverMenuActive = pathname.startsWith("/admin/drivers") || pathname.startsWith("/admin/driver-board");

  return (
    <header className="border-b border-white/10 bg-black/30 backdrop-blur sticky top-0 z-[100] relative overflow-hidden">
      {/* Glow effect on MagicSell logo - subtle */}
      <div className="absolute left-0 top-0 bottom-0 w-[140px] pointer-events-none">
        <div 
          className="absolute left-4 top-1/2 -translate-y-1/2 w-[70px] h-[30px] opacity-25"
          style={{
            background: 'radial-gradient(ellipse 50px 90% at 50% 50%, rgba(147, 197, 253, 0.4) 0%, transparent 65%)',
            filter: 'blur(10px)',
          }}
        />
      </div>

      {/* Wave effect from MagicSell to active link - Mountain-like peaks */}
      {activeLink && (
        <div className="absolute left-0 top-0 bottom-0 w-full pointer-events-none">
          {/* Peak 1 - Closest to MagicSell */}
          <div 
            className="absolute left-[110px] top-0 h-full w-[180px] opacity-30"
            style={{
              background: 'radial-gradient(ellipse 140px 140% at 30% 0%, rgba(125, 211, 252, 0.6) 0%, transparent 70%)',
              filter: 'blur(20px)',
              transform: 'translateY(-12px)',
            }}
          />
          {/* Peak 2 - Middle peak, rising */}
          <div 
            className="absolute left-[200px] top-0 h-full w-[200px] opacity-25"
            style={{
              background: 'radial-gradient(ellipse 160px 130% at 50% 0%, rgba(96, 165, 250, 0.5) 0%, transparent 75%)',
              filter: 'blur(22px)',
              transform: 'translateY(-18px)',
            }}
          />
          {/* Peak 3 - Near Dashboard, highest peak */}
          <div 
            className="absolute left-[300px] top-0 h-full w-[240px] opacity-22"
            style={{
              background: 'radial-gradient(ellipse 200px 160% at 50% 0%, rgba(56, 189, 248, 0.45) 0%, transparent 85%)',
              filter: 'blur(24px)',
              transform: 'translateY(-22px)',
            }}
          />
        </div>
      )}
      
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3 relative z-10">
        <Link 
          to={
            user?.role === "driver" ? "/driver" : 
            user?.role === "customer" ? "/customer" : 
            "/admin"
          } 
          className="font-semibold text-white text-lg relative z-10"
        >
          MagicSell
        </Link>

        <nav className="flex gap-2 items-center relative z-10">
          {user?.role === "admin" && (
            <>
              <AppNavLink to="/admin" end>Dashboard</AppNavLink>
              <AppNavLink to="/admin/orders">Orders</AppNavLink>
              <AppNavLink to="/admin/products">Products</AppNavLink>
              <AppNavLink to="/admin/customers">Customers</AppNavLink>
              
              {/* Drivers Dropdown */}
              <div className="relative z-[110]">
                <button
                  ref={driverMenuButtonRef}
                  onClick={() => setShowDriverMenu(!showDriverMenu)}
                  onMouseEnter={() => setShowDriverMenu(true)}
                  className={`px-3 py-2 rounded-md text-sm transition flex items-center gap-1 ${
                    isDriverMenuActive
                      ? "bg-sky-600/80 text-white"
                      : "text-zinc-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Drivers
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDriverMenu ? "rotate-180" : ""}`} />
                </button>

                {/* Driver Dropdown Menu */}
                {showDriverMenu && createPortal(
                  <div
                    ref={driverMenuRef}
                    className="fixed rounded-lg border border-slate-700 bg-slate-800 shadow-xl py-1 z-[9999] min-w-[160px]"
                    style={{
                      top: driverMenuButtonRef.current
                        ? driverMenuButtonRef.current.getBoundingClientRect().bottom + 4
                        : 68,
                      left: driverMenuButtonRef.current
                        ? driverMenuButtonRef.current.getBoundingClientRect().left
                        : 0,
                    }}
                    onMouseLeave={() => setShowDriverMenu(false)}
                  >
                    <Link
                      to="/admin/drivers"
                      onClick={() => setShowDriverMenu(false)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        pathname.startsWith("/admin/drivers") && !pathname.startsWith("/admin/driver-board")
                          ? "bg-sky-600/20 text-white"
                          : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Drivers
                    </Link>
                    <Link
                      to="/admin/driver-board"
                      onClick={() => setShowDriverMenu(false)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        pathname.startsWith("/admin/driver-board")
                          ? "bg-sky-600/20 text-white"
                          : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Driver Board
                    </Link>
                  </div>,
                  document.body
                )}
              </div>
            </>
          )}
          {user?.role === "driver" && <AppNavLink to="/driver" end>Driver</AppNavLink>}
          {user?.role === "customer" && (
            <>
              <AppNavLink to="/customer" end>Dashboard</AppNavLink>
              <AppNavLink to="/customer/products">Products</AppNavLink>
              <Link
                to="/customer/cart"
                className={`relative px-3 py-2 rounded-md text-sm transition ${
                  pathname === "/customer/cart" || pathname.startsWith("/customer/cart")
                    ? "bg-sky-600/80 text-white"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                Cart
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-bold min-w-[20px] text-center">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                )}
              </Link>
              <AppNavLink to="/customer/orders">Orders</AppNavLink>
            </>
          )}

          {!user ? (
            <AppNavLink to="/login">Login</AppNavLink>
          ) : (
            <div className="flex items-center gap-3 ml-4">
              {/* Notifications */}
              <div className="relative z-[110]">
                <button
                  ref={notificationButtonRef}
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && createPortal(
                  <div
                    ref={notificationDropdownRef}
                    className="fixed w-80 rounded-lg border border-slate-700 bg-slate-800 shadow-xl py-1 z-[9999] max-h-96 overflow-y-auto"
                    style={{
                      top: notificationButtonRef.current
                        ? notificationButtonRef.current.getBoundingClientRect().bottom + 8
                        : 68,
                      right: notificationButtonRef.current
                        ? window.innerWidth - notificationButtonRef.current.getBoundingClientRect().right
                        : 16,
                    }}
                  >
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-slate-400 text-sm">
                        No notifications
                      </div>
                    ) : (
                      <>
                        {notifications.map((notif) => (
                          <div
                            key={notif._id}
                            onClick={() => {
                              if (!notif.isRead) markAsRead(notif._id);
                              setShowNotifications(false);
                            }}
                            className={`px-4 py-3 hover:bg-slate-700/50 cursor-pointer transition-colors ${
                              !notif.isRead ? "bg-slate-700/30" : ""
                            }`}
                          >
                            <div className="text-sm font-medium text-white">{notif.title}</div>
                            <div className="text-xs text-slate-400 mt-1">{notif.message}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {new Date(notif.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                        <div className="border-t border-slate-700 px-4 py-2">
                          <button
                            onClick={() => {
                              navigate("/admin/customers");
                              setShowNotifications(false);
                            }}
                            className="text-xs text-sky-400 hover:text-sky-300"
                          >
                            View all notifications
                          </button>
                        </div>
                      </>
                    )}
                  </div>,
                  document.body
                )}
              </div>

              {/* User Info with Dropdown */}
              <div className="relative z-[110]">
                <button
                  ref={buttonRef}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                >
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">{getUserDisplayName(user.email)}</div>
                    <div className="text-xs text-slate-400">{getRoleDisplayName(user.role)}</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white">
                    {getUserInitials(user.email)}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Dropdown Menu - Rendered via Portal to body to avoid overflow issues */}
              {showUserMenu && createPortal(
                <div 
                  ref={menuRef}
                  className="fixed w-48 rounded-lg border border-slate-700 bg-slate-800 shadow-xl py-1 z-[9999]"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    right: `${dropdownPosition.right}px`,
                  }}
                >
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>,
                document.body
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
