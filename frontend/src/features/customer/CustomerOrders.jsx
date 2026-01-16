import { useEffect, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { apiGet } from "../../lib/api";
import { StatusBadge, PaymentBadge } from "../../components/Badges";
import OrderProofModal from "../../components/OrderProofModal";
import { Eye, Search, Package, Clock, CheckCircle } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";
import Pagination from "../../components/Pagination";
import { useTableSorting } from "../../hooks/useTableSorting";

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

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-sky-600/80 text-white"
          : "bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function CustomerOrders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  
  // Use sorting hook
  const { sorting, setSorting, getSortParam } = useTableSorting({
    defaultSort: [{ id: "orderDate", desc: true }],
    onSortChange: (newSorting) => {
      loadOrders(page, statusFilter, q, pageSize, newSorting);
    },
  });

  // Proof modal
  const [proofOpen, setProofOpen] = useState(false);
  const [proofOrder, setProofOrder] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders(nextPage = page, nextStatus = statusFilter, nextQ = q, nextPageSize = pageSize, nextSorting = sorting) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(nextPageSize));
      
      // Add sorting parameter
      const sortParam = getSortParam(nextSorting);
      if (sortParam) {
        params.set("sort", sortParam);
      }
      
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (nextQ.trim()) params.set("q", nextQ.trim());

      const data = await apiGet(`/api/orders?${params.toString()}`);
      const orders = data.items || [];
      
      setRows(orders);
      setPage(Number(data.page || nextPage));
      setPages(Number(data.pages || data.totalPages || 1));
      setTotal(Number(data.total || orders.length));
    } catch (e) {
      console.error("Failed to load orders:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders(1, statusFilter, q, pageSize, sorting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);
  
  // Auto-refresh when search is cleared
  useEffect(() => {
    if (!q.trim()) {
      // Search is empty, refresh to show all
      setPage(1);
      loadOrders(1, statusFilter, "", pageSize, sorting);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Statistics
  const stats = useMemo(() => {
    const pending = rows.filter((o) => (o.status || "").toLowerCase() !== "delivered");
    const delivered = rows.filter((o) => (o.status || "").toLowerCase() === "delivered");
    return { all: rows.length, pending: pending.length, delivered: delivered.length };
  }, [rows]);

  // View order proof (only for delivered orders)
  async function openProof(row) {
    try {
      const o = await apiGet(`/api/orders/${row._id}`);
      setProofOrder({ ...o, orderNo: row.orderNo });
      setProofOpen(true);
    } catch (e) {
      alert(e.message || "Could not fetch order");
    }
  }

  // Table columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("orderNo", {
        header: "#",
        cell: (info) => (
          <span className="font-medium text-slate-200">#{pad(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("orderDate", {
        header: "Date",
        cell: (info) => <span className="text-slate-300">{fmtDate(info.getValue())}</span>,
      }),
      columnHelper.accessor("shopName", {
        header: "Shop",
        cell: (info) => (
          <span className="font-medium text-slate-200">{info.getValue() || "—"}</span>
        ),
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
      }),
      columnHelper.accessor("paymentMethod", {
        header: "Payment",
        cell: (info) => <PaymentBadge method={info.getValue()} />,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const order = info.row.original;
          const isDelivered = (order.status || "").toLowerCase() === "delivered";
          return (
            <div className="flex items-center gap-2">
              {isDelivered ? (
                <button
                  onClick={() => openProof(order)}
                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-colors"
                  title="View delivery proof"
                >
                  <Eye className="w-4 h-4" />
                </button>
              ) : (
                <span className="text-slate-500 text-sm">—</span>
              )}
            </div>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // Server-side sorting
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb items={[{ label: "My Orders" }]} />

      <h1 className="text-2xl font-bold text-slate-100 mb-6">My Orders</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 mb-1">Total Orders</div>
          <div className="text-2xl font-bold text-white">{stats.all}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </div>
          <div className="text-2xl font-bold text-yellow-300">{stats.pending}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Delivered
          </div>
          <div className="text-2xl font-bold text-emerald-300">{stats.delivered}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Tab active={statusFilter === "all"} onClick={() => {
            setStatusFilter("all");
            setPage(1);
            loadOrders(1, "all", q, pageSize, sorting);
          }}>
            All ({stats.all})
          </Tab>
          <Tab active={statusFilter === "pending"} onClick={() => {
            setStatusFilter("pending");
            setPage(1);
            loadOrders(1, "pending", q, pageSize, sorting);
          }}>
            Pending ({stats.pending})
          </Tab>
          <Tab active={statusFilter === "delivered"} onClick={() => {
            setStatusFilter("delivered");
            setPage(1);
            loadOrders(1, "delivered", q, pageSize, sorting);
          }}>
            Delivered ({stats.delivered})
          </Tab>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            loadOrders(1, statusFilter, q, pageSize, sorting);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search orders..."
              className="pl-10 pr-4 py-1.5 rounded-lg border bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all w-64"
            />
          </div>
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-slate-400 py-8">Loading orders...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-slate-400 py-12">
          <Package className="w-16 h-16 mx-auto mb-3 text-slate-500" />
          <div className="text-sm">No orders found</div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-sm font-semibold text-slate-300"
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
                              {{
                                asc: " ↑",
                                desc: " ↓",
                              }[header.column.getIsSorted()] ?? " ↕"}
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
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          <Pagination
            page={page}
            pages={pages}
            pageSize={pageSize}
            total={total}
            itemsCount={rows.length}
            itemLabel="orders"
            onPageChange={(newPage) => {
              if (newPage >= 1 && newPage <= pages) {
                loadOrders(newPage, statusFilter, q, pageSize, sorting);
              }
            }}
            onPageSizeChange={(newPageSize) => {
              setPageSize(newPageSize);
              setPage(1);
              loadOrders(1, statusFilter, q, newPageSize, sorting);
            }}
          />
        </div>
      )}

      {/* Proof Modal */}
      <OrderProofModal
        open={proofOpen}
        onClose={() => setProofOpen(false)}
        order={proofOrder}
      />
    </div>
  );
}
