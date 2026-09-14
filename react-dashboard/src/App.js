import React, { useEffect, useMemo, useState } from "react";
import MapView from "./MapView";
import ChartPanel from "./ChartPanel";
import AdminMap from "./AdminMap";
import OperatorPanel from "./OperatorPanel";
import ReportsPanel from "./ReportsPanel";
import GridPanel from "./GridPanel";
import AuditPanel from "./AuditPanel";
import AuditSummary from "./AuditSummary";
import AuditTrends from "./AuditTrends";
import Login from "./Login";
import AdminPanel from "./AdminPanel";
import AdminUserPanel from "./AdminUserPanel";
import ResidentDashboard from "./ResidentDashboard";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Card from "./components/ui/Card";
import StatCard from "./components/ui/StatCard";
import Badge from "./components/ui/Badge";
import Icon from "./components/ui/Icon";
import { subscribe } from "./wsClient";

const NODE_STALE_MS = 120000;

const titles = {
  dashboard: "Dashboard",
  map: "Map",
  alerts: "Alerts",
  grid: "Grid Monitor",
  reports: "Reports & Analytics",
  nodes: "Nodes",
  audit: "Audit Logs",
  admin: "Administration",
  profile: "Profile",
};

function Profile({ token, role }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load profile");
        return data;
      })
      .then((data) => {
        setProfile(data);
        setForm({
          name: data.name || "",
          email: data.email || "",
          assigned_zone: data.assigned_zone || "",
          shift_contact: data.shift_contact || "",
          phone: data.phone || "",
          notification_preferences: data.notification_preferences || {},
        });
      })
      .catch((err) => setError(err.message));
  }, [token]);

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const body = { display_name: form.name, email: form.email };
    if (profile?.role === "operator") body.shift_contact = form.shift_contact;
    if (profile?.role === "resident") body.notification_preferences = form.notification_preferences;
    try {
      const res = await fetch("/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");
      setProfile(data);
      setMessage("Profile updated");
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <Card title="Profile"><p className="p-4 text-sm text-red-700">{error}</p></Card>;
  if (!profile) return <Card title="Profile"><p className="p-4 text-sm text-slate-500">Loading profile...</p></Card>;

  const roleLabel = profile.role === "admin" ? "Administrator" : profile.role === "operator" ? "Operator" : "Resident";
  const effectiveRole = profile.role;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
      <Card title={`${roleLabel} profile`} subtitle="Account information and personal settings">
        <form onSubmit={save} className="space-y-4">
          <Editable label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Editable label="Username" value={profile.username} readOnly />
          <Editable label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          {effectiveRole === "resident" && <Editable label="Phone" value={profile.phone || ""} readOnly />}
          {effectiveRole === "operator" && <Editable label="Shift contact" value={form.shift_contact} onChange={(value) => setForm({ ...form, shift_contact: value })} />}
          {effectiveRole === "resident" && <Preferences value={form.notification_preferences} onChange={(value) => setForm({ ...form, notification_preferences: value })} />}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          <button className="primary-btn" type="submit">Save editable fields</button>
        </form>
      </Card>
      <Card title="System-managed information" subtitle="Read-only">
        <div className="space-y-3 text-sm">
          <ReadOnly label="Role" value={roleLabel} />
          <ReadOnly label="Account created" value={formatDate(profile.account_created_at)} />
          <ReadOnly label="Last login" value={formatDate(profile.last_login_at)} />
          {effectiveRole === "admin" && <ReadOnly label="Permission level" value={profile.permission_level} />}
          {effectiveRole === "admin" && <ReadOnly label="Access scope" value={profile.access_scope} />}
          {effectiveRole === "operator" && <ReadOnly label="Assigned zone" value={profile.assigned_zone || "Not assigned"} />}
          {effectiveRole === "resident" && <ReadOnly label="Monitored zone" value={profile.monitored_zone || "Not assigned"} />}
        </div>
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">Passwords, tokens, API keys, credentials, and other sensitive fields are never returned by the profile API.</p>
      </Card>
    </div>
  );
}

function formatDate(value) { return value ? new Date(value).toLocaleString() : "Not available"; }
function Editable({ label, value, onChange, readOnly = false }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className={`input-field mt-1 ${readOnly ? "bg-slate-100 text-slate-500" : ""}`} value={value} onChange={(event) => onChange?.(event.target.value)} readOnly={readOnly} /></label>;
}
function ReadOnly({ label, value }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 rounded-md bg-slate-100 px-3 py-2 text-slate-600">{value || "Not available"}</dd></div>; }
function Preferences({ value, onChange }) { return <fieldset><legend className="text-sm font-medium text-slate-700">Notification preferences</legend><div className="mt-2 space-y-2 text-sm text-slate-600"><label className="flex gap-2"><input type="checkbox" checked={value.sms !== false} onChange={(e) => onChange({ ...value, sms: e.target.checked })} /> SMS alerts</label><label className="flex gap-2"><input type="checkbox" checked={value.browser !== false} onChange={(e) => onChange({ ...value, browser: e.target.checked })} /> Browser alerts</label></div></fieldset>; }

export default function App() {
  if (window.location.pathname.startsWith("/resident"))
    return <ResidentDashboard />;

  const [nodes, setNodes] = useState({});
  const [equipment, setEquipment] = useState([]);
  const [log, setLog] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("jwt"));
  const [role, setRole] = useState(localStorage.getItem("role"));
  const [active, setActive] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const logout = () => {
    localStorage.removeItem("jwt");
    localStorage.removeItem("role");
    setToken(null);
    setRole(null);
    setNodes({});
    setLog([]);
  };

  useEffect(() => {
    if (!token) return undefined;
    fetch("/nodes", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load nodes");
        return data;
      })
      .then((rows) =>
        setNodes((prev) => {
          const next = { ...prev };
          rows.forEach((n) => {
            next[n.node_id] = {
              ...next[n.node_id],
              ...n,
              status: next[n.node_id]?.status || "NORMAL",
              stale: true,
            };
          });
          return next;
        }),
      )
      .catch((err) => console.error("Initial node fetch error", err));
  }, [token]);

  useEffect(() => {
    if (!token || !["admin", "operator"].includes(role)) return undefined;
    fetch("/grid", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load equipment");
        return data;
      })
      .then(setEquipment)
      .catch((err) => console.error("Initial equipment fetch error", err));
    return undefined;
  }, [role, token]);

  useEffect(() => {
    if (!token) return undefined;
    const updateStaleState = () => {
      const now = Date.now();
      setNodes((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((nodeId) => {
          const timestamp = next[nodeId].timestamp;
          next[nodeId] = {
            ...next[nodeId],
            stale: !timestamp || now - new Date(timestamp).getTime() > NODE_STALE_MS,
          };
        });
        return next;
      });
    };
    updateStaleState();
    const interval = setInterval(updateStaleState, 15000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token || !["admin", "operator"].includes(role)) return undefined;

    const loadAlertCount = () =>
      fetch("/alerts", { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load alerts");
          return data;
        })
        .then((alerts) =>
          setAlertCount(alerts.filter((alert) => !alert.acknowledged).length),
        )
        .catch((err) => console.error("Alert count fetch error", err));

    loadAlertCount();
    const interval = setInterval(loadAlertCount, 10000);
    return () => clearInterval(interval);
  }, [role, token]);

  useEffect(() => {
    if (!token) return undefined;
    const unsubscribe = subscribe((msg) => {
      if (msg.type === "reading" && msg.payload) {
        const p = msg.payload;
        setNodes((prev) => ({
          ...prev,
          [p.node_id]: {
            ...prev[p.node_id],
            node_id: p.node_id,
            timestamp: p.timestamp,
            water_level_cm: p.water_level_cm,
            battery_v: p.battery_v,
            status: p.status || "NORMAL",
            stale: false,
            lat: p.lat ?? prev[p.node_id]?.lat,
            lng: p.lng ?? prev[p.node_id]?.lng,
          },
        }));
        setLog((prev) =>
          [
            `Reading ${p.node_id} · ${p.water_level_cm}cm · ${p.status || "NORMAL"}`,
            ...prev,
          ].slice(0, 50),
        );
      }
      if (msg.type === "alert") setAlertCount((count) => count + 1);
      if (msg.type === "alert")
        setLog((prev) =>
          [
            `ALERT ${msg.node} · ${msg.level} · ${msg.levelValue}cm`,
            ...prev,
          ].slice(0, 50),
        );
    });
    return unsubscribe;
  }, [token]);

  const nodeList = useMemo(() => Object.values(nodes), [nodes]);
  const counts = useMemo(
    () => ({
      total: nodeList.length,
      ok: nodeList.filter(
        (n) => !n.stale && ((n.status || "NORMAL") === "NORMAL" || n.status === "OK"),
      ).length,
      warning: nodeList.filter((n) => !n.stale && n.status === "WARNING").length,
      critical: nodeList.filter((n) => !n.stale && n.status === "CRITICAL").length,
    }),
    [nodeList],
  );

  if (!token)
    return (
      <Login
        onLogin={(nextToken, nextRole) => {
          localStorage.setItem("jwt", nextToken);
          localStorage.setItem("role", nextRole);
          setToken(nextToken);
          setRole(nextRole);
          setActive("dashboard");
        }}
      />
    );

  const dashboard = (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Nodes"
          value={counts.total || 0}
          icon="nodes"
          tone="blue"
          trend="Monitoring points"
        />
        <StatCard
          title="OK"
          value={counts.ok}
          icon="shield"
          tone="green"
          trend="Operating normally"
        />
        <StatCard
          title="Warning"
          value={counts.warning}
          icon="alert"
          tone="amber"
          trend="Needs attention"
        />
        <StatCard
          title="Critical"
          value={counts.critical}
          icon="alert"
          tone="red"
          trend="Immediate action"
        />
        <StatCard
          title="Active Alerts"
          value={log.filter((x) => x.startsWith("ALERT")).length}
          icon="bell"
          tone="slate"
          trend="Live events"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.85fr)]">
        <Card
          title="Live Map"
          action={
            <button
              onClick={() => setActive("map")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View full map →
            </button>
          }
          className="min-h-[480px]"
        >
          <div className="h-[410px] overflow-hidden rounded-lg border border-slate-100">
            <MapView nodes={nodes} equipment={equipment} />
          </div>
        </Card>
        <div className="space-y-5">
          <Card
            title="Latest Alerts"
            action={
              <button
                onClick={() => setActive("alerts")}
                className="text-xs font-semibold text-blue-600"
              >
                View all
              </button>
            }
          >
            <div className="divide-y divide-slate-100">
              {log
                .filter((x) => x.startsWith("ALERT"))
                .slice(0, 5)
                .map((x, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <span className="truncate text-sm font-medium text-slate-700">
                        {x.replace("ALERT ", "")}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      Live
                    </span>
                  </div>
                ))}
              {!log.some((x) => x.startsWith("ALERT")) && (
                <p className="py-8 text-center text-sm text-slate-400">
                  No live alerts received yet.
                </p>
              )}
            </div>
          </Card>
          <Card title="Recent Readings">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2">Node ID</th>
                    <th className="pb-2">Water Level</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Battery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nodeList.slice(0, 6).map((n) => (
                    <tr key={n.node_id}>
                      <td className="py-2.5 font-semibold text-slate-700">
                        {n.node_id}{n.stale ? " (STALE)" : ""}
                      </td>
                      <td className="py-2.5">{n.water_level_cm ?? "—"} cm</td>
                      <td className="py-2.5">
                        <Badge value={n.stale ? "STALE" : n.status || "NORMAL"} />
                      </td>
                      <td className="py-2.5">{n.battery_v ?? "—"} V</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nodeList.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                Waiting for node readings.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );

  const content =
    {
      dashboard,
      map: (
        <Card
          title="Monitoring Map"
          subtitle="Live location and status of monitoring nodes"
          className="h-[calc(100vh-120px)]"
        >
          <div className="h-[calc(100vh-210px)] overflow-hidden rounded-lg">
            <MapView nodes={nodes} equipment={equipment} />
          </div>
        </Card>
      ),
      alerts: <OperatorPanel token={token} />,
      grid: <GridPanel token={token} role={role} />,
      reports: <ReportsPanel token={token} />,
      nodes: (
        <div className="space-y-5">
          <AdminPanel token={token} />
          <Card
            title="Node Location Management"
            subtitle="Drag markers to update coordinates"
          >
            <div className="h-[500px] overflow-hidden rounded-lg">
              <AdminMap />
            </div>
          </Card>
        </div>
      ),
      audit: (
        <div className="space-y-5">
          <AuditPanel token={token} role={role} />
          <AuditSummary token={token} role={role} />
          {role === "admin" && <AuditTrends token={token} role={role} />}
        </div>
      ),
      admin: (
        <div className="space-y-5">
          <AdminPanel token={token} />
          <AdminUserPanel token={token} />
          <Card title="Node Location Management">
            <div className="h-[500px] overflow-hidden rounded-lg">
              <AdminMap />
            </div>
          </Card>
          <ReportsPanel token={token} />
          <AuditTrends token={token} role={role} />
        </div>
      ),
      profile: <Profile token={token} role={role} />,
    }[active] || dashboard;

  const navigate = (id) => {
    setActive(id);
    setMobileMenu(false);
  };
  return (
    <div className="flex min-h-screen bg-[#f6f8fb]">
      <Sidebar
        active={active}
        onNavigate={navigate}
        role={role}
        onLogout={logout}
        alertCount={alertCount}
        className="hidden lg:flex"
      />
      {mobileMenu && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileMenu(false)}
        >
          <div
            className="h-full w-72 bg-[#06284b] text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              active={active}
              onNavigate={navigate}
              role={role}
              onLogout={logout}
              alertCount={alertCount}
              mobile
            />
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Header
          title={titles[active]}
          role={role}
          onMenu={() => setMobileMenu(true)}
          onLogout={logout}
          alertCount={alertCount}
        />
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">{content}</main>
      </div>
    </div>
  );
}
