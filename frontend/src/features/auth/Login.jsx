// src/features/auth/Login.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getUser, login } from "./auth";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // zaten girişliyse yönlendir
  useEffect(() => {
    const u = getUser();
    if (u?.role === "driver") {
      navigate("/driver", { replace: true });
    } else if (u?.role === "admin") {
      navigate("/admin", { replace: true });
    } else if (u?.role === "customer") {
      navigate("/customer", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!email.trim() || !password) {
      setErr("Please enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      
      // Role'e göre yönlendir
      if (user.role === "driver") {
        navigate("/driver", { replace: true });
      } else if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (user.role === "customer") {
        navigate("/customer", { replace: true });
      } else {
        navigate("/admin", { replace: true });
      }
    } catch (error) {
      setErr(error.message || "Invalid email or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            MagicSell
          </h1>
          <p className="text-slate-400 text-sm">
            Welcome back! Please sign in to your account
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="rounded-xl bg-slate-900/60 backdrop-blur border border-slate-800 shadow-xl p-6 sm:p-8 space-y-5"
        >
          {err && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/15 text-red-300 px-4 py-3 text-sm">
              {err}
            </div>
          )}

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Email Address
            </span>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5
                         bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                         transition-all"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Password
            </span>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 pr-10
                           bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                           transition-all"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </label>

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-medium py-2.5 text-sm transition-colors"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <div className="text-center">
              <Link
                to="/register"
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Don't have an account? Register as customer
              </Link>
            </div>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500">
          MagicSell - Professional Order Management System
        </p>
      </div>
    </div>
  );
}
