// src/features/auth/Login.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, login } from "./auth";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // zaten girişliyse yönlendir
  useEffect(() => {
    const u = getUser();
    if (u?.role === "driver") navigate("/driver", { replace: true });
    else if (u?.role === "admin") navigate("/admin", { replace: true });
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!username.trim() || !password) {
      setErr("Please enter your username and password.");
      return;
    }
    setBusy(true);
    try {
      const u = login(username.trim(), password);
      if (!u) {
        setErr("Invalid username or password.");
        return;
      }
      navigate(u.role === "driver" ? "/driver" : "/admin", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-emerald-600/20 grid place-items-center ring-1 ring-emerald-500/30">
              <span className="text-emerald-400 font-bold">M</span>
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              MagicSell
            </h1>
          </div>
          <p className="mt-2 text-slate-400 text-sm">
            Sign in to continue
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 shadow-2xl p-6 sm:p-7"
        >
          {err && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm">
              {err}
            </div>
          )}

          <label className="grid gap-1 mb-4">
            <span className="text-slate-300 text-sm">Username</span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg bg-slate-950/60 text-slate-100 placeholder:text-slate-500
                         border border-white/10 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="your username"
              autoComplete="username"
            />
          </label>

          <label className="grid gap-1 mb-2">
            <span className="text-slate-300 text-sm">Password</span>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-950/60 text-slate-100 placeholder:text-slate-500
                           border border-white/10 px-3 py-3 pr-12 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-200"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          <div className="mt-6">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60
                         text-white font-medium py-3 text-base"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        {/* Small footer */}
        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} MagicSell
        </p>
      </div>
    </div>
  );
}
