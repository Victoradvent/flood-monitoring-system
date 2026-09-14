import React, { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

function statusColor(status) {
  if (status === "STALE") return "#64748b";
  if (status === "CRITICAL") return "#ef4444";
  if (status === "WARNING") return "#f59e0b";
  return "#16a34a";
}
const DEFAULT_COORD = [6.21, 7.07];

function MapBounds({ nodes, equipment }) {
  const map = useMap();

  useEffect(() => {
    const nodeCoordinates = Object.values(nodes)
      .filter((node) => Number.isFinite(Number(node.lat)) && Number.isFinite(Number(node.lng)))
      .map((node) => [Number(node.lat), Number(node.lng)]);
    const equipmentCoordinates = equipment
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
      .map((item) => [Number(item.lat), Number(item.lng)]);
    const coordinates = [...nodeCoordinates, ...equipmentCoordinates];

    if (coordinates.length === 0) return;
    if (coordinates.length === 1) {
      map.setView(coordinates[0], 13);
      return;
    }

    map.fitBounds(coordinates, { padding: [30, 30], maxZoom: 13 });
  }, [map, nodes, equipment]);

  return null;
}

export default function MapView({ nodes = {}, equipment = [] }) {
  const center = useMemo(() => {
    const arr = [...Object.values(nodes), ...equipment];
    if (!arr.length) return DEFAULT_COORD;
    return [
      arr.reduce((s, n) => s + Number(n.lat || DEFAULT_COORD[0]), 0) /
        arr.length,
      arr.reduce((s, n) => s + Number(n.lng || DEFAULT_COORD[1]), 0) /
        arr.length,
    ];
  }, [nodes, equipment]);
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
      <MapBounds nodes={nodes} equipment={equipment} />
      <MarkerClusterGroup>
        {Object.entries(nodes).map(([id, node]) => {
          const displayStatus = node.stale ? "STALE" : node.status;
          const color = statusColor(displayStatus);
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
                      <b>Status:</b> {displayStatus || "NORMAL"}
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
        {equipment.map((item) => {
          if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return null;
          const color = item.status === "CUTOFF_RECOMMENDED" || item.status === "INSPECTION_REQUIRED" ? "#dc2626" : "#7c3aed";
          return (
            <CircleMarker
              key={`equipment-${item.id}`}
              center={[Number(item.lat), Number(item.lng)]}
              radius={12}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight: 3 }}
            >
              <Popup>
                <div className="min-w-[210px] text-sm">
                  <div className="mb-2 text-base font-bold">{item.name}</div>
                  <div className="space-y-1 text-slate-600">
                    <div><b>Equipment:</b> {item.equipment_code || item.id}</div>
                    <div><b>Status:</b> {item.status}</div>
                    <div><b>Risk zone:</b> {item.risk_zone || "—"}</div>
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
