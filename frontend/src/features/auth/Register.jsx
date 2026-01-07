// src/features/auth/Register.jsx
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, User, MapPin, Phone } from "lucide-react";
import { API_URL } from "../../lib/config";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    address: "",
    postcode: "",
    city: "",
    organizationSlug: "", // Organization slug (örnek: "magic-cosmetics")
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  // Fetch organizations on mount
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch(`${API_URL}/api/auth/organizations`);
        const data = await response.json();
        console.log("[Register] Organizations fetched:", data);
        if (response.ok) {
          const orgs = data.organizations || [];
          setOrganizations(orgs);
          
          // Always auto-select first organization (or default-org if none)
          if (orgs.length > 0) {
            const selectedSlug = orgs[0].slug;
            console.log("[Register] Auto-selecting organization:", selectedSlug);
            setForm(prev => ({ ...prev, organizationSlug: selectedSlug }));
          } else {
            // Fallback: use default-org if no organizations found
            console.log("[Register] No organizations found, using default-org");
            setForm(prev => ({ ...prev, organizationSlug: "default-org" }));
          }
        } else {
          // Fallback: use default-org if API fails
          console.log("[Register] API failed, using default-org");
          setForm(prev => ({ ...prev, organizationSlug: "default-org" }));
        }
      } catch (error) {
        console.error("Failed to fetch organizations:", error);
        // Fallback: try to use default-org if fetch fails
        setForm(prev => ({ ...prev, organizationSlug: "default-org" }));
      } finally {
        setLoadingOrgs(false);
      }
    }
    fetchOrganizations();
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErr("");
  };

  async function onSubmit(e) {
    e.preventDefault();
    console.log("[Register] Form submitted", { form, organizations, loadingOrgs });
    setErr("");
    setSuccess(false);

    // Validation
    if (!form.email.trim() || !form.password || !form.name.trim()) {
      setErr("Email, password, and name are required.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    if (form.password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    if (!form.organizationSlug || !form.organizationSlug.trim()) {
      console.error("[Register] Organization slug is missing:", form.organizationSlug);
      setErr("Organization slug is required. Please contact your administrator.");
      return;
    }

    console.log("[Register] Validation passed, sending request...");

    setBusy(true);
    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        postcode: form.postcode.trim() || null,
        city: form.city.trim() || null,
        organizationSlug: form.organizationSlug.trim(),
      };
      
      console.log("[Register] Sending request to:", `${API_URL}/api/auth/register-customer`);
      console.log("[Register] Payload:", { ...payload, password: "***" });
      
      const response = await fetch(`${API_URL}/api/auth/register-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[Register] Response status:", response.status);
      const data = await response.json();
      console.log("[Register] Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      console.error("[Register] Error:", error);
      setErr(error.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-xl bg-slate-900/60 backdrop-blur border border-slate-800 shadow-xl p-8 text-center">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Registration Successful!</h2>
            <p className="text-slate-400 text-sm mb-6">
              Your account has been created successfully. Your account is pending admin approval. 
              Once approved by an administrator, you will be able to log in and place orders. 
              You will be redirected to the login page shortly.
            </p>
            <Link
              to="/login"
              className="inline-block px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
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
            Create your customer account
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
              name="email"
              value={form.email}
              onChange={onChange}
              autoFocus
              className="w-full rounded-lg border px-3 py-2.5
                         bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                         transition-all"
              placeholder="your@email.com"
              autoComplete="email"
              required
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
                name="password"
                value={form.password}
                onChange={onChange}
                className="w-full rounded-lg border px-3 py-2.5 pr-10
                           bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                           transition-all"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
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

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Confirm Password
            </span>
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={onChange}
                className="w-full rounded-lg border px-3 py-2.5 pr-10
                           bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                           transition-all"
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showConfirmPw ? "Hide password" : "Show password"}
              >
                {showConfirmPw ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Full Name <span className="text-red-400 ml-0.5">*</span>
            </span>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={onChange}
              className="w-full rounded-lg border px-3 py-2.5
                         bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                         transition-all"
              placeholder="Your full name"
              required
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Phone Number
            </span>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={onChange}
              className="w-full rounded-lg border px-3 py-2.5
                         bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                         transition-all"
              placeholder="+44 7xxx xxxxxx"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Postcode
              </span>
              <input
                type="text"
                name="postcode"
                value={form.postcode}
                onChange={onChange}
                className="w-full rounded-lg border px-3 py-2.5
                           bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                           transition-all"
                placeholder="BH13 7EX"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                City
              </span>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={onChange}
                className="w-full rounded-lg border px-3 py-2.5
                           bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                           transition-all"
                placeholder="Bournemouth"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Address
            </span>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={onChange}
              className="w-full rounded-lg border px-3 py-2.5
                         bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                         transition-all"
              placeholder="Street address"
            />
          </label>

          {/* Only show organization dropdown if there are multiple organizations */}
          {organizations.length > 1 && (
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                Organization <span className="text-red-400 ml-0.5">*</span>
              </span>
              {loadingOrgs ? (
                <div className="w-full rounded-lg border px-3 py-2.5 bg-slate-800/50 text-slate-400 text-sm border-slate-700">
                  Loading organizations...
                </div>
              ) : (
                <select
                  name="organizationSlug"
                  value={form.organizationSlug}
                  onChange={onChange}
                  className="w-full rounded-lg border px-3 py-2.5
                             bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
                             focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
                             transition-all cursor-pointer appearance-none pr-8 bg-[url('data:image/svg+xml,%3csvg xmlns=\\'http://www.w3.org/2000/svg\\' fill=\\'none\\' viewBox=\\'0 0 20 20\\'%3e%3cpath stroke=\\'%2394a3b8\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M6 8l4 4 4-4\\'/%3e%3c/svg%3e')] bg-[length:16px_16px] bg-[right_0.5rem_center] bg-no-repeat"
                  required
                >
                  <option value="">Select an organization</option>
                  {organizations.map((org) => (
                    <option key={org.slug} value={org.slug}>
                      {org.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={busy || loadingOrgs || !form.organizationSlug}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-medium py-2.5 text-sm transition-colors"
            >
              {loadingOrgs ? "Loading..." : busy ? "Creating account…" : "Create Account"}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Already have an account? Sign in
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
