import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Card from "./components/ui/Card";
export default function ChartPanel({ selectedNode, token }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!selectedNode || !token) {
      setData([]);
      return;
    }
    setLoading(true);
    fetch(`/history?node=${encodeURIComponent(selectedNode)}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error || "Failed to load history");
        return b;
      })
      .then((rows) =>
        setData(
          rows
            .map((r) => ({
              time: new Date(r.timestamp).toLocaleTimeString(),
              level: Number(r.water_level_cm),
            }))
            .reverse(),
        ),
      )
      .catch((e) => {
        console.error("History fetch error:", e);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [selectedNode, token]);
  if (!selectedNode)
    return (
      <Card title="Node History">
        <div className="py-10 text-center text-sm text-slate-400">
          Select a node from the map or node list to view history.
        </div>
      </Card>
    );
  return (
    <Card title={`Node ${selectedNode} — Water Level History`}>
      <div className="h-64">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading history…
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No history available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                minTickGap={20}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis unit=" cm" tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="level"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
