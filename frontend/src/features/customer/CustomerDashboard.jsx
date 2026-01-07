import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { StatusBadge, PaymentBadge } from "../../components/Badges";
import { Package, ShoppingCart, Clock, CheckCircle, TrendingUp, ArrowRight } from "lucide-react";

function fmtGBP(n) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n || 0);
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

export default function CustomerDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    totalSpent: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch customer's orders
      const ordersData = await apiGet("/api/orders?page=1&pageSize=10&sort=-orderDate");
      const orders = ordersData.items || [];

      // Calculate stats
      const totalOrders = orders.length;
      const pendingOrders = orders.filter((o) => (o.status || "").toLowerCase() !== "delivered").length;
      const deliveredOrders = orders.filter((o) => (o.status || "").toLowerCase() === "delivered").length;
      const totalSpent = orders
        .filter((o) => (o.status || "").toLowerCase() === "delivered")
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      setStats({ totalOrders, pendingOrders, deliveredOrders, totalSpent });
      setRecentOrders(orders.slice(0, 5));
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Total Orders
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalOrders}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </div>
          <div className="text-2xl font-bold text-yellow-300">{stats.pendingOrders}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Delivered
          </div>
          <div className="text-2xl font-bold text-emerald-300">{stats.deliveredOrders}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Total Spent
          </div>
          <div className="text-2xl font-bold text-sky-300">{fmtGBP(stats.totalSpent)}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 flex gap-3">
        <Link
          to="/customer/products"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600/80 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          Browse Products
        </Link>
        <Link
          to="/customer/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          View All Orders
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
          <span className="font-semibold text-slate-200">Recent Orders</span>
          <Link
            to="/customer/orders"
            className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
          >
            View all
          </Link>
        </div>
        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading...</div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-500" />
            <div className="text-sm">No orders yet</div>
            <Link
              to="/customer/products"
              className="mt-2 inline-block text-sm text-sky-400 hover:text-sky-300"
            >
              Start shopping →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentOrders.map((order) => (
              <div
                key={order._id}
                className="px-4 py-3 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-200">
                        Order #{String(order.orderNo || order._id).padStart(4, "0")}
                      </span>
                      <StatusBadge status={order.status} />
                      <PaymentBadge method={order.paymentMethod} />
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      {fmtDate(order.orderDate)} • {order.shopName || order.customerName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-100">{fmtGBP(order.totalAmount)}</div>
                    {order.items && order.items.length > 0 && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
