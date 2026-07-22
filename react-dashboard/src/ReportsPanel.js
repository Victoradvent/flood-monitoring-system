import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';

function downloadCSV(endpoint, filename) {
  fetch(endpoint)
    .then(res => res.text())
    .then(text => {
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
}

export default function ReportsPanel() {
  const [alertsPerDay, setAlertsPerDay] = useState([]);
  const [eventsPerDay, setEventsPerDay] = useState([]);
  const [responseTime, setResponseTime] = useState([]);

  useEffect(() => {
    fetch('/reports/alerts-per-day').then(res => res.json()).then(setAlertsPerDay);
    fetch('/reports/events-per-day').then(res => res.json()).then(setEventsPerDay);
    fetch('/reports/response-time').then(res => res.json()).then(setResponseTime);
  }, []);

  return (
    <div>
      <h2>Reporting Dashboard</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => downloadCSV('/reports/alerts-per-day.csv', 'alerts-per-day.csv')}>
          Download Alerts CSV
        </button>
        <button onClick={() => downloadCSV('/reports/events-per-day.csv', 'events-per-day.csv')}>
          Download Events CSV
        </button>
        <button onClick={() => downloadCSV('/reports/response-time.csv', 'response-time.csv')}>
          Download Response Time CSV
        </button>
      </div>

      <h3>Alerts per Day</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={alertsPerDay}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="critical_count" fill="#d73027" name="Critical" />
          <Bar dataKey="warning_count" fill="#fdae61" name="Warning" />
        </BarChart>
      </ResponsiveContainer>

      <h3>Notifications &amp; Sounds per Day</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={eventsPerDay}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="notifications" fill="#4575b4" name="Notifications" />
          <Bar dataKey="sounds" fill="#74add1" name="Sounds" />
        </BarChart>
      </ResponsiveContainer>

      <h3>Average Response Time (seconds)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={responseTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis unit="s" />
          <Tooltip />
          <Line type="monotone" dataKey="avg_response_seconds" stroke="#1a9850" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
