import React, { useMemo } from "react";
import { MapContainer, TileLayer, Popup, CircleMarker } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

function statusColor(status) {
  if (status === "CRITICAL") return "#ef4444";
  if (status === "WARNING") return "#f59e0b";
  return "#16a34a";
}
const DEFAULT_COORD = [6.21, 7.07];
export default function MapView({ nodes = {} }) {
  const center = useMemo(() => {
    const arr = Object.values(nodes);
    if (!arr.length) return DEFAULT_COORD;
    return [
      arr.reduce((s, n) => s + Number(n.lat || DEFAULT_COORD[0]), 0) /
        arr.length,
      arr.reduce((s, n) => s + Number(n.lng || DEFAULT_COORD[1]), 0) /
        arr.length,
    ];
  }, [nodes]);
  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup>
        {Object.entries(nodes).map(([id, node]) => {
          const color = statusColor(node.status);
          return (
            <CircleMarker
              key={id}
              center={
                node.lat && node.lng ? [node.lat, node.lng] : DEFAULT_COORD
              }
              radius={9}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 3,
              }}
            >
              <Popup>
                <div className="min-w-[210px] text-sm">
                  <div className="mb-2 text-base font-bold">
                    {node.name || id}
                  </div>
                  <div className="space-y-1 text-slate-600">
                    <div>
                      <b>Node:</b> {id}
                    </div>
                    <div>
                      <b>Status:</b> {node.status || "NORMAL"}
                    </div>
                    <div>
                      <b>Water level:</b> {node.water_level_cm ?? "—"} cm
                    </div>
                    <div>
                      <b>Battery:</b> {node.battery_v ?? "N/A"} V
                    </div>
                    <div>
                      <b>Last update:</b> {node.timestamp || "—"}
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
