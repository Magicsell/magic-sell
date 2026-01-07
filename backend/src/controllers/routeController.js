// src/controllers/routeController.js
import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { ActiveRoute } from "../models/ActiveRoute.js";

const RAD = Math.PI / 180;
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

function nearestNeighbor(stops, start) {
  const n = stops.length;
  const unvis = new Set(stops.map((_, i) => i));
  const path = [];
  let cur;

  if (start) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = haversineKm(start, stops[i]);
      if (d < bestD) bestD = d, best = i;
    }
    cur = best;
  } else {
    cur = 0;
  }
  unvis.delete(cur);
  path.push(cur);

  while (unvis.size) {
    let best = -1, bestD = Infinity;
    for (const i of unvis) {
      const d = haversineKm(stops[cur], stops[i]);
      if (d < bestD) bestD = d, best = i;
    }
    cur = best;
    unvis.delete(cur);
    path.push(cur);
  }
  return path;
}

// küçük iyileştirme
function twoOpt(path, pts, startPt, endPt, roundTrip) {
  const getPt = (i) => pts[i];
  const km = (a, b) => haversineKm(a, b);
  const total = (p) => {
    let d = 0;
    if (startPt) d += km(startPt, getPt(p[0]));
    for (let i = 0; i < p.length - 1; i++) d += km(getPt(p[i]), getPt(p[i + 1]));
    if (roundTrip && startPt) d += km(getPt(p[p.length - 1]), startPt);
    else if (endPt) d += km(getPt(p[p.length - 1]), endPt);
    return d;
  };
  let best = path.slice();
  let bestD = total(best);
  let improved = true, iter = 0;
  while (improved && iter++ < 200) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const d = total(cand);
        if (d + 1e-9 < bestD) { best = cand; bestD = d; improved = true; }
      }
    }
  }
  return best;
}

function computeRoute({ start, end, stops, roundTrip = true, serviceMin = 5, avgSpeedKmh = 30, opt = "2opt" }) {
  let orderIdx = nearestNeighbor(stops, start || null);
  if (opt === "2opt") orderIdx = twoOpt(orderIdx, stops, start || null, end || null, roundTrip);

  const kmPerMin = avgSpeedKmh / 60;
  const result = [];
  let totalKm = 0, driveMin = 0, serviceTotal = 0;
  let prev = start || stops[orderIdx[0]];

  for (let step = 0; step < orderIdx.length; step++) {
    const s = stops[orderIdx[step]];
    const dKm = haversineKm(prev, s);
    const dMin = dKm / kmPerMin;
    driveMin += dMin;
    serviceTotal += serviceMin;
    totalKm += dKm;
    result.push({
      ...s,
      order: step + 1,
      distanceFromPrevKm: Number(dKm.toFixed(2)),
      driveMinutesFromPrev: Math.round(dMin),
      cumulativeDistanceKm: Number(totalKm.toFixed(2)),
      etaMinutes: Math.round(driveMin + serviceTotal),
    });
    prev = s;
  }
  if (roundTrip || end) {
    const backTo = end || (start || stops[orderIdx[0]]);
    const dKm = haversineKm(prev, backTo);
    const dMin = dKm / kmPerMin;
    totalKm += dKm;
    driveMin += dMin;
  }

  return {
    method: "nearest" + (opt === "2opt" ? "+2opt" : ""),
    params: { roundTrip, serviceMin, avgSpeedKmh },
    start: start || null,
    end: end || null,
    totalDistanceKm: Number(totalKm.toFixed(2)),
    totalDriveMinutes: Math.round(driveMin),
    totalServiceMinutes: Math.round(serviceTotal),
    totalMinutes: Math.round(driveMin + serviceTotal),
    stops: result,
  };
}

// POST /api/route/plan
export async function planRoute(req, res) {
  try {
    const { start, end, stops, roundTrip = true, serviceMin = 5, avgSpeedKmh = 30, opt = "2opt" } = req.body || {};
    if (!Array.isArray(stops) || !stops.length) return res.status(400).json({ error: "stops[] required" });
    for (const s of stops) {
      if (typeof s?.lat !== "number" || typeof s?.lng !== "number") return res.status(400).json({ error: "each stop needs numeric lat/lng" });
    }
    if (start && (typeof start.lat !== "number" || typeof start.lng !== "number")) return res.status(400).json({ error: "start.lat/lng must be numeric" });
    if (end && (typeof end.lat !== "number" || typeof end.lng !== "number")) return res.status(400).json({ error: "end.lat/lng must be numeric" });

    const route = computeRoute({ start, end, stops, roundTrip, serviceMin, avgSpeedKmh, opt });
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// src/controllers/routeController.js
export async function planFromOrders(req, res) {
  try {
    const {
      start, end,
      statuses = ["pending"],
      orderIds, // Array of order IDs to include (optional)
      roundTrip = true,
      serviceMin = 5,
      avgSpeedKmh = 30,
      opt = "2opt"
    } = req.body || {};

    const match = {
      "geo.lat": { $type: "number" },
      "geo.lng": { $type: "number" }
    };

    // Filter by specific order IDs if provided
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      console.log("[planFromOrders] Received orderIds:", orderIds);
      const validIds = orderIds
        .filter(id => id && typeof id === "string")
        .map(id => {
          try {
            return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      
      console.log("[planFromOrders] Valid orderIds:", validIds.map(id => id.toString()));
      
      if (validIds.length > 0) {
        // When specific order IDs are provided, only filter by IDs (ignore status)
        match._id = { $in: validIds };
        console.log("[planFromOrders] Filtering by orderIds only, match:", JSON.stringify(match));
      } else {
        // No valid IDs, return empty result
        console.log("[planFromOrders] No valid order IDs, returning empty");
        return res.json({ message: "No valid order IDs provided", totalDistanceKm: 0, stops: [] });
      }
    } else {
      // No orderIds provided, use status filter for all pending orders
      match.status = { $in: statuses };
      console.log("[planFromOrders] No orderIds provided, using all pending orders");
    }

    // Tenant filter
    if (req.organizationId) {
      match.organizationId = req.organizationId;
    }

    const orders = await Order.find(match)
      .select("_id shopName customerName customerAddress customerPostcode totalAmount paymentMethod paymentBreakdown geo")
      .lean();

    console.log("[planFromOrders] Found orders:", orders.length);
    console.log("[planFromOrders] Order IDs:", orders.map(o => o._id.toString()));

    if (!orders.length) {
      return res.json({ message: "No orders with geo for given filter", totalDistanceKm: 0, stops: [] });
    }

    const stops = orders.map(o => ({
      id: String(o._id),
      name: o.shopName || o.customerName || String(o._id),
      address: [o.customerAddress, o.customerPostcode].filter(Boolean).join(", "),
      lat: o.geo.lat,
      lng: o.geo.lng,
      orderId: String(o._id),
      amount: o.totalAmount ?? 0,
      paymentMethod: o.paymentMethod || "Not Set",
      paymentBreakdown: o.paymentBreakdown || {
        balanceAmount: 0,
        cashAmount: 0,
        cardAmount: 0,
        bankAmount: 0,
      },
    }));

    const route = computeRoute({ start, end, stops, roundTrip, serviceMin, avgSpeedKmh, opt });
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// POST /api/route/active  → sürücünün rotasını yayınla (upsert)
export async function setActiveRoute(req, res) {
  try {
    const b = req.body || {};
    if (!b?.stops?.length) return res.status(400).json({ message: "stops required" });
    const driver = b.driver || "driver";

    // Tenant filter
    const query = { driver };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const doc = await ActiveRoute.findOneAndUpdate(
      query,
      {
        organizationId: req.organizationId || b.organizationId, // Tenant support
        driver,
        start: b.start || null,
        method: b.method || "2opt",
        totalDistanceKm: b.totalDistanceKm ?? null,
        totalDriveMinutes: b.totalDriveMinutes ?? null,
        totalServiceMinutes: b.totalServiceMinutes ?? null,
        stops: b.stops,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

// GET /api/route/active  → en güncel yayınlanmış rota (opsiyonel ?driver=foo)
export async function getActiveRoute(req, res) {
  try {
    const { driver } = req.query || {};
    const q = driver ? { driver } : {};
    
    // Tenant filter
    if (req.organizationId) {
      q.organizationId = req.organizationId;
    }
    
    const doc = await ActiveRoute.findOne(q).sort({ updatedAt: -1 }).lean();
    if (!doc) return res.json({ stops: [] });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}


