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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Reporting Dashboard
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Review system alerts, events, and response performance.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() =>
            downloadCSV(
              '/reports/alerts-per-day.csv',
              'alerts-per-day.csv'
            )
          }
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
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
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
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
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Download Response Time CSV
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Alerts per Day
        </h3>

        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Events per Day
        </h3>

        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Average Response Time
        </h3>

        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
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
      </section>
    </div>
  );
}