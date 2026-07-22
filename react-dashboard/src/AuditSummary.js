import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, Title, Tooltip, Legend);

function AuditSummary({ token, role }) {
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);

  useEffect(() => {
    if (!token) return;

    axios.get('/audit-summary/daily', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setDaily(res.data))
      .catch(err => console.error(err));

    axios.get('/audit-summary/weekly', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setWeekly(res.data))
      .catch(err => console.error(err));
  }, [token]);

  const allowedActions = role === 'admin'
    ? [...new Set([...daily.map(row => row.action), ...weekly.map(row => row.action)])]
    : ['CUTOFF', 'RESTORE', 'INSPECTION'];

  const dailyLabels = [...new Set(daily.map(row => row.day))];
  const dailyDatasets = allowedActions.map(action => ({
    label: action,
    data: dailyLabels.map(day => {
      const entry = daily.find(r => r.day === day && r.action === action);
      return entry ? Number(entry.count) : 0;
    }),
    backgroundColor: action.includes('REPORT') ? 'rgba(54, 162, 235, 0.6)' : 'rgba(255, 99, 132, 0.6)'
  }));

  const weeklyLabels = [...new Set(weekly.map(row => row.week))];
  const weeklyDatasets = allowedActions.map(action => ({
    label: action,
    data: weeklyLabels.map(week => {
      const entry = weekly.find(r => r.week === week && r.action === action);
      return entry ? Number(entry.count) : 0;
    }),
    borderColor: action.includes('REPORT') ? 'rgba(54, 162, 235, 0.8)' : 'rgba(255, 99, 132, 0.8)',
    backgroundColor: action.includes('REPORT') ? 'rgba(54, 162, 235, 0.4)' : 'rgba(255, 99, 132, 0.4)',
    fill: false,
  }));

  return (
    <div className="audit-summary">
      <h2>Audit Summary</h2>
      <div>
        <h3>Daily Summary</h3>
        <Bar
          data={{ labels: dailyLabels, datasets: dailyDatasets }}
          options={{ responsive: true, plugins: { legend: { position: 'top' } } }}
        />
      </div>
      <div style={{ marginTop: '24px' }}>
        <h3>Weekly Summary</h3>
        <Line
          data={{ labels: weeklyLabels, datasets: weeklyDatasets }}
          options={{ responsive: true, plugins: { legend: { position: 'top' } } }}
        />
      </div>
    </div>
  );
}

export default AuditSummary;
