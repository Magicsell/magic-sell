import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { apiGet } from "../../lib/api";
import { StatusBadge, PaymentBadge } from "../../components/Badges";
import { Truck, Clock, Search, MapPin, CheckSquare, Square } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";

const columnHelper = createColumnHelper();

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

export default function DriverHome() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all"); // all, pending, delivered
  const [q, setQ] = useState("");
  const [sorting, setSorting] = useState([{ id: "orderDate", desc: true }]);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());

  async function load() {
    setLoading(true);
    try {
      const d = await apiGet("/api/orders?page=1&pageSize=100");
      setRows(d.items ?? []);
    } catch (e) {
      console.error("Failed to load orders:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Filter and search
  const filteredRows = useMemo(() => {
    let filtered = rows;
    
    // Status filter
    if (statusFilter === "pending") {
      filtered = filtered.filter(o => (o.status || "").toLowerCase() !== "delivered");
    } else if (statusFilter === "delivered") {
      filtered = filtered.filter(o => (o.status || "").toLowerCase() === "delivered");
    }
    
    // Search
    if (q.trim()) {
      const searchLower = q.toLowerCase();
      filtered = filtered.filter((o) => {
        const shopName = (o.shopName || "").toLowerCase();
        const customerName = (o.customerName || "").toLowerCase();
        const orderNo = String(o.orderNo || "").toLowerCase();
        return shopName.includes(searchLower) || customerName.includes(searchLower) || orderNo.includes(searchLower);
      });
    }
    
    return filtered;
  }, [rows, statusFilter, q]);

  // Statistics
  const stats = useMemo(() => {
    const pending = rows.filter(o => (o.status || "").toLowerCase() !== "delivered");
    const delivered = rows.filter(o => (o.status || "").toLowerCase() === "delivered");
    const withGeoPending = pending.filter(
      (o) => o.geo && typeof o.geo.lat === "number" && typeof o.geo.lng === "number"
    );
    return { all: rows.length, pending: pending.length, delivered: delivered.length, withGeoPending: withGeoPending.length };
  }, [rows]);

  // Get selectable orders (pending with geo)
  const selectableOrders = useMemo(() => {
    return filteredRows.filter(
      (o) =>
        (o.status || "").toLowerCase() !== "delivered" &&
        o.geo &&
        typeof o.geo.lat === "number" &&
        typeof o.geo.lng === "number"
    );
  }, [filteredRows]);

  // Selected orders count
  const selectedCount = useMemo(() => {
    return selectableOrders.filter((o) => selectedOrderIds.has(o._id)).length;
  }, [selectableOrders, selectedOrderIds]);

  function toggleOrderSelection(orderId) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedCount === selectableOrders.length) {
      // Deselect all
      setSelectedOrderIds(new Set());
    } else {
      // Select all selectable
      const allIds = new Set(selectableOrders.map((o) => o._id));
      setSelectedOrderIds(allIds);
    }
  }

  function handleBuildRoute() {
    if (selectedCount === 0) {
      alert("Please select at least one order to build a route");
      return;
    }
    
    // Navigate with selected order IDs as query params
    const orderIds = Array.from(selectedOrderIds).join(",");
    console.log("[DriverHome] Building route with orderIds:", orderIds);
    console.log("[DriverHome] Selected order IDs:", Array.from(selectedOrderIds));
    navigate(`/driver/route?orderIds=${encodeURIComponent(orderIds)}`);
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

  // Table columns
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => {
          const allSelected = selectableOrders.length > 0 && selectedCount === selectableOrders.length;
          const someSelected = selectedCount > 0 && selectedCount < selectableOrders.length;
          return (
            <button
              onClick={toggleSelectAll}
              className="p-1 rounded hover:bg-slate-700 transition-colors"
              title={allSelected ? "Deselect all" : "Select all"}
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-sky-400" />
              ) : someSelected ? (
                <div className="w-4 h-4 border-2 border-sky-400 bg-sky-400/20 rounded" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
            </button>
          );
        },
        cell: (info) => {
          const order = info.row.original;
          const isSelectable =
            (order.status || "").toLowerCase() !== "delivered" &&
            order.geo &&
            typeof order.geo.lat === "number" &&
            typeof order.geo.lng === "number";
          const isSelected = selectedOrderIds.has(order._id);

          if (!isSelectable) {
            return <span className="w-4 h-4" />;
          }

          return (
            <button
              onClick={() => toggleOrderSelection(order._id)}
              className="p-1 rounded hover:bg-slate-700 transition-colors"
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-sky-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
            </button>
          );
        },
        size: 50,
      }),
      columnHelper.accessor("orderDate", {
        header: "Date",
        cell: (info) => (
          <span className="text-slate-300">{fmtDate(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("shopName", {
        header: "Shop",
        cell: (info) => (
          <span className="font-medium text-slate-200">{info.getValue() || "—"}</span>
        ),
      }),
      columnHelper.accessor("customerName", {
        header: "Customer",
        cell: (info) => (
          <span className="text-slate-300">{info.getValue() || "—"}</span>
        ),
      }),
      columnHelper.accessor("totalAmount", {
        header: "Total",
        cell: (info) => (
          <span className="text-slate-200 font-medium">{pound(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("paymentMethod", {
        header: "Payment",
        cell: (info) => <PaymentBadge method={info.getValue()} />,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
    ],
    [selectedOrderIds, selectableOrders, selectedCount]
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb
        items={[{ label: "Driver Dashboard" }]}
        actionButton={
          <button
            onClick={handleBuildRoute}
            disabled={selectedCount === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCount > 0
                ? "bg-sky-600/80 hover:bg-sky-600 text-white"
                : "bg-slate-700 text-slate-400 cursor-not-allowed"
            }`}
            title={selectedCount === 0 ? "Please select at least one order" : `Build route with ${selectedCount} order${selectedCount !== 1 ? "s" : ""}`}
          >
            <Truck className="w-4 h-4" />
            Build Route {selectedCount > 0 && `(${selectedCount})`}
          </button>
        }
      />

      <h1 className="text-2xl font-bold text-slate-100 mb-6">Orders</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
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
            <MapPin className="w-3.5 h-3.5" />
            With Location
          </div>
          <div className="text-2xl font-bold text-sky-300">{stats.withGeoPending}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            Selected
          </div>
          <div className="text-2xl font-bold text-emerald-300">{selectedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2">
            <Tab active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              All ({stats.all})
            </Tab>
            <Tab active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}>
              Pending ({stats.pending})
            </Tab>
            <Tab active={statusFilter === "delivered"} onClick={() => setStatusFilter("delivered")}>
              Delivered ({stats.delivered})
            </Tab>
          </div>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by shop, customer, order #..."
              className="pl-10 pr-4 py-1.5 rounded-lg border bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all w-64"
            />
          </div>
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-slate-400 py-8">Loading orders...</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center text-slate-400 py-8">No orders found</div>
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
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
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
              {table.getRowModel().rows.map((row) => {
                const order = row.original;
                const isSelectable =
                  (order.status || "").toLowerCase() !== "delivered" &&
                  order.geo &&
                  typeof order.geo.lat === "number" &&
                  typeof order.geo.lng === "number";
                const isSelected = selectedOrderIds.has(order._id);
                
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isSelected ? "bg-sky-500/10" : ""
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
