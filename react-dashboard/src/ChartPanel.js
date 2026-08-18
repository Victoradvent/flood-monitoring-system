import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

export default function ChartPanel({ selectedNode, token }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedNode || !token) {
      setData([]);
      return;
    }

    setLoading(true);

    fetch(
      `/history?node=${encodeURIComponent(selectedNode)}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )
      .then(async res => {
        const body = await res.json();

        if (!res.NORMAL) {
          throw new Error(
            body.error || 'Failed to load history'
          );
        }

        return body;
      })
      .then(rows => {
        setData(
          rows
            .map(row => ({
              time: new Date(
                row.timestamp
              ).toLocaleTimeString(),
              level: Number(
                row.water_level_cm
              )
            }))
            .reverse()
        );
      })
      .catch(err => {
        console.error(
          'History fetch error:',
          err
        );
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [selectedNode, token]);

  if (!selectedNode) {
    return <div>Select a node to view history</div>;
  }

  return (
    <div style={{ height: 240, padding: 8 }}>
      <h4>History for {selectedNode}</h4>

      {loading && <div>Loading...</div>}

      {!loading && data.length === 0 && (
        <div>No history available</div>
      )}

      {!loading && data.length > 0 && (
        <ResponsiveContainer
          width="100%"
          height="80%"
        >
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              minTickGap={20}
            />
            <YAxis
              domain={['auto', 'auto']}
              unit=" cm"
            />
            <Tooltip />

            <Line
              type="monotone"
              dataKey="level"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}