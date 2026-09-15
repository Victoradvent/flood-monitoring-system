import React, { useEffect, useMemo, useState } from "react";
import Card from "./components/ui/Card";
import Badge from "./components/ui/Badge";
import StatCard from "./components/ui/StatCard";
import MapView from "./MapView";
import { subscribe } from "./wsClient";

const empty = { nodes: [], readings: [], alerts: [], deliveries: [], equipment: [], users: [], audit: [], settings: {} };
const api = (token, path, options = {}) => fetch(`/admin/control-center${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
const date = (value) => value ? new Date(value).toLocaleString() : "Never";
const nodeState = (node) => !node.active ? "DISABLED" : !node.last_reading_at || Date.now() - new Date(node.last_reading_at).getTime() > 120000 ? "OFFLINE" : node.status || "NORMAL";

export default function AdminControlCenter({ token }) {
  const [data, setData] = useState(empty);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [thresholds, setThresholds] = useState({ warning_cm: 30, critical_cm: 50 });
  const [metrics, setMetrics] = useState(null);
  const [tab, setTab] = useState("overview");

  const load = async () => {
    try {
      const response = await api(token, "/overview");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load control center");
      setData(body);
      const metricsResponse = await fetch("/system/metrics", { headers: { Authorization: `Bearer ${token}` } });
      if (metricsResponse.ok) setMetrics(await metricsResponse.json());
      setThresholds(body.settings?.thresholds || { warning_cm: 30, critical_cm: 50 });
      setError("");
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { if (token) load(); }, [token]);
  useEffect(() => {
    const timer = setInterval(load, 15000);
    const unsubscribe = subscribe((event) => { if (["reading", "alert", "delivery_retry", "grid_recommendation"].includes(event.type)) load(); });
    return () => { clearInterval(timer); unsubscribe?.(); };
  }, [token]);

  const act = async (path, options = {}) => {
    setMessage("");
    const highRisk = /\/thresholds$|\/nodes\/|\/equipment\/|\/subscribers\//.test(path);
    if (highRisk) {
      const reason = window.prompt("Enter the mandatory reason for this change:");
      if (!reason || !reason.trim()) return;
      if (!window.confirm("Confirm this safety-critical change?")) return;
      const currentBody = options.body ? JSON.parse(options.body) : {};
      options = { ...options, body: JSON.stringify({ ...currentBody, reason: reason.trim() }) };
    }
    const response = await api(token, path, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Action failed");
    setMessage("Action recorded in the audit log");
    await load();
  };
  const counts = useMemo(() => ({
    online: data.nodes.filter((n) => ["NORMAL", "WARNING", "CRITICAL", "SENSOR_ERROR"].includes(nodeState(n))).length,
    offline: data.nodes.filter((n) => nodeState(n) === "OFFLINE").length,
    critical: data.nodes.filter((n) => nodeState(n) === "CRITICAL").length,
    failed: data.deliveries.filter((d) => d.status === "FAILED").length,
  }), [data.nodes, data.deliveries]);
  const nodeMap = useMemo(() => Object.fromEntries(data.nodes.map((node) => [node.node_id, node])), [data.nodes]);

  if (error) return <Card title="Administrator Control Center"><p className="p-4 text-sm text-red-700">{error}</p><button className="primary-btn" onClick={load}>Retry</button></Card>;
  const tabs = [["overview", "Overview"], ["nodes", "Sensors & Data"], ["communications", "Communications"], ["alerts", "Alerting"], ["grid", "Grid Map"], ["system", "System & Access"]];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Administrator only</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Control Center</h1><p className="mt-1 text-sm text-slate-500">Live operational state, direct controls, and accountable change history.</p></div>
      <button className="secondary-btn" onClick={load}>Refresh telemetry</button>
    </div>
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}>{label}</button>)}</div>
    {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
    {tab === "overview" && <Overview data={data} metrics={metrics} counts={counts} onNavigate={setTab} />}
    {tab === "nodes" && <Nodes data={data} onAction={act} />}
    {tab === "communications" && <Communications data={data} counts={counts} onAction={act} />}
    {tab === "alerts" && <Alerting data={data} onAction={act} />}
    {tab === "grid" && <Grid data={data} nodeMap={nodeMap} token={token} onAction={act} />}
    {tab === "system" && <System data={data} thresholds={thresholds} setThresholds={setThresholds} onAction={act} />}
  </div>;
}

function Overview({ data, metrics, counts, onNavigate }) { return <>
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard title="Sensor nodes" value={data.nodes.length} icon="nodes" tone="blue" trend={`${counts.online} reporting`} /><StatCard title="Offline / disabled" value={counts.offline} icon="server" tone="amber" trend="Needs attention" /><StatCard title="Critical state" value={counts.critical} icon="alert" tone="red" trend="Active hazard level" /><StatCard title="Failed SMS" value={counts.failed} icon="bell" tone="slate" trend="Retry queue" /><StatCard title="Database" value={data.health?.database || "—"} icon="shield" tone="green" trend={`MQTT ${data.health?.mqtt || "—"}`} /></div>
  <div className="grid gap-5 xl:grid-cols-2"><Card title="Operational coverage" subtitle="Every control domain is one click away"><div className="grid gap-3 sm:grid-cols-2">{[["Sensors & data", data.nodes.length, "nodes and readings", "nodes"], ["Communications", data.deliveries.length, `${data.deliveries.filter((d) => d.status === "SENT").length} delivered`, "communications"], ["Alerting", data.alerts.length, `${data.alerts.filter((a) => !a.acknowledged).length} unacknowledged`, "alerts"], ["Grid equipment", data.equipment.length, "mapped assets", "grid"], ["System access", data.users.length, "accounts", "system"], ["Audit trail", data.audit.length, "recent actions", "system"]].map(([label, value, detail, target]) => <button key={label} onClick={() => onNavigate(target)} className="rounded-lg border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50"><p className="text-sm font-semibold text-slate-800">{label}</p><p className="mt-2 text-2xl font-bold text-blue-700">{value}</p><p className="text-xs text-slate-500">{detail}</p></button>)}</div></Card>
    <Card title="Performance metrics" subtitle="Read-only, last 24 hours"><div className="grid grid-cols-2 gap-3 text-sm"><div><b>{metrics?.avg_ingest_latency_ms?.toFixed?.(1) || "—"} ms</b><p className="text-xs text-slate-500">Average ingest latency</p></div><div><b>{metrics ? `${(metrics.sensor_error_rate * 100).toFixed(2)}%` : "—"}</b><p className="text-xs text-slate-500">Sensor error rate</p></div><div><b>{metrics?.readings_24h ?? "—"}</b><p className="text-xs text-slate-500">Readings</p></div><div><b>{metrics?.accuracy === null ? "N/A" : metrics?.accuracy}</b><p className="text-xs text-slate-500">Accuracy</p></div></div></Card>
    <Card title="Recent admin activity" action={<button className="text-xs font-semibold text-blue-600" onClick={() => onNavigate("system")}>View audit</button>}><Activity rows={data.audit.slice(0, 7)} /></Card></div>
</>; }

function Nodes({ data, onAction }) { return <div className="space-y-5"><Card title="Sensor node health" subtitle="Live status is derived from the latest reading; disabled nodes reject operational use."><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-3">Node</th><th>State</th><th>Water</th><th>Battery</th><th>Last reading</th><th className="text-right">Control</th></tr></thead><tbody className="divide-y divide-slate-100">{data.nodes.map((node) => <tr key={node.id}><td className="px-3 py-3"><b>{node.node_id}</b><div className="text-xs text-slate-500">{node.name}</div></td><td><Badge value={nodeState(node)} /></td><td>{node.water_level_cm ?? "—"} cm</td><td>{node.battery_v ?? "—"} V</td><td className="text-xs text-slate-500">{date(node.last_reading_at)}</td><td className="text-right"><button className="secondary-btn text-xs" onClick={() => onAction(`/nodes/${node.id}`, { method: "PATCH", body: JSON.stringify({ active: !node.active }) })}>{node.active ? "Disable" : "Enable"}</button></td></tr>)}</tbody></table></div></Card><Card title="Environmental data" subtitle="Latest 100 raw readings"><DataTable rows={data.readings} columns={[["node_id", "Node"], ["water_level_cm", "Water cm"], ["battery_v", "Battery"], ["status", "Status"], ["timestamp", "Timestamp"]]} /></Card></div>; }

function Communications({ data, counts, onAction }) { return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><StatCard title="Delivery records" value={data.deliveries.length} icon="chart" tone="blue" trend="Recent history" /><StatCard title="Delivered" value={data.deliveries.filter((d) => d.status === "SENT").length} icon="shield" tone="green" trend="SMS success" /><StatCard title="Retry queue" value={counts.failed} icon="alert" tone="amber" trend="Manual or automatic retry" /></div><Card title="GSM / MQTT delivery log" subtitle="Failed messages can be queued for the retry worker"><DataTable rows={data.deliveries} columns={[["node_id", "Node"], ["recipient_name", "Recipient"], ["phone", "Phone"], ["status", "Status"], ["created_at", "Created"]]} action={(row) => row.status === "FAILED" && <button className="secondary-btn text-xs" onClick={() => onAction(`/deliveries/${row.id}/retry`, { method: "POST", body: "{}" })}>Resend</button>} /></Card></div>; }

function Alerting({ data, onAction }) {
  const [form, setForm] = useState({ name: "", phone: "", node_id: "", role: "resident" });
  const addRecipient = (event) => { event.preventDefault(); onAction("/subscribers", { method: "POST", body: JSON.stringify(form) }).then(() => setForm({ name: "", phone: "", node_id: "", role: "resident" })); };
  return <div className="space-y-5"><Card title="Alert history" subtitle="All threshold breaches and acknowledgement state"><DataTable rows={data.alerts} columns={[["node_id", "Node"], ["alert_level", "Level"], ["water_level_cm", "Water cm"], ["sent", "Sent"], ["acknowledged", "Acknowledged"], ["triggered_at", "Triggered"]]} /></Card><Card title="Notification recipients" subtitle="Add, activate, or remove residents and operators"><form onSubmit={addRecipient} className="mb-5 grid gap-3 sm:grid-cols-5"><input className="input-field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input className="input-field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /><input className="input-field" placeholder="Node ID" value={form.node_id} onChange={(e) => setForm({ ...form, node_id: e.target.value })} required /><select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>resident</option><option>operator</option></select><button className="primary-btn" type="submit">Add recipient</button></form><DataTable rows={data.subscribers || []} columns={[["name", "Name"], ["phone", "Phone"], ["node_id", "Node"], ["active", "Active"], ["role", "Role"]]} action={(row) => <div className="flex justify-end gap-2"><button className="secondary-btn text-xs" onClick={() => onAction(`/subscribers/${row.id}`, { method: "PATCH", body: JSON.stringify({ name: row.name, phone: row.phone, node_id: row.node_id, active: !row.active }) })}>{row.active ? "Deactivate" : "Activate"}</button><button className="text-xs font-semibold text-red-600" onClick={() => onAction(`/subscribers/${row.id}`, { method: "DELETE" })}>Remove</button></div>} /></Card></div>; }

function Grid({ data, nodeMap, token, onAction }) { const recommend = async (id) => { const response = await fetch(`/grid/${id}/cutoff`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Cutoff recommendation failed"); await onAction(`/equipment/${id}`, { method: "PATCH", body: JSON.stringify({ status: "CUTOFF_RECOMMENDED", annotation: body.equipment?.description }) }); }; return <div className="space-y-5"><Card title="Grid equipment map" subtitle="Live equipment locations and administrator status overrides"><div className="h-[420px] overflow-hidden rounded-lg border border-slate-100"><MapView nodes={nodeMap} equipment={data.equipment} /></div></Card><Card title="Equipment controls"><DataTable rows={data.equipment} columns={[["name", "Equipment"], ["status", "Status"], ["lat", "Latitude"], ["lng", "Longitude"], ["description", "Annotation"]]} action={(row) => <div className="flex justify-end gap-2"><button className="secondary-btn text-xs" onClick={() => recommend(row.id)}>Recommend cutoff</button><select className="input-field w-44 text-xs" value={row.status} onChange={(event) => onAction(`/equipment/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value, annotation: row.description }) })}><option>NORMAL</option><option>CUTOFF_RECOMMENDED</option><option>INSPECTION_REQUIRED</option><option>CLEARED</option></select></div>} /></Card></div>; }

function System({ data, thresholds, setThresholds, onAction }) { const save = (event) => { event.preventDefault(); onAction("/thresholds", { method: "PUT", body: JSON.stringify(thresholds) }); }; return <div className="grid gap-5 xl:grid-cols-2"><Card title="Raw system health" subtitle="Server, database, API, MQTT and SMS provider"><div className="grid gap-3 sm:grid-cols-2">{Object.entries(data.health || {}).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{key.replaceAll("_", " ")}</p><p className="mt-1 font-bold text-slate-800">{String(value)}</p></div>)}</div><button className="primary-btn mt-5" onClick={() => onAction("/simulations", { method: "POST", body: JSON.stringify({ type: "telemetry" }) })}>Trigger telemetry simulation</button></Card><Card title="Threshold configuration" subtitle="Changes affect future server-side evaluation"><form onSubmit={save} className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Warning (cm)<input className="input-field mt-1" type="number" value={thresholds.warning_cm} onChange={(e) => setThresholds({ ...thresholds, warning_cm: e.target.value })} /></label><label className="text-sm font-medium text-slate-700">Critical (cm)<input className="input-field mt-1" type="number" value={thresholds.critical_cm} onChange={(e) => setThresholds({ ...thresholds, critical_cm: e.target.value })} /></label><button className="primary-btn sm:col-span-2" type="submit">Save thresholds</button></form></Card><Card title="User accounts and permissions"><DataTable rows={data.users} columns={[["username", "Username"], ["role", "Role"], ["last_login_at", "Last login"], ["created_at", "Created"]]} /></Card><Card title="Immutable action history"><Activity rows={data.audit} /></Card></div>; }

function Activity({ rows }) { return <div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.id} className="py-3"><div className="flex justify-between gap-3 text-sm"><b className="text-slate-700">{row.action}</b><span className="text-xs text-slate-400">{date(row.timestamp)}</span></div><p className="mt-1 text-xs text-slate-500">{row.username || `user ${row.operator_id || "system"}`} · {row.notes || "No notes"}</p></div>)}{rows.length === 0 && <p className="py-6 text-sm text-slate-400">No actions recorded.</p>}</div>; }
function DataTable({ rows, columns, action }) { return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400"><tr>{columns.map(([, label]) => <th key={label} className="px-3 py-3">{label}</th>)}{action && <th className="text-right">Action</th>}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={row.id || `${row.node_id}-${index}`}><>{columns.map(([key]) => <td key={key} className="max-w-[220px] truncate px-3 py-3 text-slate-600">{key.includes("at") || key === "timestamp" ? date(row[key]) : typeof row[key] === "boolean" ? (row[key] ? "Yes" : "No") : row[key] ?? "—"}</td>)}</>{action && <td className="px-3 py-3 text-right">{action(row)}</td>}</tr>)}</tbody></table>{rows.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No records available.</p>}</div>; }
