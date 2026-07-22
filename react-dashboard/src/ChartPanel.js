// src/ChartPanel.js
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ChartPanel({ selectedNode }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedNode) return;
    setLoading(true);
    fetch(`/history?node=${encodeURIComponent(selectedNode)}&limit=50`)
      .then(res => res.json())
      .then(rows => {
        // Expect rows: [{ timestamp, water_level_cm }]
        const formatted = rows.map(r => ({
          time: new Date(r.timestamp).toLocaleTimeString(),
          level: Number(r.water_level_cm)
        })).reverse(); // oldest first
        setData(formatted);
      })
      .catch(err => console.error('History fetch error', err))
      .finally(() => setLoading(false));
  }, [selectedNode]);

  if (!selectedNode) return <div>Select a node to view history</div>;

  return (
    <div style={{ height: 240, padding: 8 }}>
      <h4>History for {selectedNode}</h4>
      {loading && <div>Loading...</div>}
      {!loading && data.length === 0 && <div>No history available</div>}
      {!loading && data.length > 0 && (
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" minTickGap={20} />
            <YAxis domain={['auto', 'auto']} unit=" cm" />
            <Tooltip />
            <Line type="monotone" dataKey="level" stroke="#ff7300" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
