import { useEffect, useMemo, useState } from "react";
import RouteMap from "../../components/RouteMap";
import { API_URL } from "../../lib/config";

const DEPOT = {
  lat: 50.707088,
  lng: -1.922318,
  postcode: "BH13 7EX",
};

export default function AdminDriverBoard() {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deliveredToday, setDeliveredToday] = useState(() => new Set());

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try {
      setLoading(true);
      setErr("");

      // 1) Pending siparişlerden, BAŞLANGIÇ = DEPOT olacak şekilde rotayı hesapla
      const r1 = await fetch(`${API_URL}/api/route/from-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: DEPOT,
          statuses: ["pending"],
          roundTrip: false,      // istersen true yapıp depoya dönüşü de çizebiliriz
          serviceMin: 5,
          avgSpeedKmh: 30,
          opt: "2opt",
        }),
      });
      if (!r1.ok) throw new Error("Failed to compute route from orders");
      const computed = await r1.json();
      // start bilgisini de map'e gönderelim
      setRoute({ ...computed, start: DEPOT });

      // 2) Bugün teslim edilenler (rozetler için)
      const r2 = await fetch(
        `${API_URL}/api/orders?date=today&status=delivered&pageSize=500`
      );
      const today = await r2.json();
      const deliveredIds =
        (Array.isArray(today?.items) ? today.items : today)?.map((o) => String(o._id)) || [];
      setDeliveredToday(new Set(deliveredIds));
    } catch (e) {
      setErr(e.message || "Failed to fetch");
      setRoute({ stops: [], start: DEPOT });
    } finally {
      setLoading(false);
    }
  }

  const stops = useMemo(() => route?.stops || [], [route]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Driver Board</h1>
        <button
          onClick={refresh}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {err && (
        <div className="rounded-lg bg-red-500/10 text-red-300 px-3 py-2 text-sm border border-red-500/30">
          {err}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 font-medium">
          Current route (start: Bournemouth depot)
        </div>
        <div className="p-4">
          {loading ? (
            <div className="h-40 animate-pulse bg-slate-800 rounded-lg" />
          ) : stops.length ? (
            <RouteMap route={route} />
          ) : (
            <div className="text-slate-400 text-sm">
              No pending orders with geo. Create orders or add postcode/address.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 font-medium">Stops</div>
        <div className="px-4 py-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2 text-left w-10">#</th>
                <th className="py-2 text-left">Stop</th>
                <th className="py-2 text-left">Address</th>
                <th className="py-2 text-left">From prev</th>
                <th className="py-2 text-left">ETA</th>
                <th className="py-2 text-left">Amount</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {stops.map((s, i) => {
                const id = String(s.orderId || s.id || i);
                const delivered = deliveredToday.has(id);
                return (
                  <tr key={id} className="border-t border-slate-800">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2 text-slate-400">{s.address || "—"}</td>
                    <td className="py-2 text-slate-400">
                      {s.distanceFromPrevKm} km / {s.driveMinutesFromPrev} min
                    </td>
                    <td className="py-2">{s.etaMinutes} min</td>
                    <td className="py-2">£{Number(s.amount || 0).toFixed(2)}</td>
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          delivered
                            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                            : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30"
                        }`}
                      >
                        {delivered ? "Delivered" : "Pending"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
