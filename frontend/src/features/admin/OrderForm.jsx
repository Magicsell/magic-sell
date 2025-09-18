import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../lib/config";

/* ==== UK validators & formatters ==== */
const UK_POSTCODE_RE =
  /^(GIR 0AA|((([A-PR-UWYZ][0-9][0-9]?)|([A-PR-UWYZ][A-HK-Y][0-9][0-9]?)|([A-PR-UWYZ][0-9][A-HJKSTUW])|([A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRV-Y]))\s?[0-9][ABD-HJLNP-UW-Z]{2}))$/i;

function formatUKPostcode(v) {
  if (!v) return "";
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length < 5) return v.toUpperCase();
  return `${s.slice(0, -3)} ${s.slice(-3)}`;
}
function isValidUKPostcode(v) {
  if (!v) return true;
  return UK_POSTCODE_RE.test(v.trim().toUpperCase());
}
function normalizeUKPhone(v) {
  if (!v) return "";
  const s = v.replace(/[^\d+]/g, "");
  if (/^0\d{10}$/.test(s)) return "+44" + s.slice(1);
  if (/^\+?44\d{9,10}$/.test(s)) return s.startsWith("+") ? s : "+" + s;
  return null;
}
function isValidUKPhone(v) {
  if (!v) return true;
  return normalizeUKPhone(v) !== null;
}
function emptyToNull(v) {
  const t = (v || "").trim();
  return t ? t : null;
}
function nowLocalValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function toLocalValue(dt) {
  const d = dt ? new Date(dt) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/* ---------- UI helpers ---------- */
const INPUT_CLS = `
  w-full rounded-lg border px-3 py-2
  bg-white text-zinc-900 border-zinc-300 placeholder:text-zinc-400
  focus:outline-none focus:ring-2 focus:ring-indigo-500
  dark:bg-slate-900/70 dark:text-slate-100 dark:border-white/10 dark:placeholder:text-slate-400
`;
const SELECT_CLS = `
  w-full rounded-lg border px-3 py-2
  bg-white text-zinc-900 border-zinc-300
  focus:outline-none focus:ring-2 focus:ring-indigo-500
  dark:bg-slate-900/70 dark:text-slate-100 dark:border-white/10
`;

export default function OrderForm({
  mode = "create",
  initial = null,
  onClose,
  onCreated,
  onSaved,
}) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    shopName: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerPostcode: "",
    totalAmount: "",
    paymentMethod: "Not Set",
    orderDate: nowLocalValue(),
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Customers autocomplete
  const [customers, setCustomers] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/customers`);
        const d = await r.json();
        setCustomers(Array.isArray(d) ? d : d.items ?? []);
      } catch {}
    })();
  }, []);

  // Edit preload
  useEffect(() => {
    if (isEdit && initial) {
      setForm({
        shopName: initial.shopName || "",
        customerName: initial.customerName || "",
        customerPhone: initial.customerPhone || "",
        customerAddress: initial.customerAddress || "",
        customerPostcode: initial.customerPostcode || "",
        totalAmount:
          initial.totalAmount != null ? String(initial.totalAmount) : "",
        paymentMethod: initial.paymentMethod || "Not Set",
        orderDate: toLocalValue(initial.orderDate),
      });
    }
  }, [isEdit, initial]);

  const filteredShops = useMemo(() => {
    const q = (form.shopName || "").toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => (c.shopName || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [customers, form.shopName]);

  function pickCustomer(c) {
    setForm((s) => ({
      ...s,
      shopName: c.shopName || "",
      customerName: c.name || s.customerName,
      customerPhone: c.phone || s.customerPhone,
      customerAddress: c.address || s.customerAddress,
      customerPostcode: c.postcode || s.customerPostcode,
    }));
    setShowList(false);
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({
      ...s,
      [name]: name === "customerPostcode" ? formatUKPostcode(value) : value,
    }));
  }

  // Alan bazlı doğrulamalar
  const v = useMemo(() => {
    const errors = {};
    if (!form.shopName.trim()) errors.shopName = "Shop name is required.";
    const amountOk =
      form.totalAmount !== "" &&
      !isNaN(Number(form.totalAmount)) &&
      Number(form.totalAmount) >= 0;
    if (!amountOk) errors.totalAmount = "Enter a valid amount (e.g. 12.50).";
    if (form.customerPhone && !isValidUKPhone(form.customerPhone))
      errors.customerPhone = "Enter a valid UK phone (07… or +44…).";
    if (form.customerPostcode && !isValidUKPostcode(form.customerPostcode))
      errors.customerPostcode = "Enter a valid UK postcode (e.g. SW1A 1AA).";
    if (!form.orderDate) errors.orderDate = "Order date is required.";
    return { ok: Object.keys(errors).length === 0, errors };
  }, [form]);

  // submit
  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!v.ok) return;

    const payload = {
      shopName: form.shopName.trim(),
      customerName: emptyToNull(form.customerName),
      customerPhone: form.customerPhone
        ? normalizeUKPhone(form.customerPhone)
        : null,
      customerAddress: emptyToNull(form.customerAddress),
      customerPostcode: form.customerPostcode
        ? formatUKPostcode(form.customerPostcode)
        : null,
      totalAmount: Number(form.totalAmount),
      paymentMethod: form.paymentMethod,
      orderDate: form.orderDate
        ? new Date(form.orderDate).toISOString()
        : new Date().toISOString(),
    };

    try {
      setBusy(true);
      const url = isEdit
        ? `${API_URL}/api/orders/${initial._id}`
        : `${API_URL}/api/orders`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(isEdit ? "Failed to save order." : "Failed to create order.");

      isEdit ? onSaved?.() : onCreated?.();
      onClose?.();
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  const [showList, setShowList] = useState(false);

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {err && (
        <div className="rounded-lg px-3 py-2 text-sm border bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-400/30">
          {err}
        </div>
      )}

      {/* Shop + Autocomplete */}
      <label className="grid gap-1 text-sm relative">
        <span className="text-zinc-700 dark:text-neutral-300">Shop name *</span>
        <input
          name="shopName"
          value={form.shopName}
          onChange={onChange}
          onFocus={() => setShowList(true)}
          className={INPUT_CLS}
          autoComplete="off"
        />
        {v.errors.shopName && (
          <span className="text-xs text-red-500">{v.errors.shopName}</span>
        )}
        {showList && filteredShops.length > 0 && (
          <div
            className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg
                       border bg-white text-zinc-900 border-zinc-300 shadow-xl
                       dark:bg-slate-900/90 dark:text-slate-100 dark:border-white/10"
            onMouseDown={(e) => e.preventDefault()}
          >
            {filteredShops.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => pickCustomer(c)}
                className="block w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-slate-800"
              >
                <div className="font-medium">{c.shopName}</div>
                <div className="text-xs text-zinc-500 dark:text-slate-400">
                  {c.name || c.phone || c.postcode}
                </div>
              </button>
            ))}
          </div>
        )}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Customer name">
          <input
            name="customerName"
            value={form.customerName}
            onChange={onChange}
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Customer phone" error={v.errors.customerPhone}>
          <input
            name="customerPhone"
            value={form.customerPhone}
            onChange={onChange}
            placeholder="+44… or 07…"
            className={INPUT_CLS}
          />
        </Field>
      </div>

      <Field label="Address">
        <input
          name="customerAddress"
          value={form.customerAddress}
          onChange={onChange}
          className={INPUT_CLS}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Postcode" error={v.errors.customerPostcode}>
          <input
            name="customerPostcode"
            value={form.customerPostcode}
            onChange={onChange}
            placeholder="SW1A 1AA"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Order date" error={v.errors.orderDate}>
          <input
            type="datetime-local"
            name="orderDate"
            value={form.orderDate}
            onChange={onChange}
            className={INPUT_CLS}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Total amount *" error={v.errors.totalAmount}>
          <input
            name="totalAmount"
            inputMode="decimal"
            value={form.totalAmount}
            onChange={onChange}
            className={INPUT_CLS}
            placeholder="0.00"
          />
        </Field>
        <Field label="Payment method">
          <select
            name="paymentMethod"
            value={form.paymentMethod}
            onChange={onChange}
            className={SELECT_CLS}
          >
            <option>Not Set</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Balance">Balance</option>
          </select>
        </Field>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={busy || !v.ok}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white font-medium hover:bg-emerald-500 disabled:opacity-60"
        >
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create order"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-sm bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-transparent dark:text-slate-200 dark:border-white/10 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-zinc-700 dark:text-neutral-300">{label}</span>
      {children}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}
