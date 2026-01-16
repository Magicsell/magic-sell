import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { apiGet, apiPatch, apiDelete } from "../../lib/api";
import { Edit, Trash2, Plus, Search, CheckCircle, XCircle, User as UserIcon, Mail, Phone, MapPin, Clock } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";
import Pagination from "../../components/Pagination";
import { useTableSorting } from "../../hooks/useTableSorting";

const columnHelper = createColumnHelper();

// Tab component for status filters
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

export default function Customers() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all"); // all, approved, pending, legacy
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
      fetchUsers(page, statusFilter, q, pageSize, newSorting);
    },
  });

  // Fetch users and legacy customers
  async function fetchUsers(nextPage = page, nextStatus = statusFilter, nextQ = q, nextPageSize = pageSize, nextSorting = sorting) {
    setLoading(true);
    
    try {
      let users = [];
      let legacyCustomers = [];
      let userData = null; // Declare userData at function scope

      // If statusFilter is "legacy", only fetch legacy customers
      if (nextStatus === "legacy") {
        try {
          const legacyData = await apiGet("/api/customers");
          legacyCustomers = Array.isArray(legacyData) ? legacyData : (legacyData.items || []);
          // Convert legacy customers to user-like format
          legacyCustomers = legacyCustomers.map((c) => ({
            _id: c._id,
            email: `${c.shopName?.toLowerCase().replace(/\s+/g, ".")}@legacy.local`,
            role: "customer",
            isApproved: true,
            isActive: true,
            customerProfile: {
              name: c.name || "",
              phone: c.phone || "",
              address: c.address || "",
              postcode: c.postcode || "",
              city: c.city || "",
              geo: c.geo || null,
            },
            shopName: c.shopName,
            isLegacy: true,
            createdAt: c.createdAt,
          }));
        } catch (e) {
          console.error("Failed to fetch legacy customers:", e);
        }
      } else {
        // Fetch new User model (role: customer only)
        const userParams = new URLSearchParams();
        userParams.set("page", String(nextPage));
        userParams.set("pageSize", String(nextPageSize));
        userParams.set("role", "customer"); // Only customers
        
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

        userData = await apiGet(`/api/users?${userParams.toString()}`);
        users = userData.users || [];
      }

      // Combine users and legacy customers (only if not legacy-only view)
      let allItems = nextStatus === "legacy" ? legacyCustomers : [...users];
      
      // Client-side search (only for legacy, backend handles search for new users)
      if (nextStatus === "legacy" && nextQ.trim()) {
        const searchLower = nextQ.toLowerCase();
        allItems = allItems.filter((item) => {
          const email = (item.email || "").toLowerCase();
          const name = (item.customerProfile?.name || item.driverProfile?.name || item.shopName || "").toLowerCase();
          const phone = (item.customerProfile?.phone || item.driverProfile?.phone || "").toLowerCase();
          const shopName = (item.shopName || "").toLowerCase();
          return email.includes(searchLower) || name.includes(searchLower) || phone.includes(searchLower) || shopName.includes(searchLower);
        });
      }

      // Client-side sorting only for legacy customers (new users are sorted by backend)
      if (nextStatus === "legacy" && nextSorting && nextSorting.length > 0) {
        const sortField = nextSorting[0].id;
        const sortDir = nextSorting[0].desc ? -1 : 1;
        allItems.sort((a, b) => {
          let aVal = a[sortField];
          let bVal = b[sortField];
          if (sortField === "createdAt") {
            aVal = new Date(aVal || 0);
            bVal = new Date(bVal || 0);
          } else if (typeof aVal === "string") {
            aVal = aVal.toLowerCase();
            bVal = (bVal || "").toLowerCase();
          }
          if (aVal < bVal) return -1 * sortDir;
          if (aVal > bVal) return 1 * sortDir;
          return 0;
        });
      } else if (nextStatus === "legacy") {
        // Default sort by createdAt (newest first) for legacy
        allItems.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
      }

      // Pagination (client-side for legacy, backend for new users)
      let paginatedItems, totalCount, totalPages;
      
      if (nextStatus === "legacy") {
        const startIndex = (nextPage - 1) * nextPageSize;
        const endIndex = startIndex + nextPageSize;
        paginatedItems = allItems.slice(startIndex, endIndex);
        totalCount = allItems.length;
        totalPages = Math.ceil(allItems.length / nextPageSize);
      } else {
        paginatedItems = allItems;
        totalCount = Number(userData?.total || allItems.length);
        totalPages = Number(userData?.pages || userData?.totalPages || 1);
      }
      
      setRows(paginatedItems);
      setPage(nextPage);
      setPages(totalPages);
      setTotal(totalCount);
      
      // Count pending approvals (only from new users, not legacy)
      const pending = users.filter((u) => u.role !== "admin" && !u.isApproved).length;
      setPendingCount(pending);
    } catch (e) {
      console.error("Failed to fetch users:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers(1, statusFilter, q, pageSize, sorting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI events
  function onChangeStatus(v) {
    setStatusFilter(v);
    setPage(1);
    fetchUsers(1, v, q, pageSize, sorting);
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, statusFilter, q, pageSize, sorting);
  }
  
  // Auto-refresh when search is cleared
  useEffect(() => {
    if (!q.trim()) {
      // Search is empty, refresh to show all
      setPage(1);
      fetchUsers(1, statusFilter, "", pageSize, sorting);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  
  function onChangePageSize(newSize) {
    const newPageSize = Number(newSize);
    setPageSize(newPageSize);
    setPage(1);
    fetchUsers(1, statusFilter, q, newPageSize, sorting);
  }

  // Approve user
  async function handleApprove(userId) {
    if (!window.confirm("Approve this user?")) return;
    try {
      await apiPatch(`/api/users/${userId}/approve`);
      await fetchUsers(page, statusFilter, q, pageSize, sorting);
    } catch (e) {
      alert(e.message || "Failed to approve user");
    }
  }

  // Reject user
  async function handleReject(userId) {
    if (!window.confirm("Reject this user? This will deactivate their account.")) return;
    try {
      await apiPatch(`/api/users/${userId}/reject`);
      await fetchUsers(page, statusFilter, q, pageSize, sorting);
    } catch (e) {
      alert(e.message || "Failed to reject user");
    }
  }

  // Delete user or legacy customer
  async function handleDelete(itemId, emailOrShopName, isLegacy) {
    if (!window.confirm(`Delete ${isLegacy ? "customer" : "user"} "${emailOrShopName}"? This action cannot be undone.`)) return;
    try {
      if (isLegacy) {
        await apiDelete(`/api/customers/${itemId}`);
      } else {
        await apiDelete(`/api/users/${itemId}`);
      }
      await fetchUsers(page, statusFilter, q, pageSize, sorting);
    } catch (e) {
      alert(e.message || "Failed to delete");
    }
  }

  // Table columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("email", {
        header: "Email / Shop",
        cell: (info) => {
          const row = info.row.original;
          if (row.isLegacy && row.shopName) {
            return (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{row.shopName}</span>
                <span className="text-xs text-slate-500">(Legacy)</span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{info.getValue()}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => {
        if (row.isLegacy) {
          return row.customerProfile?.name || row.shopName || "—";
        }
        return row.customerProfile?.name || row.driverProfile?.name || "—";
      }, {
        id: "name",
        header: "Name",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-slate-400" />
            <span>{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.customerProfile?.phone || row.driverProfile?.phone || "—", {
        id: "phone",
        header: "Phone",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400" />
            <span>{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor((row) => {
        const profile = row.customerProfile || row.driverProfile || {};
        const address = profile.address || "";
        const postcode = profile.postcode || "";
        const city = profile.city || "";
        return [address, postcode, city].filter(Boolean).join(", ") || "—";
      }, {
        id: "address",
        header: "Address",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate max-w-xs">{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor("isApproved", {
        header: "Status",
        cell: (info) => {
          const isApproved = info.getValue();
          const row = info.row.original;
          // Admin users are always approved
          if (row.role === "admin") {
            return (
              <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Approved
              </span>
            );
          }
          return isApproved ? (
            <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Approved
            </span>
          ) : (
            <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-300 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Pending
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const item = info.row.original;
          const isLegacy = item.isLegacy;
          const displayName = isLegacy ? item.shopName : item.email;
          
          return (
            <div className="flex items-center gap-2">
              {!isLegacy && item.role !== "admin" && !item.isApproved && (
                <button
                  onClick={() => handleApprove(item._id)}
                  className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors"
                  title="Approve"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              {!isLegacy && item.role !== "admin" && item.isApproved && (
                <button
                  onClick={() => handleReject(item._id)}
                  className="p-1.5 rounded hover:bg-yellow-500/20 text-yellow-400 hover:text-yellow-300 transition-colors"
                  title="Reject"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              {!isLegacy && (
                <button
                  onClick={() => navigate(`/admin/customers/edit?id=${item._id}`)}
                  className="p-1.5 rounded hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {item.role !== "admin" && (
                <button
                  onClick={() => handleDelete(item._id, displayName, isLegacy)}
                  className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
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
        items={[{ label: "Customers", path: "/admin/customers" }]}
        actionButton={
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {pendingCount} Pending
              </span>
            )}
            <button
              onClick={() => navigate("/admin/customers/new")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/80 text-white text-sm font-medium hover:bg-sky-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Customer
            </button>
          </div>
        }
      />

      <h1 className="text-2xl font-bold text-slate-100 mb-6">Customers</h1>

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
            <Tab active={statusFilter === "legacy"} onClick={() => onChangeStatus("legacy")}>
              Legacy Customers
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
            className="p-1.5 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors border border-slate-700"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-2 ${
                            header.column.getCanSort() ? "cursor-pointer select-none" : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
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
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-slate-300">
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
        <Pagination
          page={page}
          pages={pages}
          pageSize={pageSize}
          total={total}
          itemsCount={rows.length}
          itemLabel="customers"
          onPageChange={(newPage) => {
            if (newPage >= 1 && newPage <= pages) {
              fetchUsers(newPage, statusFilter, q, pageSize, sorting);
            }
          }}
          onPageSizeChange={onChangePageSize}
        />
      </div>
    </div>
  );
}
