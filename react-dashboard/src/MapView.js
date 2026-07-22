// src/MapView.js
import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Popup, CircleMarker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

function statusColor(status) {
  if (status === 'CRITICAL') return '#d73027';
  if (status === 'WARNING') return '#fdae61';
  return '#1a9850';
}

const DEFAULT_COORD = [6.2100, 7.0700];

export default function MapView({ nodes }) {
  const center = useMemo(() => {
    const arr = Object.values(nodes);
    if (arr.length === 0) return DEFAULT_COORD;
    const lat = arr.reduce((s, n) => s + (n.lat || DEFAULT_COORD[0]), 0) / arr.length;
    const lng = arr.reduce((s, n) => s + (n.lng || DEFAULT_COORD[1]), 0) / arr.length;
    return [lat, lng];
  }, [nodes]);

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup>
        {Object.entries(nodes).map(([nodeId, node]) => {
          const pos = node.lat && node.lng ? [node.lat, node.lng] : DEFAULT_COORD;
          const color = statusColor(node.status);
          return (
            <CircleMarker
              key={nodeId}
              center={pos}
              radius={12}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <strong>{nodeId}</strong><br />
                  <strong>Status</strong>: {node.status}<br />
                  <strong>Water level</strong>: {node.water_level_cm} cm<br />
                  <strong>Battery</strong>: {node.battery_v ?? 'N/A'} V<br />
                  <strong>Last update</strong>: {node.timestamp}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
