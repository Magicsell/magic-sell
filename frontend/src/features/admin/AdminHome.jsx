import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../../lib/config";
import { PaymentBadge } from "../../components/Badges";

export default function AdminHome() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setBusy(true);
        const r = await fetch(`${API_URL}/api/analytics/summary`);
        if (!r.ok) throw new Error("Analytics fetch failed");
        setData(await r.json());
      } catch (e) {
        setErr(e.message || "Error");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const totals = data?.totals ?? {};
  const today = data?.today ?? {};
  const weekly = data?.weekly ?? [];
  // aggregate payments by normalized method (case-insensitive) to avoid duplicates
  const _paymentsRaw = data?.payments ?? [];
  const _paymentsMap = {};
  _paymentsRaw.forEach((p) => {
    const key = (p.method || "Not set").toString().trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(_paymentsMap, key)) {
      _paymentsMap[key] = {
        method: (p.method || "Not set").toString().replace(/\b\w/g, (c) => c.toUpperCase()),
        count: 0,
        amount: 0,
      };
    }
    _paymentsMap[key].count += Number(p.count || 0);
    _paymentsMap[key].amount += Number(p.amount || 0);
  });
  const payments = Object.values(_paymentsMap);
  const status = data?.status ?? [];
  const topCustomers = (data?.topCustomers ?? []).slice(0, 5);
  const recent = (data?.recentOrders ?? []).slice(0, 6);

  return (
    <div className="min-h-screen text-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <div className="flex gap-2">
            <Link
              to="/admin/orders"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              Go to Orders
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Total Orders" value={fmtInt(totals.orders)} />
          <Kpi title="Total Customers" value={fmtInt(totals.totalCustomers)} />
          <Kpi title="Total Revenue" value={fmtGBP(totals.revenue)} />
          <Kpi title="Avg Order Value" value={fmtGBP(totals.avgOrderValue)} />
        </div>

        {/* Today + Weekly */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Today’s Orders</div>
                <div className="mt-1 text-2xl font-semibold">
                  {fmtInt(today.orders)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">Today’s Revenue</div>
                <div className="mt-1 text-2xl font-semibold">
                  {fmtGBP(today.revenue)}
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4 text-xs text-slate-400">
              UK timezone: {data?.meta?.todayStr}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">Last 7 days</div>
              <div className="text-xs text-slate-400">revenue (£)</div>
            </div>

            <TinyBars
               data={weekly || []}
              getValue={(d) => Number(d?.revenue || 0)}
              label={(d) => d?.date}
            />
          </Card>
        </div>

        {/* Breakdown */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <div className="font-medium mb-3">Payment Methods</div>
            <ul className="space-y-2">
              {payments.length === 0 && (
                <li className="text-sm text-slate-400">No data</li>
              )}
              {payments.map((p) => (
                <li
                  key={p.method}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Dot className={dotByMethod(p.method)} />
                    <div className="capitalize">{(p.method || "Not set").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
                  </div>
                  <div className="text-sm text-slate-300">
                    {fmtInt(p.count)} • {fmtGBP(p.amount)}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="font-medium mb-3">Order Status</div>
            <ul className="space-y-2">
              {status.length === 0 && (
                <li className="text-sm text-slate-400">No data</li>
              )}
              {status.map((s) => (
                <li
                  key={s.status}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Dot
                      className={
                        s.status === "delivered"
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }
                    />
                    <div className="capitalize">{s.status}</div>
                  </div>
                  <div className="text-sm text-slate-300">
                    {fmtInt(s.count)}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="font-medium mb-3">Top Customers</div>
            <ul className="space-y-2">
              {topCustomers.length === 0 && (
                <li className="text-sm text-slate-400">No data</li>
              )}
              {topCustomers.map((c, i) => (
                <li
                  key={c.customerName + i}
                  className="flex items-center justify-between"
                >
                  <div className="truncate">{c.customerName || "—"}</div>
                  <div className="text-sm text-slate-300">
                    {fmtInt(c.orders)} • {fmtGBP(c.revenue)}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Recent orders */}
        <div className="mt-6">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="font-medium">Recent Orders</div>
              <Link
                to="/admin/orders"
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                view all →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-400">
                      <tr>
                        <Th>#</Th>
                        <Th>Date</Th>
                        <Th>Shop</Th>
                        <Th>Customer</Th>
                        <Th>Total</Th>
                        <Th>Payment</Th>
                        <Th>Status</Th>
                      </tr>
                </thead>
                <tbody>
                  {recent.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-slate-400"
                      >
                        No data
                      </td>
                    </tr>
                  )}
                  {recent.map((o) => (
                    <tr key={o._id} className="border-t border-white/10">
                      <Td>{o.orderNo ? `#${pad(o.orderNo)}` : "—"}</Td>
                      <Td>{fmtDate(o.orderDate)}</Td>
                      <Td>{o.shopName}</Td>
                      <Td className="truncate max-w-[18ch]">
                        {o.customerName || "—"}
                      </Td>
                      <Td>{fmtGBP(o.totalAmount)}</Td>
                      <Td><PaymentBadge method={o.paymentMethod} /></Td>
                      <Td>
                        <Badge kind={o.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* States */}
        {busy && <div className="mt-4 text-sm text-slate-400">Loading…</div>}
        {err && <div className="mt-4 text-sm text-red-400">{err}</div>}
      </div>
    </div>
  );
}

/* ---------- tiny UI bits ---------- */

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-slate-900/60 p-4 shadow-xl ${className}`}
    >
      {children}
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <Card>
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function TinyBars({ data = [] }) {
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return (
      <div className="px-4 py-6 text-sm text-slate-400">
        No data for last 7 days.
      </div>
    );
  }

  const H = 120; // grafiğin toplam yükseklik ölçeği
  const max = Math.max(...rows.map(r => Number(r?.revenue || 0)), 1);
  const cols = Math.max(rows.length, 7); // en az 7 kolon

  return (
    <div className="px-4 py-3">
      <div
        className="grid items-end gap-4 h-[140px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {rows.map((r, i) => {
          const v = Number(r?.revenue || 0);
          const h = v === 0 ? 4 : Math.max(8, Math.round((v / max) * H));
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              {/* Tutar etiketi (0 değilse göster) */}
              <div className="h-4 text-xs font-medium text-emerald-400 leading-none">
                {v ? `£${fmtInt(v)}` : ""}
              </div>

              {/* Bar */}
              <div className="w-6 rounded-md bg-emerald-500/20 overflow-hidden">
                <div className="w-full bg-emerald-500 rounded-md" style={{ height: h }} />
              </div>

              {/* Tarih (GG/AA) */}
              <div className="text-[11px] text-slate-400">{dm(r?.date)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ kind }) {
  const cls =
    kind === "delivered"
      ? "bg-emerald-600/20 text-emerald-300 ring-emerald-500/30"
      : "bg-amber-600/20 text-amber-300 ring-amber-500/30";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${cls}`}>
      {cap(kind || "—")}
    </span>
  );
}

function Th({ children }) {
  return <th className="py-2 pr-4">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`py-3 pr-4 ${className}`}>{children}</td>;
}

function Dot({ className = "" }) {
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />
  );
}

/* ---------- helpers ---------- */

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
function fmtGBP(x) {
  return GBP.format(Number(x || 0));
}
function fmtInt(x) {
  return Number(x || 0).toLocaleString("en-GB");
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
function pad(n) {
  const s = String(n ?? "");
  return s.length >= 4 ? s : "0".repeat(4 - s.length) + s;
}
function cap(s) {
  return (s || "").slice(0, 1).toUpperCase() + (s || "").slice(1);
}

function dotByMethod(m) {
  const key = (m || "").toLowerCase();
  if (key.includes("cash")) return "bg-emerald-500";
  if (key.includes("card")) return "bg-indigo-500";
  if (key.includes("bank")) return "bg-cyan-500";
  if (key.includes("balance")) return "bg-amber-500";
  return "bg-slate-400";
}

function dm(ymd) {
  if (!ymd) return "";
  const [_y, m, d] = String(ymd).split("-");
  return `${d}/${m}`;
}

