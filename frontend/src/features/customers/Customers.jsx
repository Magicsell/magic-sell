import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../lib/config";

/* ==== UK validators & formatters (shared) ==== */
const UK_POSTCODE_RE =
  /^(GIR 0AA|((([A-PR-UWYZ][0-9][0-9]?)|([A-PR-UWYZ][A-HK-Y][0-9][0-9]?)|([A-PR-UWYZ][0-9][A-HJKSTUW])|([A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRV-Y]))\s?[0-9][ABD-HJLNP-UW-Z]{2}))$/i;

function formatUKPostcode(v = "") {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  if (raw.length < 5) return v.toUpperCase();
  return `${raw.slice(0, -3)} ${raw.slice(-3)}`;
}
function isValidUKPostcode(v = "") {
  if (!v) return true; // opsiyonel
  return UK_POSTCODE_RE.test(v.trim().toUpperCase());
}
function normalizeUKPhone(v = "") {
  if (!v) return "";
  const s = v.replace(/[^\d+]/g, "");
  // 07xxxxxxxxx → +44xxxxxxxxxx
  if (/^0\d{10}$/.test(s)) return "+44" + s.slice(1);
  // +44… veya 44…
  if (/^\+?44\d{9,10}$/.test(s)) return s.startsWith("+") ? s : "+" + s;
  return null;
}
function isValidUKPhone(v = "") {
  if (!v) return true; // opsiyonel
  return normalizeUKPhone(v) !== null;
}
function emptyToNull(v) {
  const t = (v || "").trim();
  return t ? t : null;
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">
      {children}
    </th>
  );
}
function Td({ children, colSpan }) {
  return (
    <td className="px-4 py-3 text-sm text-slate-300" colSpan={colSpan}>
      {children}
    </td>
  );
}

export default function Customers() {
  const [all, setAll] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const url = q
        ? `${API_URL}/api/customers?q=${encodeURIComponent(q)}`
        : `${API_URL}/api/customers`;
      const r = await fetch(url);
      const d = await r.json();
      setAll(Array.isArray(d) ? d : d.items ?? []);
    } catch (e) {
      setErr("Customers could not be loaded");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // ilk açılış

  function onSearch(e) {
    e.preventDefault();
    load();
  }

  const rows = useMemo(() => {
    if (!q) return all;
    const s = q.toLowerCase();
    return all.filter(
      (c) =>
        (c.shopName || "").toLowerCase().includes(s) ||
        (c.name || "").toLowerCase().includes(s)
    );
  }, [all, q]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-md text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white"
        >
          Add customer
        </button>
      </div>

      <form onSubmit={onSearch} className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by shop or name"
          className="w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200/10 hover:bg-slate-200/20 text-slate-100 border border-white/10">
          Search
        </button>
      </form>

      {err && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm">
          {err}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
        <table className="min-w-full">
          <thead className="bg-white/5">
            <tr>
              <Th>Shop</Th>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Postcode</Th>
              <Th>Address</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {busy && (
              <tr>
                <Td colSpan={5}>Loading…</Td>
              </tr>
            )}
            {!busy && rows.length === 0 && (
              <tr>
                <Td colSpan={5}>No customers found.</Td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c._id} className="hover:bg-white/5">
                <Td>{c.shopName || "—"}</Td>
                <Td>{c.name || "—"}</Td>
                <Td>{c.phone || "—"}</Td>
                <Td>{c.postcode ? formatUKPostcode(c.postcode) : "—"}</Td>
                <Td>{c.address || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddCustomerModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Add Customer Modal (UK validation + normalize) ---------- */

function AddCustomerModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    shopName: "",
    name: "",
    phone: "",
    postcode: "",
    address: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({
      ...s,
      [name]: name === "postcode" ? formatUKPostcode(value) : value,
    }));
  }

  const v = useMemo(() => {
    const errors = {};
    if (!form.shopName.trim()) errors.shopName = "Shop name is required.";
    if (form.phone && !isValidUKPhone(form.phone))
      errors.phone = "Enter a valid UK phone (+44… or 07…).";
    if (form.postcode && !isValidUKPostcode(form.postcode))
      errors.postcode = "Enter a valid UK postcode (e.g. SW1A 1AA).";
    return { ok: Object.keys(errors).length === 0, errors };
  }, [form]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!v.ok) return;

    try {
      setBusy(true);
      const payload = {
        shopName: form.shopName.trim(),
        name: emptyToNull(form.name),
        phone: form.phone ? normalizeUKPhone(form.phone) : null,
        postcode: form.postcode ? formatUKPostcode(form.postcode) : null,
        address: emptyToNull(form.address),
      };

      const res = await fetch(`${API_URL}/api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");
      onSaved?.();
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold">Add New Customer</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {err && (
            <div className="sm:col-span-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm">
              {err}
            </div>
          )}

          <Label title="Shop name *" error={v.errors.shopName}>
            <input
              name="shopName"
              value={form.shopName}
              onChange={onChange}
              className="input"
              autoFocus
            />
          </Label>

          <Label title="Customer name">
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              className="input"
            />
          </Label>

          <Label title="Phone" error={v.errors.phone}>
            <input
              name="phone"
              value={form.phone}
              onChange={onChange}
              placeholder="+44… or 07…"
              className="input"
            />
          </Label>

          <Label title="Postcode" error={v.errors.postcode}>
            <input
              name="postcode"
              value={form.postcode}
              onChange={onChange}
              placeholder="SW1A 1AA"
              className="input"
            />
          </Label>

          <Label title="Address" className="sm:col-span-2">
            <input
              name="address"
              value={form.address}
              onChange={onChange}
              className="input"
            />
          </Label>

          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm border border-white/10 text-slate-200 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !v.ok}
              className="px-4 py-2 rounded-md text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Create customer"}
            </button>
          </div>
        </form>
      </div>

      {/* tailwind utilities */}
      <style>{`
        .input{
          width:100%;
          border-radius:.5rem;
          padding:.5rem .75rem;
          background-color:rgb(15 23 42 / 0.7);
          color:#e5e7eb;
          border:1px solid rgb(255 255 255 / 0.1);
          outline:0;
        }
        .input:focus{ box-shadow:0 0 0 2px #6366f1; }
      `}</style>
    </div>
  );
}

function Label({ title, error, children, className = "" }) {
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      <span className="text-slate-300">{title}</span>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}
