import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../../lib/config";
import DeliverModal from "../../components/DeliverModal";

/* ---------- küçük yardımcılar ---------- */
function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">
      {children}
    </th>
  );
}
function Td({ children, ...props }) {
  return (
    <td {...props} className="px-4 py-3 text-sm text-slate-300">
      {children}
    </td>
  );
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function pound(n) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n || 0);
}
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const color =
    s === "delivered"
      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
      : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30";
  const label = s === "delivered" ? "Delivered" : "Pending";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

/* ---------- Ana Sayfa ---------- */
export default function DriverHome() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  // ortak teslim modalı
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  async function load() {
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/orders?page=1&pageSize=100`);
      const d = await r.json();
      setRows(d.items ?? []);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // sayaclar
  const pending = useMemo(() => rows.filter(o => (o.status || "").toLowerCase() !== "delivered"), [rows]);
  const delivered = useMemo(() => rows.filter(o => (o.status || "").toLowerCase() === "delivered"), [rows]);

  // rota: sadece geo'su olan *pending* siparişlerle anlamlı
  const withGeoPending = useMemo(
    () =>
      pending.filter(
        (o) =>
          o.geo &&
          typeof o.geo.lat === "number" &&
          typeof o.geo.lng === "number"
      ),
    [pending]
  );
  const canBuild = withGeoPending.length >= 1;

  function openDeliver(o) {
    setSelectedOrder(o);
    setDeliverOpen(true);
  }

  async function afterDelivered() {
    setDeliverOpen(false);
    setSelectedOrder(null);
    await load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Driver – Orders</h1>

        <Link
          to="/driver/route"
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            canBuild
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : "bg-slate-700 text-slate-300 cursor-not-allowed"
          }`}
          onClick={(e) => {
            if (!canBuild) e.preventDefault();
          }}
          title={canBuild ? "" : "En az 1 adet konumu kayıtlı pending sipariş gerekli"}
        >
          Build route
        </Link>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        All: <b>{rows.length}</b> • Pending: <b>{pending.length}</b> • Delivered: <b>{delivered.length}</b> •
        &nbsp;Pending with geo: <b>{withGeoPending.length}</b>
      </p>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
        <table className="min-w-full">
          <thead className="bg-white/5">
            <tr>
              <Th>Date</Th>
              <Th>Shop</Th>
              <Th>Customer</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {busy && (
              <tr>
                <Td colSpan={6}>Loading…</Td>
              </tr>
            )}
            {!busy && rows.length === 0 && (
              <tr>
                <Td colSpan={6}>No orders.</Td>
              </tr>
            )}

            {rows.map((o) => {
              const isDelivered = (o.status || "").toLowerCase() === "delivered";
              return (
                <tr key={o._id} className="hover:bg-white/5">
                  <Td>{fmtDate(o.orderDate)}</Td>
                  <Td>{o.shopName || "—"}</Td>
                  <Td>{o.customerName || "—"}</Td>
                  <Td>{pound(o.totalAmount)}</Td>
                  <Td><StatusBadge status={o.status} /></Td>
                  <Td>
                    {!isDelivered ? (
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={() => openDeliver(o)}
                      >
                        Complete delivery
                      </button>
                    ) : (
                      <span className="text-slate-500 text-sm">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ortak modal */}
      <DeliverModal
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        order={{
          id: selectedOrder?._id,
          title:
            selectedOrder?.shopName || selectedOrder?.customerName || "Order",
          amount: selectedOrder?.totalAmount || 0,
        }}
        onSuccess={afterDelivered}
      />
    </div>
  );
}
