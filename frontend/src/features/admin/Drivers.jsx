import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";

const columnHelper = createColumnHelper();
import { apiGet, apiPatch, apiDelete } from "../../lib/api";
import { Edit, Trash2, Plus, Search, CheckCircle, XCircle, User as UserIcon, Mail, Phone, MapPin, Clock } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";
import Pagination from "../../components/Pagination";
import { useTableSorting } from "../../hooks/useTableSorting";

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

export default function Drivers() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all"); // all, approved, pending
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Use sorting hook
  const { sorting, setSorting, getSortParam } = useTableSorting({
    defaultSort: [{ id: "createdAt", desc: true }],
    onSortChange: (newSorting) => {
      fetchDrivers(page, statusFilter, q, pageSize, newSorting);
    },
  });

  // Fetch drivers
  async function fetchDrivers(nextPage = page, nextStatus = statusFilter, nextQ = q, nextPageSize = pageSize, nextSorting = sorting) {
    setLoading(true);
    
    try {
      // Fetch new User model (role: driver only)
      const userParams = new URLSearchParams();
      userParams.set("page", String(nextPage));
      userParams.set("pageSize", String(nextPageSize));
      userParams.set("role", "driver"); // Only drivers
      
      if (nextStatus === "approved") {
        userParams.set("isApproved", "true");
      } else if (nextStatus === "pending") {
        userParams.set("isApproved", "false");
      }
      
      if (nextQ.trim()) {
        userParams.set("q", nextQ.trim());
      }
      
      // Add sorting parameter
      const sortParam = getSortParam(nextSorting);
      if (sortParam) {
        userParams.set("sort", sortParam);
      }

      const userData = await apiGet(`/api/users?${userParams.toString()}`);
      const drivers = userData.users || [];
      
      setRows(drivers);
      setPage(Number(userData.page || nextPage));
      setPages(Number(userData.pages || userData.totalPages || 1));
      setTotal(Number(userData.total || drivers.length));
      
      // Count pending approvals (fetch all pending for count)
      try {
        const pendingParams = new URLSearchParams();
        pendingParams.set("role", "driver");
        pendingParams.set("isApproved", "false");
        const pendingData = await apiGet(`/api/users?${pendingParams.toString()}`);
        const pending = Array.isArray(pendingData.users) ? pendingData.users.length : 0;
        setPendingCount(pending);
      } catch (e) {
        console.error("Failed to fetch pending count:", e);
      }
    } catch (e) {
      console.error("Failed to fetch drivers:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDrivers(1, statusFilter, q, pageSize, sorting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI events
  function onChangeStatus(v) {
    setStatusFilter(v);
    setPage(1);
    fetchDrivers(1, v, q, pageSize, sorting);
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    fetchDrivers(1, statusFilter, q, pageSize, sorting);
  }
  
  // Auto-refresh when search is cleared
  useEffect(() => {
    if (!q.trim()) {
      // Search is empty, refresh to show all
      setPage(1);
      fetchDrivers(1, statusFilter, "", pageSize, sorting);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  
  function onChangePageSize(newSize) {
    const newPageSize = Number(newSize);
    setPageSize(newPageSize);
    setPage(1);
    fetchDrivers(1, statusFilter, q, newPageSize, sorting);
  }

  // Approve driver
  async function handleApprove(driverId) {
    try {
      await apiPatch(`/api/users/${driverId}/approve`);
      await fetchDrivers(page, statusFilter, q, pageSize, sorting);
    } catch (e) {
      alert(e.message || "Failed to approve driver");
    }
  }

  // Reject driver
  async function handleReject(driverId) {
    try {
      await apiPatch(`/api/users/${driverId}/reject`);
      await fetchDrivers(page, statusFilter, q, pageSize, sorting);
    } catch (e) {
      alert(e.message || "Failed to reject driver");
    }
  }

  // Delete driver
  async function handleDelete(driverId, email) {
    if (!window.confirm(`Delete driver "${email}"? This action cannot be undone.`)) return;
    try {
      await apiDelete(`/api/users/${driverId}`);
      await fetchDrivers(page, statusFilter, q, pageSize, sorting);
    } catch (e) {
      alert(e.message || "Failed to delete driver");
    }
  }

  // Table columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("email", {
        header: "Email",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <span className="font-medium">{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.driverProfile?.name || "—", {
        id: "name",
        header: "Name",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-slate-400" />
            <span>{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.driverProfile?.phone || "—", {
        id: "phone",
        header: "Phone",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400" />
            <span>{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.driverProfile?.vehicleInfo || "—", {
        id: "vehicleInfo",
        header: "Vehicle Info",
        cell: (info) => (
          <span className="text-slate-300">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("isApproved", {
        header: "Status",
        cell: (info) => {
          const isApproved = info.getValue();
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                isApproved
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-400/30"
              }`}
            >
              {isApproved ? "Approved" : "Pending"}
            </span>
          );
        },
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => {
          const date = new Date(info.getValue());
          return (
            <span className="text-slate-400 text-sm">
              {date.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const driver = info.row.original;
          return (
            <div className="flex items-center gap-2">
              {!driver.isApproved && (
                <button
                  onClick={() => handleApprove(driver._id)}
                  className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors"
                  title="Approve"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              {driver.isApproved && (
                <button
                  onClick={() => handleReject(driver._id)}
                  className="p-1.5 rounded hover:bg-yellow-500/20 text-yellow-400 hover:text-yellow-300 transition-colors"
                  title="Reject"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => navigate(`/admin/drivers/edit?id=${driver._id}`)}
                className="p-1.5 rounded hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(driver._id, driver.email)}
                className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        },
      }),
    ],
    [navigate, page, statusFilter, q]
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
      <Breadcrumb
        items={[{ label: "Drivers", path: "/admin/drivers" }]}
        actionButton={
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {pendingCount} Pending
              </span>
            )}
            <button
              onClick={() => navigate("/admin/drivers/new")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/80 text-white text-sm font-medium hover:bg-sky-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Driver
            </button>
          </div>
        }
      />

      <h1 className="text-2xl font-bold text-slate-100 mb-6">Drivers</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2">
            <Tab active={statusFilter === "all"} onClick={() => onChangeStatus("all")}>
              All
            </Tab>
            <Tab active={statusFilter === "approved"} onClick={() => onChangeStatus("approved")}>
              Approved
            </Tab>
            <Tab active={statusFilter === "pending"} onClick={() => onChangeStatus("pending")}>
              Pending
            </Tab>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email, name, phone..."
              className="pl-10 pr-4 py-1.5 rounded-lg border bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all w-64"
            />
          </div>
          <button
            type="submit"
            className="p-1.5 rounded-lg bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-slate-400 py-8">Loading drivers...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-slate-400 py-8">No drivers found</div>
      ) : (
        <>
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
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            pages={pages}
            pageSize={pageSize}
            total={total}
            itemsCount={rows.length}
            itemLabel="drivers"
            onPageChange={(newPage) => {
              if (newPage >= 1 && newPage <= pages) {
                fetchDrivers(newPage, statusFilter, q, pageSize, sorting);
              }
            }}
            onPageSizeChange={onChangePageSize}
            className="mt-4"
          />
        </>
      )}
    </div>
  );
}
