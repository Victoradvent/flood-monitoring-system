import React, {
  useEffect,
  useState
} from 'react';

import MapView from './MapView';
import ChartPanel from './ChartPanel';
import AdminMap from './AdminMap';
import OperatorPanel from './OperatorPanel';
import ReportsPanel from './ReportsPanel';
import GridPanel from './GridPanel';
import AuditPanel from './AuditPanel';
import AuditSummary from './AuditSummary';
import AuditTrends from './AuditTrends';
import Login from './Login';
import AdminPanel from './AdminPanel';
import AdminUserPanel from './AdminUserPanel';
import ResidentDashboard from './ResidentDashboard';
import { subscribe } from './wsClient';

import './App.css';

export default function App() {
  // Residents reach this app via a separate link (e.g. /resident) and never
  // see the operator/admin login - they only get their own node's status.
  if (window.location.pathname.startsWith('/resident')) {
    return <ResidentDashboard />;
  }

  const [nodes, setNodes] = useState({});
  const [log, setLog] = useState([]);
  const [selectedNode, setSelectedNode] =
    useState(null);

  const [token, setToken] = useState(
    localStorage.getItem('jwt')
  );

  const [role, setRole] = useState(
    localStorage.getItem('role')
  );

  useEffect(() => {
    if (!token) return undefined;

    const unsubscribe = subscribe(msg => {
      if (
        msg.type === 'reading' &&
        msg.payload
      ) {
        const payload = msg.payload;

        setNodes(prev => ({
          ...prev,

          [payload.node_id]: {
            node_id: payload.node_id,
            timestamp: payload.timestamp,
            water_level_cm:
              payload.water_level_cm,
            battery_v: payload.battery_v,
            status:
              payload.status || 'NORMAL',
            lat:
              payload.lat ??
              prev[payload.node_id]?.lat,
            lng:
              payload.lng ??
              prev[payload.node_id]?.lng
          }
        }));

        setLog(previous => [
          `Reading ${payload.node_id} ` +
            `${payload.water_level_cm}cm ` +
            `${payload.status}`,
          ...previous
        ].slice(0, 50));
      }

      if (msg.type === 'alert') {
        setLog(previous => [
          `ALERT ${msg.node} ` +
            `${msg.level} ` +
            `${msg.levelValue}cm`,
          ...previous
        ].slice(0, 50));
      }
    });

    return unsubscribe;
  }, [token]);

  if (!token) {
    return (
      <Login
        onLogin={(nextToken, nextRole) => {
          localStorage.setItem(
            'jwt',
            nextToken
          );

          localStorage.setItem(
            'role',
            nextRole
          );

          setToken(nextToken);
          setRole(nextRole);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          Flood and Grid Hazard Dashboard
        </h1>

        <button
          onClick={() => {
            localStorage.removeItem('jwt');
            localStorage.removeItem('role');

            setToken(null);
            setRole(null);
          }}
        >
          Logout
        </button>
      </header>

      <div className="app-body">
        <div className="map-pane">
          <MapView nodes={nodes} />
        </div>

        <aside className="side-pane">
          <section>
            <h3>Nodes</h3>

            <ul>
              {Object.keys(nodes).length === 0 && (
                <li>No nodes yet</li>
              )}

              {Object.entries(nodes).map(
                ([id, node]) => (
                  <li
                    key={id}
                    onClick={() =>
                      setSelectedNode(id)
                    }
                    style={{
                      cursor: 'pointer'
                    }}
                  >
                    <strong>{id}</strong>
                    {' — '}
                    {node.status}
                    {' — '}
                    {node.water_level_cm}
                    {' cm'}
                  </li>
                )
              )}
            </ul>
          </section>

          <section>
            <ChartPanel
              selectedNode={selectedNode}
              token={token}
            />
          </section>

          {role === 'admin' && (
            <>
              <section>
                <AdminPanel
                  token={token}
                />
              </section>

              <section>
                <AdminUserPanel
                  token={token}
                />
              </section>

              <section>
                <AdminMap />
              </section>

              <section>
                <ReportsPanel
                  token={token}
                />
              </section>

              <section>
                <AuditTrends
                  token={token}
                  role={role}
                />
              </section>
            </>
          )}

          {['admin', 'operator'].includes(role) && (
            <>
              <section>
                <GridPanel
                  token={token}
                  role={role}
                />
              </section>

              <section>
                <AuditPanel
                  token={token}
                  role={role}
                />
              </section>

              <section>
                <AuditSummary
                  token={token}
                  role={role}
                />
              </section>
            </>
          )}

          {role === 'operator' && (
            <section>
              <OperatorPanel />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}