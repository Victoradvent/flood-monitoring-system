import React, { useEffect, useState } from "react";
import axios from "axios";
import Card from "./components/ui/Card";
import Badge from "./components/ui/Badge";
import Icon from "./components/ui/Icon";
export default function GridPanel({ token }) {
  const [equipment, setEquipment] = useState([]);
  useEffect(() => {
    if (!token) return;
    axios
      .get("/grid", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setEquipment(r.data))
      .catch((e) => console.error("Error fetching equipment", e));
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/ws`);
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === "grid_hazard" || m.type === "grid_recommendation")
          alert(m.message);
        if (m.type === "grid_recommendation" && m.equipment)
          setEquipment((p) =>
            p.map((x) => (x.id === m.equipment.id ? m.equipment : x)),
          );
      } catch (err) {
        console.error(err);
      }
    };
    return () => ws.close();
  }, [token]);
  const recommend = async (id) => {
    try {
      const r = await axios.post(
        `/grid/${id}/cutoff`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      alert(r.data.message);
      setEquipment((p) => p.map((x) => (x.id === id ? r.data.equipment : x)));
    } catch (e) {
      console.error("Recommendation error", e);
    }
  };
  const recommended = equipment.filter((x) => x.recommended);
  return (
    <Card
      title="Grid Monitor — Equipment"
      subtitle="Monitor electrical equipment and recommended safety actions"
    >
      <div className="mb-5 flex flex-wrap gap-2">
        <button className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          Equipment
        </button>
        <span className="rounded-md px-3 py-1.5 text-xs text-slate-500">
          Cutoff Recommendations
        </span>
        <span className="rounded-md px-3 py-1.5 text-xs text-slate-500">
          Inspections
        </span>
      </div>
      {recommended.length > 0 && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 font-bold text-red-800">
            <Icon name="alert" size={17} />
            Recommended Cutoff Actions
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {recommended.map((x) => (
              <div
                key={x.id}
                className="rounded-lg bg-white/70 px-3 py-2 text-sm text-red-800"
              >
                <b>{x.name}</b> · {x.status || "ON"}
              </div>
            ))}
          </div>
        </div>
      )}
      {equipment.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          No equipment found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-3">Equipment</th>
                <th>Type</th>
                <th>Location</th>
                <th>Status</th>
                <th>Recommendation</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipment.map((x) => (
                <tr key={x.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-semibold">{x.name}</td>
                  <td>{x.type || "—"}</td>
                  <td>{x.location || "—"}</td>
                  <td>
                    <Badge value={x.status || "NORMAL"} />
                  </td>
                  <td>
                    {x.recommended ? (
                      <span className="text-xs font-semibold text-red-600">
                        Cutoff Recommended
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => recommend(x.id)}
                      className="secondary-btn px-3 py-1.5 text-xs"
                    >
                      View / Recommend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
