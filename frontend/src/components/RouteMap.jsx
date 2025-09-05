import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "../lib/config";

const ROUTE_COLOR = "#4f46e5"; // indigo-600 – istersen #ef4444, #2563eb, #14b8a6…
const WIDTH = ["interpolate", ["linear"], ["zoom"], 9, 3, 14, 7];
const CASING_WIDTH = ["interpolate", ["linear"], ["zoom"], 9, 6, 14, 12];

export default function RouteMap({ route }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [err, setErr] = useState("");

  // start + stops → çizim sırası
  const points = useMemo(() => {
    const arr = [];
    if (
      route?.start &&
      typeof route.start.lat === "number" &&
      typeof route.start.lng === "number"
    ) {
      arr.push({
        ...route.start,
        name: "Depot",
        address: "Bournemouth",
        isStart: true,
      });
    }
    for (const x of route?.stops || []) {
      if (typeof x?.lat === "number" && typeof x?.lng === "number") {
        arr.push({
          lat: x.lat,
          lng: x.lng,
          name: x.name,
          address: x.address,
          isStart: false,
        });
      }
    }
    return arr;
  }, [route]);

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN || "";
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-1.8808, 50.7192], // Bournemouth fallback
      zoom: 9,
      attributionControl: false,
    });
    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-left"
    );
    map.on("load", () => setMapLoaded(true));
    mapRef.current = map;
    return () => {
      clearAll();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearAll() {
    const m = mapRef.current;
    if (!m) return;

    [
      "route",
      "route-fallback",
    ].forEach((src) => m.getSource(src) && m.removeSource(src));

    [
      "route-line",
      "route-casing",
      "route-fallback-line",
      "route-fallback-casing",
    ].forEach((id) => m.getLayer(id) && m.removeLayer(id));

    markersRef.current.forEach((mrk) => mrk.remove());
    markersRef.current = [];
  }

 function addMarker(p, idx) {
  const el = document.createElement("div");
  el.style.cssText = `
    width:28px;height:28px;border-radius:50%;
    background:${p.isStart ? "#0b1220" : "#0a0f1a"};
    border:2px solid ${p.isStart ? "#60a5fa" : "#22c55e"};
    color:#e5fff1;display:flex;align-items:center;justify-content:center;
    font-size:12px;font-weight:700;box-shadow:0 0 0 2px rgba(34,197,94,.25);
  `;
  el.innerText = p.isStart ? "S" : String(idx); // start = S, duraklar 1..n

  const title   = escapeHtml(p.name || (p.isStart ? "Depot" : "Stop"));
  const addr    = escapeHtml(p.address || "");
  const postc   = escapeHtml((p.postcode || "").toUpperCase());
  const line2   = [addr, postc].filter(Boolean).join(", ");

  const m = new mapboxgl.Marker({ element: el })
    .setLngLat([p.lng, p.lat])
    .setPopup(
      new mapboxgl.Popup({ offset: 12 }).setHTML(`
        <div style="font-weight:600;margin-bottom:4px; color:#111827;">
          ${title}
        </div>
        <div style="font-size:12px; color:#334155;">
          ${line2}
        </div>
      `)
    )
    .addTo(mapRef.current);

  markersRef.current.push(m);
}


  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    setErr("");
    clearAll();
    if (points.length < 1) return;

    // markers: ilk nokta start, kalanlar 1..n numaralı
    points.forEach((p, i) => addMarker(p, p.isStart ? "S" : i));

    // bounds
    const bounds = new mapboxgl.LngLatBounds();
    points.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 40, duration: 600 });

    // helpers
    const featureFor = (coords) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
    });
    const lineCoordsFor = (pts) =>
      featureFor(pts.map((p) => [p.lng, p.lat]));

    // token yoksa düz çizgi (casing + line)
    if (!MAPBOX_TOKEN) {
      map.addSource("route-fallback", {
        type: "geojson",
        data: lineCoordsFor(points),
      });

      map.addLayer({
        id: "route-fallback-casing",
        type: "line",
        source: "route-fallback",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 0.65,
          "line-width": CASING_WIDTH,
          "line-blur": 0.2,
        },
      });

      map.addLayer({
        id: "route-fallback-line",
        type: "line",
        source: "route-fallback",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ROUTE_COLOR,
          "line-width": WIDTH,
          "line-opacity": 0.95,
        },
      });

      setErr("Mapbox token missing — drawing straight lines as fallback.");
      return;
    }

    let aborted = false;
    (async () => {
      try {
        // coords: start + duraklar (+ roundTrip ise tekrar start)
        const tripPts = [...points];
        const roundTrip = !!(
          route?.params?.roundTrip && points[0]?.isStart
        );
        if (roundTrip) tripPts.push(points[0]); // depoya dönüş

        const coordsParam = tripPts
          .map((p) => `${p.lng},${p.lat}`)
          .join(";");
        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordsParam}` +
          `?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Directions failed ${r.status}`);
        const j = await r.json();
        const line = j?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(line)) throw new Error("No route geometry");
        if (aborted || !mapRef.current) return;

        // tek source, iki layer (casing + line)
        if (!map.getSource("route")) {
          map.addSource("route", {
            type: "geojson",
            data: featureFor(line),
          });

          map.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#ffffff",
              "line-opacity": 0.65,
              "line-width": CASING_WIDTH,
              "line-blur": 0.2,
            },
          });

          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": ROUTE_COLOR,
              "line-width": WIDTH,
              "line-opacity": 0.95,
            },
          });
        } else {
          const src = map.getSource("route");
          src.setData(featureFor(line));
        }

        const rb = new mapboxgl.LngLatBounds();
        line.forEach((c) => rb.extend(c));
        map.fitBounds(rb, { padding: 40, duration: 600 });
      } catch (e) {
        if (aborted) return;

        // fallback: straight line with casing
        map.addSource("route-fallback", {
          type: "geojson",
          data: lineCoordsFor(points),
        });
        map.addLayer({
          id: "route-fallback-casing",
          type: "line",
          source: "route-fallback",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.65,
            "line-width": CASING_WIDTH,
            "line-blur": 0.2,
          },
        });
        map.addLayer({
          id: "route-fallback-line",
          type: "line",
          source: "route-fallback",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ROUTE_COLOR,
            "line-width": WIDTH,
            "line-opacity": 0.95,
          },
        });

        setErr(e.message || "Directions error");
      }
    })();

    return () => {
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, points, route?.params?.roundTrip]);

  if (!route || points.length === 0) {
    return (
      <div className="h-80 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400">
        No route to display
      </div>
    );
  }

  return (
    <div className="h-[420px] rounded-xl overflow-hidden border border-slate-800">
      <div ref={containerRef} className="w-full h-full" />
      {err && (
        <div className="text-xs px-2 py-1 bg-amber-500/10 text-amber-300 border-t border-amber-500/30">
          {err}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}
