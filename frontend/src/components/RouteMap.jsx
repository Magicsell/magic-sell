import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "../lib/config";

// UK Postcode geocode utility
async function geocodePostcode(postcode) {
  if (!postcode || !postcode.trim()) return null;
  try {
    const cleanPostcode = postcode.trim().replace(/\s+/g, '').toUpperCase();
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (data.status === 200 && data.result) {
      const result = {
        lat: data.result.latitude,
        lng: data.result.longitude
      };
      return result;
    }
  } catch (error) {
    // Silent fail
  }
  return null;
}

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
  // Build points from route - use backend coordinates immediately
  const points = useMemo(() => {
    if (!route) {
      return [];
    }
    
    const arr = [];
    
    // Start point (depot)
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
      console.log("[RouteMap] START point:", { lat: route.start.lat, lng: route.start.lng });
    }

    // Process stops - use backend coordinates
    if (route?.stops && Array.isArray(route.stops)) {
      for (const x of route.stops) {
        if (typeof x.lat === "number" && typeof x.lng === "number" && 
            isFinite(x.lat) && isFinite(x.lng) &&
            x.lat >= -90 && x.lat <= 90 &&
            x.lng >= -180 && x.lng <= 180) {
          arr.push({
            lat: x.lat,
            lng: x.lng,
            name: x.name,
            address: x.address || "",
            postcode: x.postcode || "",
            isStart: false,
          });
          console.log(`[RouteMap] STOP ${x.name}:`, { lat: x.lat, lng: x.lng, postcode: x.postcode });
        } else {
          console.warn(`[RouteMap] INVALID coordinates for ${x.name}:`, { lat: x.lat, lng: x.lng });
        }
      }
    }

    console.log(`[RouteMap] Total points: ${arr.length}`);
    return arr;
  }, [route]);

  // Use backend coordinates directly - they are already correct
  // Postcode geocoding disabled because backend coordinates are accurate
  const finalPoints = points;

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

    // First remove layers (they depend on sources)
    [
      "route-line",
      "route-casing",
      "route-fallback-line",
      "route-fallback-casing",
    ].forEach((id) => {
      if (m.getLayer(id)) {
        try {
          m.removeLayer(id);
        } catch (e) {
          // Silent fail
        }
      }
    });

    // Then remove sources (after layers are gone)
    [
      "route",
      "route-fallback",
    ].forEach((src) => {
      if (m.getSource(src)) {
        try {
          m.removeSource(src);
        } catch (e) {
          // Silent fail
        }
      }
    });

    // Remove markers
    markersRef.current.forEach((mrk) => {
      try {
        mrk.remove();
      } catch (e) {
        // Silent fail
      }
    });
    markersRef.current = [];
  }

 function addMarker(p, idx) {
  if (!mapRef.current) {
    return;
  }

  // Validate coordinates - strict validation
  if (
    typeof p.lat !== "number" || 
    typeof p.lng !== "number" || 
    !isFinite(p.lat) || 
    !isFinite(p.lng) ||
    p.lat < -90 || p.lat > 90 ||
    p.lng < -180 || p.lng > 180
  ) {
    return;
  }

  const el = document.createElement("div");
  const isStart = p.isStart === true;
  
  // Start marker için daha büyük ve belirgin stil
  // Don't use position:relative - Mapbox handles positioning
  if (isStart) {
    el.style.cssText = `
      width:36px;height:36px;border-radius:50%;
      background:#1e40af;
      border:3px solid #60a5fa;
      color:#ffffff;display:flex;align-items:center;justify-content:center;
      font-size:14px;font-weight:900;
      box-shadow:0 0 0 3px rgba(96,165,250,.4), 0 2px 8px rgba(0,0,0,.3);
      cursor:pointer;
    `;
    el.innerText = "S";
  } else {
    el.style.cssText = `
      width:32px;height:32px;border-radius:50%;
      background:#0a0f1a;
      border:3px solid #22c55e;
      color:#ffffff;display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:900;
      box-shadow:0 0 0 3px rgba(34,197,94,.4), 0 2px 8px rgba(0,0,0,.4);
      cursor:pointer;
    `;
    el.innerText = String(idx);
  }

  const title   = escapeHtml(p.name || (isStart ? "Depot" : "Stop"));
  const addr    = escapeHtml(p.address || "");
  const postc   = escapeHtml((p.postcode || "").toUpperCase());
  const line2   = [addr, postc].filter(Boolean).join(", ");

  // Create marker with explicit coordinates - Mapbox uses [lng, lat] format
  const coordinates = [Number(p.lng), Number(p.lat)];
  console.log(`[RouteMap] Creating marker ${isStart ? "START" : `#${idx}`} at [${p.lng}, ${p.lat}] for ${p.name}`);
  
  // Create marker - Mapbox will handle positioning
  const m = new mapboxgl.Marker({ 
    element: el,
    anchor: 'center',
    draggable: false
  })
    .setLngLat(coordinates)
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
  
  // Force marker to update position after being added
  // This ensures marker is positioned correctly even after map transforms
  setTimeout(() => {
    if (m && mapRef.current) {
      m.setLngLat(coordinates);
    }
  }, 100);

  markersRef.current.push(m);
}


  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    setErr("");
    clearAll();
    if (finalPoints.length < 1) {
      return;
    }

    // Markers will be created after route is drawn to ensure correct positioning
    // Don't create markers here - they'll be created after route line is drawn

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
        data: lineCoordsFor(finalPoints),
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

      // Fit bounds first
      const rb = new mapboxgl.LngLatBounds();
      finalPoints.forEach((p) => rb.extend([p.lng, p.lat]));
      map.fitBounds(rb, { padding: 60, duration: 600 });
      
      // Create markers AFTER fitBounds animation completes
      setTimeout(() => {
        if (!mapRef.current) return;
        let stopCounter = 1;
        finalPoints.forEach((p) => {
          if (p.isStart) {
            addMarker(p, "S");
          } else {
            addMarker(p, stopCounter);
            stopCounter++;
          }
        });
      }, 650);

      setErr("Mapbox token missing — drawing straight lines as fallback.");
      return;
    }

    let aborted = false;
    (async () => {
      try {
        // coords: start + duraklar (+ roundTrip ise tekrar start)
        // Use finalPoints for route line
        const tripPts = [...finalPoints];
        const roundTrip = !!(
          route?.params?.roundTrip && finalPoints[0]?.isStart
        );
        if (roundTrip && finalPoints[0]) tripPts.push(finalPoints[0]); // depoya dönüş

        const coordsParam = tripPts
          .map((p) => `${p.lng},${p.lat}`)
          .join(";");
        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordsParam}` +
          `?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;
        const r = await fetch(url);
        if (!r.ok) {
          throw new Error(`Directions failed ${r.status}`);
        }
        const j = await r.json();
        const line = j?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(line)) {
          throw new Error("No route geometry");
        }
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

        // Fit bounds first, then create markers after animation completes
        const rb = new mapboxgl.LngLatBounds();
        line.forEach((c) => rb.extend(c));
        // Also include all marker points to ensure they're visible
        finalPoints.forEach((p) => rb.extend([p.lng, p.lat]));
        
        // Fit bounds and create markers after animation completes
        map.fitBounds(rb, { padding: 60, duration: 600 });
        
        // Wait for fitBounds animation to complete, then create markers
        setTimeout(() => {
          if (aborted || !mapRef.current) return;
          
          // Create markers AFTER fitBounds animation completes
          let stopCounter = 1;
          finalPoints.forEach((p) => {
            if (p.isStart) {
              addMarker(p, "S");
            } else {
              addMarker(p, stopCounter);
              stopCounter++;
            }
          });
        }, 650); // Slightly longer than fitBounds duration
      } catch (e) {
        if (aborted) return;

        // fallback: straight line with casing
        map.addSource("route-fallback", {
          type: "geojson",
          data: lineCoordsFor(finalPoints),
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

        // Fit bounds first
        const rb = new mapboxgl.LngLatBounds();
        finalPoints.forEach((p) => rb.extend([p.lng, p.lat]));
        map.fitBounds(rb, { padding: 60, duration: 600 });
        
        // Create markers AFTER fitBounds animation completes
        setTimeout(() => {
          if (!mapRef.current) return;
          let stopCounter = 1;
          finalPoints.forEach((p) => {
            if (p.isStart) {
              addMarker(p, "S");
            } else {
              addMarker(p, stopCounter);
              stopCounter++;
            }
          });
        }, 650);

        setErr(e.message || "Directions error");
      }
    })();

    return () => {
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, finalPoints, route?.params?.roundTrip]);

  if (!route || finalPoints.length === 0) {
    return (
      <div className="h-80 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400">
        {route ? "No valid stops found" : "No route to display"}
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
