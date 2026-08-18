import React, { useEffect, useState } from 'react';
import axios from 'axios';

function AuditPanel({ token, role }) {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ start: '', end: '', operator: '', action: '' });

  const fetchLogs = () => {
    const params = new URLSearchParams(filters).toString();
    axios.get(`/audit/filter?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setLogs(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (token) fetchLogs();
  }, [token]);

  return (
    <div className="audit-panel">
      <h2>Audit Logs</h2>
      <div className="filters" style={{ marginBottom: '12px' }}>
        <input
          type="date"
          value={filters.start}
          onChange={e => setFilters({ ...filters, start: e.target.value })}
          style={{ marginRight: '8px' }}
        />
        <input
          type="date"
          value={filters.end}
          onChange={e => setFilters({ ...filters, end: e.target.value })}
          style={{ marginRight: '8px' }}
        />
        <input
          type="text"
          placeholder="Operator ID"
          value={filters.operator}
          onChange={e => setFilters({ ...filters, operator: e.target.value })}
          style={{ marginRight: '8px' }}
        />
        <select
          value={filters.action}
          onChange={e => setFilters({ ...filters, action: e.target.value })}
          style={{ marginRight: '8px' }}
        >
          <option value="">All Actions</option>
          <option value="RECOMMEND_CUTOFF">Cutoff Recommendation</option>
          <option value="CUTOFF">Cutoff</option>
          <option value="RESTORE">Restore</option>
          <option value="INSPECTION">Inspection</option>
          <option value="REPORT_VIEW">Report View</option>
          <option value="REPORT_EXPORT">Report Export</option>
        </select>
        <button onClick={fetchLogs} style={{ marginRight: '8px' }}>Apply Filters</button>
        {role === 'admin' && (
        <button
          onClick={async () => {
            try {
              const query = new URLSearchParams(filters).toString();

              const response = await fetch(
                `/audit/export/csv?${query}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                }
              );

              if (!response.NORMAL) {
                throw new Error('CSV export failed');
              }

              const blob = await response.blob();

              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');

              link.href = url;
              link.download = 'audit_logs.csv';

              document.body.appendChild(link);
              link.click();
              link.remove();

              window.URL.revokeObjectURL(url);
            } catch (err) {
              console.error('CSV export error:', err);
              alert(err.message);
            }
          }}
        >
          Export CSV
        </button>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Equipment</th>
            <th>Operator</th>
            <th>Action</th>
            <th>Timestamp</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{log.equipment_name || '—'}</td>
              <td>{log.operator_id}</td>
              <td>{log.action}</td>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AuditPanel;
