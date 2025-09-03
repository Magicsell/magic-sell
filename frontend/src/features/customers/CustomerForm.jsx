import { useState } from "react";
import { createCustomer } from "./api";

export default function CustomerForm({ onClose, onCreated }) {
  const [form, setForm] = useState({
    shopName: "",
    name: "",
    phone: "",
    address: "",
    postcode: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function onChange(e) {
    const { name, value } = e.target;
    setForm(s => ({ ...s, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!form.shopName.trim()) return setErr("Shop name is required.");

    try {
      setBusy(true);
      await createCustomer({
        shopName: form.shopName.trim(),
        name: emptyToNull(form.name),
        phone: emptyToNull(form.phone),
        address: emptyToNull(form.address),
        postcode: emptyToNull(form.postcode),
      });
      onCreated?.();
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {err && <div className="rounded-lg bg-red-500/15 text-red-300 ring-1 ring-red-400/30 px-3 py-2 text-sm">{err}</div>}

      <Field label="Shop name *">
        <input
          name="shopName" value={form.shopName} onChange={onChange}
          className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Customer name">
          <input name="name" value={form.name} onChange={onChange}
            className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
        <Field label="Customer phone">
          <input name="phone" value={form.phone} onChange={onChange}
            className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
      </div>

      <Field label="Address">
        <input name="address" value={form.address} onChange={onChange}
          className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </Field>

      <Field label="Postcode">
        <input name="postcode" value={form.postcode} onChange={onChange}
          className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </Field>

      <div className="flex gap-2 pt-2">
        <button disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-white font-medium hover:bg-emerald-500 disabled:opacity-60">
          {busy ? "Saving…" : "Create customer"}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
function emptyToNull(v){ const t=(v||"").trim(); return t?t:null; }
