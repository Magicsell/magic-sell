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
      const r = await fetch(`${API_URL}/api/orders?page=1&pageSize=100&status=pending`);
      const d = await r.json();
      setRows(d.items ?? []);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const withGeo = useMemo(
    () =>
      rows.filter(
        (o) => o.geo && typeof o.geo.lat === "number" && typeof o.geo.lng === "number"
      ),
    [rows]
  );
  const canBuild = withGeo.length >= 1;

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
        <h1 className="text-2xl font-semibold">Driver – Pending Orders</h1>

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
          title={canBuild ? "" : "En az 1 adet konumu kayıtlı sipariş gerekli"}
        >
          Build route
        </Link>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Pending orders: <b>{rows.length}</b> • with geo: <b>{withGeo.length}</b>
      </p>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
        <table className="min-w-full">
          <thead className="bg-white/5">
            <tr>
              <Th>Date</Th>
              <Th>Shop</Th>
              <Th>Customer</Th>
              <Th>Total</Th>
              <Th>Actions</Th>
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
                <Td colSpan={5}>No pending orders.</Td>
              </tr>
            )}
            {rows.map((o) => (
              <tr key={o._id} className="hover:bg-white/5">
                <Td>{fmtDate(o.orderDate)}</Td>
                <Td>{o.shopName || "—"}</Td>
                <Td>{o.customerName || "—"}</Td>
                <Td>{pound(o.totalAmount)}</Td>
                <Td>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => openDeliver(o)}
                  >
                    Complete delivery
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ortak modal */}
      <DeliverModal
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        order={{
          id: selectedOrder?._id,
          title: selectedOrder?.shopName || selectedOrder?.customerName || "Order",
          amount: selectedOrder?.totalAmount || 0,
        }}
        onSuccess={afterDelivered}
      />
    </div>
  );
}
