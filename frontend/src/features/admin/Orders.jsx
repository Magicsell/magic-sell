import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { apiGet, apiDelete } from "../../lib/api";
import { StatusBadge, PaymentBadge } from "../../components/Badges";
import OrderProofModal from "../../components/OrderProofModal";
import DeliveryModal from "../../components/DeliverModal";
import { Edit, Eye, Truck, Trash2, Plus, ChevronUp, ChevronDown, Search } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";

const columnHelper = createColumnHelper();

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

export default function Orders() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [sorting, setSorting] = useState([{ id: "orderDate", desc: true }]);
  const pageSize = 20;

  // proof modal
  const [proofOpen, setProofOpen] = useState(false);
  const [proofOrder, setProofOrder] = useState(null);

  // deliver modal (admin)
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliverOrder, setDeliverOrder] = useState(null);

  // Fetch orders
  async function fetchOrders(nextPage = page, nextStatus = status, nextQ = q) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(pageSize));
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextQ.trim()) params.set("q", nextQ.trim());

    try {
      const data = await apiGet(`/api/orders?${params.toString()}`);
      const list = Array.isArray(data) ? data : data.items ?? [];
      setRows(list);
      setPage(Number(data.page || nextPage));
      setPages(Number(data.totalPages || 1));
    } catch (e) {
      console.error("Failed to fetch orders:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders(1, status, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI events
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

  // View (sadece delivered)
  async function openProof(row) {
    try {
      const o = await apiGet(`/api/orders/${row._id}`);
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
      await apiDelete(`/api/orders/${orderId}`);
      await fetchOrders(page, status, q);
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  }

  // Table columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("orderNo", {
        header: "#",
        cell: (info) => `#${pad(info.getValue())}`,
        size: 80,
      }),
      columnHelper.accessor("orderDate", {
        header: "Date",
        cell: (info) => fmtDate(info.getValue()),
        size: 160,
      }),
      columnHelper.accessor("shopName", {
        header: "Shop",
        cell: (info) => info.getValue() || "—",
        size: 150,
      }),
      columnHelper.accessor("customerName", {
        header: "Customer",
        cell: (info) => info.getValue() || "—",
        size: 150,
      }),
      columnHelper.accessor("totalAmount", {
        header: "Total",
        cell: (info) => {
          const order = info.row.original;
          const itemsCount = order.items?.length || 0;
          return (
            <div>
              <div className="font-medium text-slate-100">
                £{Number(info.getValue() || 0).toFixed(2)}
              </div>
              {itemsCount > 0 && (
                <div className="text-xs text-slate-400 mt-0.5">
                  {itemsCount} item{itemsCount !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        },
        size: 100,
      }),
      columnHelper.accessor("paymentMethod", {
        header: "Payment",
        cell: (info) => <PaymentBadge method={info.getValue()} />,
        size: 120,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
        size: 120,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const order = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/admin/orders/edit?id=${order._id}`)}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-colors"
                title="Edit order"
              >
                <Edit className="w-4 h-4" />
              </button>
              {order.status === "delivered" ? (
                <button
                  onClick={() => openProof(order)}
                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-colors"
                  title="View delivery proof"
                >
                  <Eye className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => openDeliver(order)}
                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                  title="Mark as delivered"
                >
                  <Truck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleDelete(order._id, order.status === "delivered")}
                className="p-1.5 rounded-lg border border-red-700/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 hover:border-red-700 transition-colors"
                title="Delete order"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        },
        size: 150,
      }),
    ],
    [navigate]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    manualSorting: false,
  });

  return (
    <div>
        <Breadcrumb
          items={[{ label: "Orders", path: "/admin/orders" }]}
          actionButton={
            <button
              onClick={() => {
                // Get the latest order number from current list
                const latestOrderNo = rows.length > 0 
                  ? Math.max(...rows.map(o => o.orderNo || 0))
                  : 0;
                const expectedOrderNo = latestOrderNo + 1;
                navigate(`/admin/orders/new?expectedOrderNo=${expectedOrderNo}`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/80 text-white text-sm font-medium hover:bg-sky-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Order
            </button>
          }
        />

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="inline-flex rounded-xl p-1 border border-slate-800 bg-slate-900/60">
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-64 pl-10 pr-3 py-2 rounded-lg text-sm bg-slate-800/50 text-slate-100 border border-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
                placeholder="Search shop or customer"
              />
            </div>
            <button
              type="submit"
              className="p-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 backdrop-blur shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/80 border-b border-slate-700">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={`flex items-center gap-2 ${
                              header.column.getCanSort() ? "cursor-pointer select-none" : ""
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="text-slate-500">
                                {header.column.getIsSorted() === "asc" ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : header.column.getIsSorted() === "desc" ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <div className="w-4 h-4 opacity-30">
                                    <ChevronUp className="w-3 h-3" />
                                    <ChevronDown className="w-3 h-3 -mt-1" />
                                  </div>
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-4 py-3 text-sm text-slate-200"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-800/40">
            <div className="text-xs text-slate-400">
              Page {page} / {pages} • {rows.length} orders
            </div>
            <div className="flex gap-2">
              <button
                onClick={prev}
                disabled={page <= 1}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={next}
                disabled={page >= pages}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Modals */}
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
  );
}

function Tab({ active, children, ...p }) {
  return (
    <button
      {...p}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
        active
          ? "bg-sky-600/80 text-white"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      }`}
    >
      {children}
    </button>
  );
}
