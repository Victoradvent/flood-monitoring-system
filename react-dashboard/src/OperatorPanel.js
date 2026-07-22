import React, { useEffect, useState } from 'react';
import { showNotification, requestPermission, playAlertSound } from './notifications';

function logEvent(alertId, type, token) {
  fetch('/alert-events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ alert_id: alertId, event_type: type })
  }).catch(err => console.error('Log event error', err));
}

export default function OperatorPanel() {
  const [alerts, setAlerts] = useState([]);
  const token = localStorage.getItem('jwt');

  useEffect(() => {
    requestPermission();

    fetch('/alerts', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(setAlerts)
      .catch(err => console.error('Fetch alerts error', err));

    const ws = new WebSocket('ws://localhost:3000');
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'alert') {
          setAlerts(prev => [msg, ...prev]);

          if (msg.level === 'CRITICAL') {
            showNotification(
              `CRITICAL Alert - ${msg.node}`,
              `Water level ${msg.levelValue} cm at ${msg.timestamp}`
            );
            playAlertSound();

            logEvent(msg.id, 'notification', token);
            logEvent(msg.id, 'sound', token);
          }
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    return () => ws.close();
  }, [token]);

  const acknowledge = (id) => {
    fetch(`/alerts/${id}/ack`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(updated => {
        setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
      })
      .catch(err => console.error('Ack error', err));
  };

  return (
    <div>
      <h3>Operator Alerts</h3>
      <ul>
        {alerts.map((a, i) => (
          <li key={a.id || i}>
            {a.node || a.node_id} — {a.level || a.alert_level} — {a.timestamp || a.triggered_at}
            {a.acknowledged ? (
              <span> ✅ acknowledged by {a.acknowledged_by}</span>
            ) : (
              <button onClick={() => acknowledge(a.id)}>Acknowledge</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
