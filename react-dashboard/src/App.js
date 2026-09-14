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
};

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
