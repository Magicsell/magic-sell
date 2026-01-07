import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import RouteMap from "../../components/RouteMap";
import { apiGet, apiPost } from "../../lib/api";
import { getUser } from "../auth/auth";
import DeliverModal from "../../components/DeliverModal";
import { MapPin, Navigation, RefreshCw, CheckCircle, ExternalLink } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";

const DEPOT = {
  lat: 50.707088,
  lng: -1.922318,
  postcode: "BH13 7EX",
};

// UK Postcode yakalayıcı (adres sonundan alır)
const UK_POST_RE = /([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})$/i;

function money(v) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(v || 0);
}

// Google Maps destination metnini üretir (postcode > adresten postcode > lat,lng > adres)
function toMapsDestination(stop) {
  const pc = (stop.postcode || "").trim();
  if (pc) return pc;

  const addr = (stop.address || "").toUpperCase();
  const m = UK_POST_RE.exec(addr);
  if (m?.[1]) return m[1];

  if (typeof stop.lat === "number" && typeof stop.lng === "number") {
    return `${stop.lat},${stop.lng}`;
  }
  return stop.address || "";
}

export default function RoutePlanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(null);
  const [err, setErr] = useState("");
  const [withGeo, setWithGeo] = useState(0);

  // Modal state
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliverStop, setDeliverStop] = useState(null);

  // Get order IDs from query params
  const orderIdsParam = searchParams.get("orderIds");
  const selectedOrderIds = orderIdsParam
    ? orderIdsParam.split(",").filter(Boolean)
    : null;

  async function fetchWithGeoCount() {
    try {
      const d = await apiGet("/api/orders?pageSize=1&status=pending&withGeo=1");
      setWithGeo(d?.total || 0);
    } catch {}
  }

  // Build function - only depends on orderIdsParam string to prevent infinite loops
  const build = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const requestBody = {
        start: DEPOT,
        statuses: ["pending"],
        roundTrip: false,
        serviceMin: 5,
        avgSpeedKmh: 30,
        opt: "2opt",
      };

      // Parse order IDs from query param if provided
      const orderIds = orderIdsParam
        ? orderIdsParam.split(",").filter(Boolean)
        : null;

      // Add order IDs if provided
      if (orderIds && orderIds.length > 0) {
        requestBody.orderIds = orderIds;
        console.log("[RoutePlanner] Building route with orderIds:", orderIds);
        console.log("[RoutePlanner] Request body:", JSON.stringify(requestBody, null, 2));
      } else {
        console.log("[RoutePlanner] Building route with all pending orders");
      }

      const data = await apiPost("/api/route/from-orders", requestBody);
      console.log("[RoutePlanner] Received route data, stops count:", data?.stops?.length || 0);
      console.log("[RoutePlanner] Route stops:", data?.stops?.map(s => ({ id: s.id, name: s.name })));
      console.log("[RoutePlanner] Setting route with DEPOT:", DEPOT);
      const routeWithStart = { ...data, start: DEPOT };
      console.log("[RoutePlanner] Final route object:", { 
        start: routeWithStart.start, 
        stopsCount: routeWithStart.stops?.length,
        stops: routeWithStart.stops?.map(s => ({ name: s.name, lat: s.lat, lng: s.lng }))
      });
      setRoute(routeWithStart);
    } catch (e) {
      setErr(e.message || "Failed to build route");
    } finally {
      setLoading(false);
    }
  }, [orderIdsParam]); // Only depend on orderIdsParam string, not the array

  // Auto-build route on mount and when orderIds change
  useEffect(() => {
    build();
    fetchWithGeoCount();
  }, [build]);

  async function publishRoute() {
    if (!route?.stops?.length) return;
    const user = getUser();
    const driver = user?.email || user?.role || "driver";
    try {
      await apiPost("/api/route/active", { driver, ...route });
      alert("Route published for admin 👍");
    } catch (e) {
      alert(e.message || "Publish failed");
    }
  }

  function openDeliver(stop) {
    setDeliverStop(stop);
    setDeliverOpen(true);
  }

  async function afterDelivered() {
    setDeliverOpen(false);
    setDeliverStop(null);
    // Navigate to driver dashboard after successful delivery
    navigate("/driver");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Driver Dashboard", path: "/driver" },
          { label: "Route Planner" },
        ]}
        actionButton={
          <div className="flex items-center gap-2">
            <button
              onClick={build}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors border border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {route?.stops?.length > 0 && (
              <button
                onClick={publishRoute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/80 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
              >
                <Navigation className="w-4 h-4" />
                Publish Route
              </button>
            )}
          </div>
        }
      />

      <h1 className="text-2xl font-bold text-slate-100 mb-6">Route Planner</h1>

      {/* Info */}
      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span>
            {selectedOrderIds && selectedOrderIds.length > 0 ? (
              <>
                Building route for <span className="font-medium text-white">{selectedOrderIds.length}</span> selected order{selectedOrderIds.length !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                Pending orders with location: <span className="font-medium text-white">{withGeo}</span>
              </>
            )}
          </span>
        </div>
      </div>

      {loading && (
        <div className="text-center text-slate-400 py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-400" />
          <div>Building optimal route...</div>
        </div>
      )}

      {err && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/15 text-red-300 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {!loading && route?.stops?.length > 0 && (
        <div className="space-y-6">
          {/* Route Summary */}
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
              <span className="font-semibold text-slate-200">Route Summary</span>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Start</div>
                  <div className="font-medium text-slate-200">Bournemouth Depot</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Method</div>
                  <div className="font-medium text-slate-200">{route.method || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Total Distance</div>
                  <div className="font-medium text-slate-200">{route.totalDistanceKm?.toFixed(1) || "—"} km</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Total Time</div>
                  <div className="font-medium text-slate-200">
                    {route.totalDriveMinutes ? `${route.totalDriveMinutes} min` : "—"}
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <RouteMap route={route} />
              </div>
            </div>
          </div>

          {/* Stops Table */}
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
              <span className="font-semibold text-slate-200">Stops ({route.stops.length + 1})</span>
            </div>
            <div className="px-4 py-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-2 text-left w-10">#</th>
                    <th className="py-2 text-left">Stop</th>
                    <th className="py-2 text-left">Address</th>
                    <th className="py-2 text-left">Distance</th>
                    <th className="py-2 text-left">ETA</th>
                    <th className="py-2 text-left">Amount</th>
                    <th className="py-2 text-left">Maps</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {/* Start (Depot) Row */}
                  <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors bg-slate-800/20">
                    <td className="py-3 font-medium">0</td>
                    <td className="py-3 font-medium text-sky-300">Bournemouth Depot</td>
                    <td className="py-3 text-slate-400">{DEPOT.postcode || "—"}</td>
                    <td className="py-3 text-slate-400">—</td>
                    <td className="py-3">0 min</td>
                    <td className="py-3 font-medium">—</td>
                    <td className="py-3">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(DEPOT.postcode)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                        title="Open in Google Maps"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Go
                      </a>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 text-sm">
                        Start
                      </span>
                    </td>
                  </tr>
                  {/* Order Stops */}
                  {route.stops.map((s, i) => {
                    const destination = toMapsDestination(s);
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      destination
                    )}`;
                    return (
                      <tr
                        key={s.id || s.orderId || i}
                        className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 font-medium">{i + 1}</td>
                        <td className="py-3 font-medium">{s.name}</td>
                        <td className="py-3 text-slate-400">{s.address || "—"}</td>
                        <td className="py-3 text-slate-400">
                          {s.distanceFromPrevKm?.toFixed(1) || "—"} km / {s.driveMinutesFromPrev || "—"} min
                        </td>
                        <td className="py-3">{s.etaMinutes || "—"} min</td>
                        <td className="py-3 font-medium">{money(s.amount)}</td>
                        <td className="py-3">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                            title="Open in Google Maps"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Go
                          </a>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => openDeliver(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Complete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && (!route?.stops || route.stops.length === 0) && !err && (
        <div className="text-center text-slate-400 py-12">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-500" />
          <div className="text-lg font-medium mb-2">No route available</div>
          <div className="text-sm">
            {selectedOrderIds && selectedOrderIds.length > 0
              ? "Selected orders do not have valid locations."
              : "No pending orders with location found."}
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
          paymentMethod: deliverStop?.paymentMethod || "Not Set",
          paymentBreakdown: deliverStop?.paymentBreakdown || {
            balanceAmount: 0,
            cashAmount: 0,
            cardAmount: 0,
            bankAmount: 0,
          },
        }}
        onSuccess={afterDelivered}
      />
    </div>
  );
}
