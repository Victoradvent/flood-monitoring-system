import React, { useEffect, useState, useCallback } from 'react';
import MapView from './MapView';
import { subscribe } from './wsClient';
import { requestPermission, showNotification, playAlertSound } from './notifications';

const PHONE_KEY = 'resident_phone';
const POLL_MS = 30000;

function statusColor(status) {
  if (status === 'CRITICAL') return '#d73027';
  if (status === 'WARNING') return '#fdae61';
  return '#1a9850';
}

function timeAgo(isoString) {
  if (!isoString) return 'No readings yet';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(isoString).toLocaleString();
}

export default function ResidentDashboard() {
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState(
    localStorage.getItem(PHONE_KEY) || ''
  );
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async (phoneToCheck) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/resident/status?phone=${encodeURIComponent(phoneToCheck)}`
      );
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || 'Could not find your address');
      }

      setData(body);
      localStorage.setItem(PHONE_KEY, phoneToCheck);
      setSavedPhone(phoneToCheck);
      requestPermission();
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on first visit if we already know this resident's phone
  useEffect(() => {
    if (savedPhone) fetchStatus(savedPhone);
  }, []);

  // Refresh periodically so the resident always sees current status
  useEffect(() => {
    if (!savedPhone) return undefined;
    const interval = setInterval(() => fetchStatus(savedPhone), POLL_MS);
    return () => clearInterval(interval);
  }, [savedPhone, fetchStatus]);

  // Live updates - only react to readings/alerts for the resident's own node(s)
  useEffect(() => {
    if (!data || data.nodes.length === 0) return undefined;
    const myNodeIds = new Set(data.nodes.map(n => n.node_id));

    const unsubscribe = subscribe(msg => {
      if (msg.type === 'reading' && msg.payload && myNodeIds.has(msg.payload.node_id)) {
        const payload = msg.payload;
        setData(prev => ({
          ...prev,
          nodes: prev.nodes.map(n =>
            n.node_id === payload.node_id
              ? {
                  ...n,
                  status: payload.status || n.status,
                  water_level_cm: payload.water_level_cm,
                  last_update: payload.timestamp
                }
              : n
          )
        }));
      }

      if (msg.type === 'alert' && myNodeIds.has(msg.node)) {
        if (msg.level === 'CRITICAL') {
          showNotification(
            'Flood Alert: CRITICAL',
            `Water level near you has reached ${msg.levelValue}cm. Move to higher ground.`
          );
          playAlertSound();
        } else {
          showNotification(
            'Flood Alert: WARNING',
            `Water level near you is rising (${msg.levelValue}cm). Stay alert.`
          );
        }
      }
    });

    return unsubscribe;
  }, [data]);

  const changeNumber = () => {
    localStorage.removeItem(PHONE_KEY);
    setSavedPhone('');
    setData(null);
    setPhone('');
  };

  // --- Phone entry screen ---
  if (!data) {
    return (
      <div style={{ maxWidth: 420, margin: '40px auto', padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <h2>Flood Alert Status</h2>
        <p>Enter the phone number you registered with your community coordinator to see the flood status for your area.</p>

        <form
          onSubmit={e => {
            e.preventDefault();
            if (phone.trim()) fetchStatus(phone.trim());
          }}
          style={{ display: 'grid', gap: 8 }}
        >
          <input
            placeholder="e.g. +2348000000001"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Checking...' : 'Check Status'}
          </button>
        </form>

        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      </div>
    );
  }

  // --- Status screen ---
  const mapNodes = {};
  data.nodes.forEach(n => {
    mapNodes[n.node_id] = {
      node_id: n.node_id,
      status: n.status,
      water_level_cm: n.water_level_cm,
      timestamp: n.last_update,
      lat: n.lat,
      lng: n.lng
    };
  });

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>
          {data.resident_name ? `Hello, ${data.resident_name}` : 'Your Flood Status'}
        </h2>
        <button onClick={changeNumber}>Use a different number</button>
      </div>

      {loading && <p>Refreshing...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      {data.nodes.length === 0 && (
        <p>No monitoring point is currently linked to your number.</p>
      )}

      {data.nodes.map(node => (
        <div
          key={node.node_id}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 16,
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: statusColor(node.status)
              }}
            />
            <h3 style={{ margin: 0 }}>{node.name}</h3>
          </div>

          <p style={{ margin: '8px 0', fontWeight: 'bold', color: statusColor(node.status) }}>
            {node.status}
          </p>

          <p>{node.safety_message}</p>

          <p style={{ fontSize: 14, color: '#475569' }}>
            {node.water_level_cm != null
              ? `Current water level: ${node.water_level_cm} cm`
              : 'No readings yet'}
            {' — '}
            Last updated {timeAgo(node.last_update)}
          </p>

          {node.recent_alerts.length > 0 && (
            <>
              <h4 style={{ marginBottom: 4 }}>Recent alerts</h4>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {node.recent_alerts.map((a, i) => (
                  <li key={i} style={{ fontSize: 14 }}>
                    {a.level} — {a.water_level_cm}cm — {timeAgo(a.triggered_at)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}

      {data.nodes.some(n => n.lat && n.lng) && (
        <div style={{ height: 260, borderRadius: 10, overflow: 'hidden' }}>
          <MapView nodes={mapNodes} />
        </div>
      )}
    </div>
  );
}
