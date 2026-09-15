// src/AdminMap.js
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

export default function AdminMap() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    fetch("/nodes", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("jwt")}`,
      },
    })
      .then((res) => res.json())
      .then(setNodes)
      .catch((err) => console.error("Fetch nodes error", err));
  }, []);

  const updateNode = async (id, node_id, lat, lng) => {
    const token = localStorage.getItem("jwt");

    try {
      const response = await fetch(`/nodes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: undefined,
          lat,
          lng,
        }),
      });

      const updated = await response.json();

      if (!response.ok) {
        throw new Error(updated.error || "Failed to update node");
      }

      setNodes((prev) =>
        prev.map((n) => (n.node_id === node_id ? updated : n)),
      );
    } catch (err) {
      console.error("Update node error", err);
    }
  };

  return (
    <MapContainer center={[6.21, 7.07]} zoom={13} className="h-[500px] w-full">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {nodes.map((n) => (
        <Marker
          key={n.node_id}
          position={[n.lat || 6.21, n.lng || 7.07]}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const pos = e.target.getLatLng();
              updateNode(n.id, n.node_id, pos.lat, pos.lng);
            },
          }}
          icon={L.icon({
            iconUrl:
              "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            shadowUrl:
              "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          })}
        >
          <Popup>
            <strong>{n.node_id}</strong>
            <br />
            {n.name || ""}
            <br />
            Lat: {n.lat}, Lng: {n.lng}
            <br />
            Drag marker to update location.
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
