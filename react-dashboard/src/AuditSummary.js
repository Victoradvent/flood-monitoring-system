import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
} from "chart.js";
import Card from "./components/ui/Card";
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
);
export default function AuditSummary({ token, role }) {
  const [daily, setDaily] = useState([]),
    [weekly, setWeekly] = useState([]);
  useEffect(() => {
    if (!token) return;
    axios
      .get("/audit-summary/daily", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setDaily(r.data))
      .catch(console.error);
    axios
      .get("/audit-summary/weekly", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setWeekly(r.data))
      .catch(console.error);
  }, [token]);
  const actions =
    role === "admin"
      ? [
          ...new Set([
            ...daily.map((x) => x.action),
            ...weekly.map((x) => x.action),
          ]),
        ]
      : ["RECOMMEND_CUTOFF", "CUTOFF", "RESTORE", "INSPECTION"];
  const dl = [...new Set(daily.map((x) => x.day))],
    wl = [...new Set(weekly.map((x) => x.week))];
  const dailyData = {
    labels: dl,
    datasets: actions.map((a, i) => ({
      label: a,
      data: dl.map((d) =>
        Number(daily.find((r) => r.day === d && r.action === a)?.count || 0),
      ),
      backgroundColor: i % 2 ? "rgba(37,99,235,.55)" : "rgba(239,68,68,.55)",
    })),
  };
  const weeklyData = {
    labels: wl,
    datasets: actions.map((a, i) => ({
      label: a,
      data: wl.map((w) =>
        Number(weekly.find((r) => r.week === w && r.action === a)?.count || 0),
      ),
      borderColor: i % 2 ? "rgba(37,99,235,.85)" : "rgba(239,68,68,.85)",
      backgroundColor: "transparent",
    })),
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Daily Audit Summary">
        <div className="h-72">
          <Bar
            data={dailyData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "top" } },
            }}
          />
        </div>
      </Card>
      <Card title="Weekly Audit Summary">
        <div className="h-72">
          <Line
            data={weeklyData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "top" } },
            }}
          />
        </div>
      </Card>
    </div>
  );
}
