import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import OrderForm from "./OrderForm";
import OrderProofModal from "../../components/OrderProofModal";
import DeliveryModal from "../../components/DeliverModal";
import { API_URL } from "../../lib/config";
import { StatusBadge, PaymentBadge } from "../../components/Badges";

export default function Orders() {
  const [openNew, setOpenNew] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState(null);

  // proof modal
  const [proofOpen, setProofOpen] = useState(false);
  const [proofOrder, setProofOrder] = useState(null);

  // deliver modal (admin)
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliverOrder, setDeliverOrder] = useState(null);

  // UI state
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const pageSize = 20;

  function onEdit(order) {
    setEditing(order);
    setOpenEdit(true);
  }
  function onSavedEdit() {
    setOpenEdit(false);
    setEditing(null);
    fetchOrders(page, status, q);
  }

  // View (sadece delivered)
  async function openProof(row) {
    try {
      const r = await fetch(`${API_URL}/api/orders/${row._id}`);
      if (!r.ok) throw new Error("Could not fetch order");
      const o = await r.json();
      setProofOrder({ ...o, orderNo: row.orderNo });
      setProofOpen(true);
    } catch (e) {
      alert(e.message || "Could not fetch order");
    }
  }

  // Admin → Mark delivered → DeliveryModal aç
  function openDeliver(row) {
    setDeliverOrder({
      id: row._id,
      title: row.shopName || row.customerName || `#${pad(row.orderNo)}`,
      amount: row.totalAmount || 0,
    });
    setDeliverOpen(true);
  }
  async function afterDelivered() {
    setDeliverOpen(false);
    setDeliverOrder(null);
    await fetchOrders(page, status, q);
  }

  // Admin → Delete
  async function handleDelete(orderId, isDelivered) {
    const extra = isDelivered
      ? "\nThis order is delivered; deleting will remove it permanently."
      : "";
    if (!confirm(`Delete this order permanently?${extra}`)) return;

    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchOrders(page, status, q);
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  }

  // server'dan çek
  async function fetchOrders(nextPage = page, nextStatus = status, nextQ = q) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(pageSize));
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextQ.trim()) params.set("q", nextQ.trim());

    const res = await fetch(`${API_URL}/api/orders?${params.toString()}`);
    const data = await res.json();

    const list = Array.isArray(data) ? data : data.items ?? [];
    setRows(list);
    setPage(Number(data.page || nextPage));
    setPages(Number(data.pages || 1));
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders(1, status, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI eventleri
  function onChangeStatus(v) {
    setStatus(v);
    fetchOrders(1, v, q);
  }
  function onSearchSubmit(e) {
    e.preventDefault();
    fetchOrders(1, status, q);
  }
  function prev() {
    if (page > 1) fetchOrders(page - 1, status, q);
  }
  function next() {
    if (page < pages) fetchOrders(page + 1, status, q);
  }

  // client-side basit filtre
  const clientFiltered = rows.filter((o) => {
    const okStatus = status === "all" ? true : o.status === status;
    const text = (o.shopName || "") + " " + (o.customerName || "");
    const okQ = q.trim()
      ? text.toLowerCase().includes(q.trim().toLowerCase())
      : true;
    return okStatus && okQ;
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold">Orders</h1>

        {/* Top bar: filters */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl p-1 border bg-white/70 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
            <Tab active={status === "all"} onClick={() => onChangeStatus("all")}>
              All
            </Tab>
            <Tab
              active={status === "pending"}
              onClick={() => onChangeStatus("pending")}
            >
              Pending
            </Tab>
            <Tab
              active={status === "delivered"}
              onClick={() => onChangeStatus("delivered")}
            >
              Delivered
            </Tab>
          </div>

          <form onSubmit={onSearchSubmit} className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64 rounded-lg px-3 py-2 text-sm bg-white text-zinc-900 border border-zinc-300 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900/70 dark:text-slate-100 dark:border-white/10 dark:placeholder:text-slate-400 dark:focus:ring-indigo-500"
              placeholder="Search shop or customer"
            />
            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition">
              Search
            </button>
          </form>

          <div className="flex items-center gap-2"></div>

          <button
            onClick={() => setOpenNew(true)}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 font-medium hover:bg-emerald-500"
          >
            Add new order
          </button>
        </div>

        {/* KART (overflow-hidden) */}
        <div className="mt-4 rounded-2xl overflow-hidden shadow-xl bg-white border border-zinc-200 dark:bg-slate-900/60 dark:supports-[backdrop-filter]:bg-slate-900/50 dark:backdrop-blur dark:border-white/10">
          <div className="px-4 py-3 text-sm text-neutral-400">
            Latest {pageSize} orders
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900/60 text-neutral-300">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-medium">
                  <th>#</th>
                  <th>Date</th>
                  <th>Shop</th>
                  <th>Customer</th>
                  <th className="text-right">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {loading && (
                  <tr>
                    <td colSpan="8" className="px-4 py-10">
                      <Skeleton />
                    </td>
                  </tr>
                )}

                {!loading && clientFiltered.map((o) => (
                      <tr key={o._id} className="hover:bg-neutral-900/40">
                        <td className="px-4 py-3 font-medium">#{pad(o.orderNo)}</td>
                        <td className="px-4 py-3">{fmtDate(o.orderDate)}</td>
                        <td className="px-4 py-3">{o.shopName}</td>
                        <td className="px-4 py-3">{o.customerName || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          £{Number(o.totalAmount || 0).toFixed(0)}
                        </td>
                        <td className="px-4 py-3"><PaymentBadge method={o.paymentMethod} /></td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {/* fixed-slot layout: [Edit] [Middle action: View|Deliver] [Delete] */}
                          <div className="flex justify-end gap-2 items-center">
                            <div className="w-14 flex justify-end">
                              <button
                                onClick={() => onEdit(o)}
                                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-800"
                                title="Edit order"
                              >
                                Edit
                              </button>
                            </div>

                            <div className="w-28 flex justify-center">
                              {/* Middle slot: show View when delivered, otherwise Deliver button */}
                              {o.status === "delivered" ? (
                                <button
                                  onClick={() => openProof(o)}
                                  className="rounded-md border border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-800"
                                  title="View delivery proof"
                                >
                                  View
                                </button>
                              ) : (
                                <button
                                  onClick={() => openDeliver(o)}
                                  className="px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white"
                                >
                                  Deliver
                                </button>
                              )}
                            </div>

                            <div className="w-14 flex justify-start">
                              <button
                                onClick={() =>
                                  handleDelete(o._id, o.status === "delivered")
                                }
                                className="rounded-md border border-red-700 text-red-300 px-2.5 py-1 text-xs hover:bg-red-900/40"
                                title="Delete order"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}

                {!loading && clientFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-4 py-10 text-center text-neutral-400"
                    >
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
            <div className="text-xs text-neutral-400">
              Page {page} / {pages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={prev}
                disabled={page <= 1}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-neutral-800"
              >
                Previous
              </button>
              <button
                onClick={next}
                disabled={page >= pages}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-neutral-800"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* === MODALS — kartın DIŞINDA === */}
        <Modal open={openNew} onClose={() => setOpenNew(false)} title="Add New Order">
          <OrderForm
            onClose={() => setOpenNew(false)}
            onCreated={() => {
              setOpenNew(false);
              fetchOrders(1, status, q);
            }}
          />
        </Modal>

        <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Edit order">
          {editing && (
            <OrderForm
              mode="edit"
              initial={editing}
              onClose={() => setOpenEdit(false)}
              onSaved={onSavedEdit}
            />
          )}
        </Modal>

        <OrderProofModal
          open={proofOpen}
          onClose={() => setProofOpen(false)}
          order={proofOrder}
        />

        <DeliveryModal
          open={deliverOpen}
          onClose={() => setDeliverOpen(false)}
          order={deliverOrder}
          onSuccess={afterDelivered}
        />
      </div>
    </div>
  );
}

/* -- mini UI parçaları -- */
function Tab({ active, children, ...p }) {
  return (
    <button
      {...p}
      className={`px-3 py-1.5 text-sm rounded-lg transition ${
        active
          ? "bg-zinc-200 text-zinc-900 border border-zinc-300 dark:bg-slate-800 dark:text-white dark:border-white/10"
          : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/50"
      }`}
    >
      {children}
    </button>
  );
}

// using shared Badges component
function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-1/3 rounded bg-neutral-800" />
      <div className="h-4 w-1/2 rounded bg-neutral-800" />
      <div className="h-4 w-2/3 rounded bg-neutral-800" />
    </div>
  );
}

/* -- yardımcılar -- */
function pad(n) {
  if (n == null) return "—";
  const s = String(n);
  return s.length >= 4 ? s : "0".repeat(4 - s.length) + s;
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
