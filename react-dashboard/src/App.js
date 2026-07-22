import React, { useEffect, useState } from 'react';
import MapView from './MapView';
import { subscribe } from './mqttClient';
import ChartPanel from './ChartPanel';
import AdminMap from './AdminMap';
import OperatorPanel from './OperatorPanel';
import ReportsPanel from './ReportsPanel';
import GridPanel from './GridPanel';
import AuditPanel from './AuditPanel';
import AuditSummary from './AuditSummary';
import AuditTrends from './AuditTrends';
import Login from './Login';
import './App.css';

export default function App() {
  const [nodes, setNodes] = useState({}); // { nodeId: { ...latest } }
  const [log, setLog] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('jwt'));
  const [role, setRole] = useState(localStorage.getItem('role'));

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'reading' && msg.payload) {
        const p = msg.payload;
        setNodes((prev) => ({
          ...prev,
          [p.node_id]: {
            node_id: p.node_id,
            timestamp: p.timestamp,
            water_level_cm: p.water_level_cm,
            battery_v: p.battery_v,
            status: p.status || 'OK',
            lat: p.lat || prev?.[p.node_id]?.lat,
            lng: p.lng || prev?.[p.node_id]?.lng
          }
        }));
        setLog((l) => [
          `Reading ${p.node_id} ${p.water_level_cm}cm ${p.status}`,
          ...l
        ].slice(0, 50));
      } else if (msg.type === 'alert') {
        setLog((l) => [
          `ALERT ${msg.node} ${msg.level} ${msg.levelValue}cm`,
          ...l
        ].slice(0, 50));
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Flood and Grid Hazard Dashboard</h1>
      </header>
      <div className="app-body">
        <div className="map-pane">
          <MapView nodes={nodes} />
        </div>
        <aside className="side-pane">
          <section>
            <h3>Nodes</h3>
            <ul>
              {Object.keys(nodes).length === 0 && <li>No nodes yet</li>}
              {Object.entries(nodes).map(([id, n]) => (
                <li
                  key={id}
                  onClick={() => setSelectedNode(id)}
                  style={{ cursor: 'pointer' }}
                >
                  <strong>{id}</strong> — {n.status} — {n.water_level_cm} cm
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Activity Log</h3>
            <div className="log">
              {log.map((l, i) => (
                <div key={i} className="log-line">{l}</div>
              ))}
            </div>
          </section>
          <section>
            <ChartPanel selectedNode={selectedNode} />
          </section>
          {role === 'admin' && (
            <>
              <section>
                <h3>Admin Location Editor</h3>
                <AdminMap />
              </section>
              <section>
                <ReportsPanel />
              </section>
            </>
          )}

          {['admin', 'operator'].includes(role) && (
            <section>
              <GridPanel token={token} role={role} />
            </section>
          )}

          {['admin', 'operator'].includes(role) && (
            <section>
              <AuditPanel token={token} role={role} />
            </section>
          )}

          {['admin', 'operator'].includes(role) && (
            <section>
              <AuditSummary token={token} role={role} />
            </section>
          )}

          {role === 'admin' && (
            <section>
              <AuditTrends token={token} role={role} />
            </section>
          )}

          {role === 'operator' && (
            <section>
              <OperatorPanel />
            </section>
          )}

          {!token ? (
            <Login onLogin={(nextToken, nextRole) => {
              setToken(nextToken);
              setRole(nextRole);
            }} />
          ) : role && role !== 'admin' && role !== 'operator' && (
            <p>You are logged in as {role}. Admin features are hidden.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
