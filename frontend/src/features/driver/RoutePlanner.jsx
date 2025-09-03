import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RouteMap from "../../components/RouteMap";
import { API_URL } from "../../lib/config";
import { getUser } from "../auth/auth";
import DeliverModal from "../../components/DeliverModal";

// Bournemouth depot (start)
const DEPOT = { lat: 50.7192, lng: -1.8808 };

function money(v) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(v || 0);
}

export default function RoutePlanner() {
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(null);
  const [err, setErr] = useState("");
  const [withGeo, setWithGeo] = useState(0);

  // ortak modal state
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliverStop, setDeliverStop] = useState(null);

  useEffect(() => {
    fetchWithGeoCount();
  }, []);

  async function publishRoute() {
    if (!route?.stops?.length) return;
    const user = getUser();
    const driver = user?.username || user?.role || "driver";
    try {
      const r = await fetch(`${API_URL}/api/route/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver, ...route }),
      });
      if (!r.ok) throw new Error("Failed to publish route");
      alert("Route published for admin 👍");
    } catch (e) {
      alert(e.message || "Publish failed");
    }
  }

  async function fetchWithGeoCount() {
    try {
      const r = await fetch(
        `${API_URL}/api/orders?pageSize=1&status=pending&withGeo=1`
      );
      const d = await r.json();
      setWithGeo(d?.total || 0);
    } catch {}
  }

  async function build() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/route/from-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: DEPOT,          // Bournemouth depot
          statuses: ["pending"],
          roundTrip: false,      // depoya dönüş istersen true
          serviceMin: 5,
          avgSpeedKmh: 30,
          opt: "2opt",
        }),
      });
      if (!res.ok) throw new Error(`Route API ${res.status}`);
      const data = await res.json();
      setRoute({ ...data, start: DEPOT });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openDeliver(stop) {
    setDeliverStop(stop);
    setDeliverOpen(true);
  }
  async function afterDelivered() {
    setDeliverOpen(false);
    setDeliverStop(null);
    await build();
    await fetchWithGeoCount();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Route Planner</h1>
        <Link to="/driver" className="text-sm underline text-slate-300">
          Back to Driver
        </Link>
      </div>

      <div className="mt-2 text-sm text-slate-400">
        Pending orders with geo:{" "}
        <span className="text-slate-200 font-medium">{withGeo}</span>
      </div>

      <button
        onClick={build}
        disabled={loading}
        className="mt-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {loading ? "Building…" : "Build optimal route"}
      </button>

      {err && (
        <div className="mt-4 rounded-lg bg-red-500/10 text-red-300 px-3 py-2 text-sm border border-red-500/30">
          {err}
        </div>
      )}

      {route?.stops?.length > 0 && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800 font-medium flex items-center justify-between">
              <span>Route summary</span>
              <button
                onClick={publishRoute}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                title="Publish this route for admin"
              >
                Publish route
              </button>
            </div>

            <div className="px-4 py-3 text-sm text-slate-300">
              Start: <b>Bournemouth depot</b> • Method: {route.method} • Total
              distance: <b>{route.totalDistanceKm} km</b> • Drive:{" "}
              <b>{route.totalDriveMinutes} min</b> • Service:{" "}
              <b>{route.totalServiceMinutes} min</b>
            </div>
            <div className="px-4 pb-4">
              <RouteMap route={route} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800 font-medium">
              Stops
            </div>
            <div className="px-4 py-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-2 text-left w-10">#</th>
                    <th className="py-2 text-left">Stop</th>
                    <th className="py-2 text-left">Address</th>
                    <th className="py-2 text-left">From prev (km/min)</th>
                    <th className="py-2 text-left">ETA (min)</th>
                    <th className="py-2 text-left">Amount</th>
                    <th className="py-2 text-left">Maps</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {route.stops.map((s, i) => (
                    <tr key={s.id || s.orderId || i} className="border-t border-slate-800">
                      <td className="py-2">{i + 1}</td>
                      <td className="py-2 font-medium">{s.name}</td>
                      <td className="py-2 text-slate-400">{s.address || "—"}</td>
                      <td className="py-2">
                        {s.distanceFromPrevKm} km / {s.driveMinutesFromPrev} min
                      </td>
                      <td className="py-2">{s.etaMinutes}</td>
                      <td className="py-2">{money(s.amount)}</td>
                      <td className="py-2">
                        <a
                          className="text-indigo-400 underline"
                          href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => {
                            setDeliverStop(s);
                            setDeliverOpen(true);
                          }}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium"
                        >
                          Complete delivery
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <DeliverModal
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        order={{
          id: deliverStop?.orderId || deliverStop?.id || deliverStop?._id,
          title: deliverStop?.name,
          amount: deliverStop?.amount || 0,
        }}
        onSuccess={afterDelivered}
      />
    </div>
  );
}
