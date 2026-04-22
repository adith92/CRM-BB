import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Marker } from "react-leaflet";
import { api } from "../lib/api";
import { useTheme } from "../contexts/AppContext";

// Jakarta center
export const JAKARTA = { lat: -6.2, lng: 106.82, zoom: 11 };

const STATUS_COLORS = {
  available: "#10b981",
  on_trip: "#f59e0b",
  offline: "#71717a",
  maintenance: "#e11d48",
};

function AutoFit({ vehicles, fit }) {
  const map = useMap();
  useEffect(() => {
    if (!fit || !vehicles?.length) return;
    const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng]));
    map.fitBounds(bounds.pad(0.1), { animate: true });
  }, [fit, vehicles, map]);
  return null;
}

function TileTheme() {
  const { theme } = useTheme();
  // Both themes use OSM; CSS filter in index.css darkens the tiles in .dark mode
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
  );
}

/** Compact shared map used on dashboard and full live map page. */
export function FleetMap({
  vehicles = [],
  height = "100%",
  interactive = true,
  fitOnLoad = true,
  onVehicleClick,
  showTrips = [],
  className = "",
}) {
  const fitted = useRef(false);
  const [fitKey, setFitKey] = useState(0);
  useEffect(() => {
    if (!fitted.current && vehicles.length > 0) {
      fitted.current = true;
      setFitKey((k) => k + 1);
    }
  }, [vehicles.length]);

  return (
    <div className={`relative rounded-md overflow-hidden ${className}`} style={{ height }}>
      <MapContainer
        center={[JAKARTA.lat, JAKARTA.lng]}
        zoom={JAKARTA.zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        style={{ height: "100%", width: "100%" }}
      >
        <TileTheme />
        {fitOnLoad && <AutoFit vehicles={vehicles} fit={fitKey} />}
        {vehicles.map((v) => (
          <CircleMarker
            key={v.vehicle_id}
            center={[v.lat, v.lng]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: STATUS_COLORS[v.status] || "#3f3f46",
              fillOpacity: 0.95,
            }}
            eventHandlers={onVehicleClick ? { click: () => onVehicleClick(v) } : undefined}
          >
            {interactive && (
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{v.plate}</div>
                  <div className="text-zinc-500 text-xs">{v.model} · {v.type}</div>
                  <div className="mt-1.5 text-xs">
                    <div><span className="text-zinc-500">Driver:</span> {v.driver_name || "—"}</div>
                    <div><span className="text-zinc-500">Status:</span> <span className="font-medium capitalize">{v.status.replace("_", " ")}</span></div>
                    {v.current_trip && (
                      <div className="mt-1 text-[11px] text-zinc-500">{v.current_trip.pickup_name} → {v.current_trip.dropoff_name}</div>
                    )}
                  </div>
                </div>
              </Popup>
            )}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

/** Live simulation hook — nudges vehicle positions locally every 2s. */
export function useLiveVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);

  const loadAll = async () => {
    const [v, d, t] = await Promise.all([
      api.get("/fleet/vehicles"),
      api.get("/fleet/drivers"),
      api.get("/fleet/trips", { params: { limit: 200 } }),
    ]);
    const driverById = Object.fromEntries(d.data.map((x) => [x.driver_id, x]));
    const tripByVehicleId = {};
    t.data.forEach((tr) => {
      if (tr.vehicle_id && ["assigned", "on_trip"].includes(tr.status)) {
        tripByVehicleId[tr.vehicle_id] = tr;
      }
    });
    const enriched = v.data.map((x) => ({
      ...x,
      driver_name: x.driver_id ? driverById[x.driver_id]?.name : null,
      driver_rating: x.driver_id ? driverById[x.driver_id]?.rating : null,
      current_trip: tripByVehicleId[x.vehicle_id] || null,
    }));
    setVehicles(enriched);
    setDrivers(d.data);
    setTrips(t.data);
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const h = () => loadAll();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, []);

  // Live nudge: simulate movement every 2s for non-offline vehicles
  useEffect(() => {
    const id = setInterval(() => {
      setVehicles((prev) => prev.map((v) => {
        if (v.status === "offline" || v.status === "maintenance") return v;
        // small drift, bigger for on_trip
        const mag = v.status === "on_trip" ? 0.0015 : 0.0006;
        const dx = (Math.random() - 0.5) * mag * 2;
        const dy = (Math.random() - 0.5) * mag * 2;
        // Clamp to Jakarta bounds
        const lat = Math.min(-6.08, Math.max(-6.32, v.lat + dy));
        const lng = Math.min(106.98, Math.max(106.70, v.lng + dx));
        return { ...v, lat, lng };
      }));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return { vehicles, drivers, trips, reload: loadAll };
}
