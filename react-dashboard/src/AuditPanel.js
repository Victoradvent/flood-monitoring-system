import React, { useEffect, useState } from "react";
import axios from "axios";
import Card from "./components/ui/Card";
import Icon from "./components/ui/Icon";
export default function AuditPanel({ token, role }) {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    operator: "",
    action: "",
  });
  const fetchLogs = () => {
    axios
      .get(`/audit/filter?${new URLSearchParams(filters)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setLogs(r.data))
      .catch((e) => console.error(e));
  };
  useEffect(() => {
    if (token) fetchLogs();
  }, [token]);
  const field = (key, props = {}) => (
    <input
      className="input-field"
      {...props}
      value={filters[key]}
      onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
    />
  );
  return (
    <Card
      title="Audit Logs"
      subtitle="Track operator actions and system changes"
    >
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {field("start", { type: "date" })}
        {field("end", { type: "date" })}
        {field("operator", { placeholder: "Operator ID" })}
        <select
          className="input-field"
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
        >
          <option value="">All Actions</option>
          <option value="RECOMMEND_CUTOFF">Cutoff Recommendation</option>
          <option value="CUTOFF">Cutoff</option>
          <option value="RESTORE">Restore</option>
          <option value="INSPECTION">Inspection</option>
          <option value="REPORT_VIEW">Report View</option>
          <option value="REPORT_EXPORT">Report Export</option>
        </select>
        <div className="flex gap-2">
          <button onClick={fetchLogs} className="primary-btn flex-1">
            Apply
          </button>
          {role === "admin" && (
            <button
              onClick={async () => {
                try {
                  const r = await fetch(
                    `/audit/export/csv?${new URLSearchParams(filters)}`,
                    { headers: { Authorization: `Bearer ${token}` } },
                  );
                  if (!r.ok) throw new Error("CSV export failed");
                  const b = await r.blob();
                  const u = URL.createObjectURL(b);
                  const a = document.createElement("a");
                  a.href = u;
                  a.download = "audit_logs.csv";
                  a.click();
                  URL.revokeObjectURL(u);
                } catch (e) {
                  alert(e.message);
                }
              }}
              className="secondary-btn"
            >
              <Icon name="download" size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-3">Equipment</th>
              <th>Operator</th>
              <th>Action</th>
              <th>Timestamp</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-medium">
                  {l.equipment_name || "—"}
                </td>
                <td>{l.operator_id}</td>
                <td className="font-medium text-blue-700">{l.action}</td>
                <td className="text-xs text-slate-500">
                  {new Date(l.timestamp).toLocaleString()}
                </td>
                <td className="text-xs text-slate-500">{l.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {logs.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          No audit entries match these filters.
        </p>
      )}
    </Card>
  );
}
