import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export default function ReportsPanel({ token }) {
  const [alertsPerDay, setAlertsPerDay] = useState([]);
  const [eventsPerDay, setEventsPerDay] = useState([]);
  const [responseTime, setResponseTime] = useState([]);

  const authFetch = async endpoint => {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || 'Request failed'
      );
    }

    return data;
  };

  useEffect(() => {
    if (!token) return;

    Promise.all([
      authFetch('/reports/alerts-per-day'),
      authFetch('/reports/events-per-day'),
      authFetch('/reports/response-time')
    ])
      .then(([alerts, events, response]) => {
        setAlertsPerDay(alerts);
        setEventsPerDay(events);
        setResponseTime(response);
      })
      .catch(err => {
        console.error(
          'Report loading error:',
          err
        );
      });
  }, [token]);

  const downloadCSV = async (
    endpoint,
    filename
  ) => {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(
          'Failed to download report'
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        'CSV download error:',
        err
      );
    }
  };

  return (
    <div>
      <h2>Reporting Dashboard</h2>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16
        }}
      >
        <button
          onClick={() =>
            downloadCSV(
              '/reports/alerts-per-day.csv',
              'alerts-per-day.csv'
            )
          }
        >
          Download Alerts CSV
        </button>

        <button
          onClick={() =>
            downloadCSV(
              '/reports/events-per-day.csv',
              'events-per-day.csv'
            )
          }
        >
          Download Events CSV
        </button>

        <button
          onClick={() =>
            downloadCSV(
              '/reports/response-time.csv',
              'response-time.csv'
            )
          }
        >
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
          <Bar
            dataKey="critical_count"
            name="Critical"
          />
          <Bar
            dataKey="warning_count"
            name="Warning"
          />
        </BarChart>
      </ResponsiveContainer>

      <h3>
        Notifications &amp; Sounds per Day
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={eventsPerDay}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Bar
            dataKey="notifications"
            name="Notifications"
          />
          <Bar
            dataKey="sounds"
            name="Sounds"
          />
        </BarChart>
      </ResponsiveContainer>

      <h3>
        Average Response Time (seconds)
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={responseTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis unit="s" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="avg_response_seconds"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}