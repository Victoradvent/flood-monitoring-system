import React, { useEffect, useState } from 'react';
import axios from 'axios';

function AuditTrends({ token, role }) {
  const [trends, setTrends] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (role !== 'admin' || !token) return;

    axios.get('/audit-trends/weekly-trends', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setTrends(res.data.trends);
        setAlerts(res.data.alerts || []);
      })
      .catch(err => console.error(err));
  }, [token, role]);

  if (role !== 'admin') {
    return null;
  }

  return (
    <div className="audit-trends">
      <h2>Weekly Trend Analysis</h2>
      {alerts.length > 0 && (
        <div className="trend-alerts" style={{ marginBottom: '16px', color: 'red' }}>
          {alerts.map((a, idx) => (
            <p key={idx} style={{ fontWeight: 'bold' }}>{a}</p>
          ))}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Last Week</th>
            <th>Previous Week</th>
            <th>Change (%)</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((t, idx) => (
            <tr key={idx}>
              <td>{t.action}</td>
              <td>{t.currentCount}</td>
              <td>{t.prevCount}</td>
              <td style={{ color: t.change >= 0 ? 'green' : 'red' }}>
                {t.change}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AuditTrends;
