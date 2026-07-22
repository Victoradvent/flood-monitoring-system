import React, { useEffect, useState } from 'react';
import axios from 'axios';

function GridPanel({ token, role }) {
  const [equipment, setEquipment] = useState([]);

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const res = await axios.get('/grid', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEquipment(res.data);
      } catch (err) {
        console.error('Error fetching equipment', err);
      }
    };

    if (token) {
      fetchEquipment();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;

    const ws = new WebSocket(`ws://${window.location.hostname}:3000`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'grid_hazard') {
          alert(msg.message);
        }
        if (msg.type === 'grid_cutoff') {
          alert(msg.message);
          setEquipment((prev) => prev.map((eq) => eq.id === msg.equipment.id ? msg.equipment : eq));
        }
        if (msg.type === 'inspection_required') {
          alert(msg.message);
          setEquipment((prev) => prev.map((eq) => eq.id === msg.equipment.id ? msg.equipment : eq));
        }
        if (msg.type === 'inspection_complete') {
          alert(msg.message);
          setEquipment((prev) => prev.map((eq) => eq.id === msg.equipment.id ? msg.equipment : eq));
        }
      } catch (err) {
        console.error('WebSocket message error', err);
      }
    };

    ws.onopen = () => console.log('GridPanel websocket connected');
    ws.onerror = (err) => console.error('GridPanel websocket error', err);

    return () => {
      ws.close();
    };
  }, [token]);

  const cutPower = async (id) => {
    try {
      const res = await axios.post(`/grid/${id}/cutoff`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
      setEquipment((prev) => prev.map((eq) => (eq.id === id ? res.data.equipment : eq)));
    } catch (err) {
      console.error('Cutoff error', err);
    }
  };

  const restorePower = async (id) => {
    try {
      const res = await axios.post(`/grid/${id}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
      setEquipment((prev) => prev.map((eq) => (eq.id === id ? res.data.equipment : eq)));
    } catch (err) {
      console.error('Restore error', err);
    }
  };

  return (
    <div className="grid-panel">
      <h3>Grid Equipment Control</h3>
      {equipment.length === 0 ? (
        <p>No equipment found.</p>
      ) : (
        <ul>
          {equipment.map((item) => (
            <li key={item.id} style={{ marginBottom: '8px' }}>
              <strong>{item.name}</strong> — {item.status || 'ON'}
              <div style={{ marginTop: '4px' }}>
                <button onClick={() => cutPower(item.id)} style={{ marginRight: '8px' }}>
                  Cut Power
                </button>
                <button onClick={() => restorePower(item.id)}>
                  Restore Power
                </button>
                {['admin', 'operator'].includes(role) && item.status === 'OFF' && (
                  <button
                    onClick={async () => {
                      const notes = prompt('Enter inspection notes:');
                      if (notes === null) return;
                      try {
                        const res = await axios.post(
                          `/inspection/${item.id}/inspect`,
                          { notes },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        alert(res.data.message);
                        setEquipment((prev) => prev.map((eq) => (eq.id === item.id ? res.data.equipment : eq)));
                      } catch (err) {
                        console.error('Inspection error', err);
                        alert(err.response?.data?.error || 'Inspection failed');
                      }
                    }}
                    style={{ marginLeft: '8px' }}
                  >
                    Confirm Inspection & Restore Power
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GridPanel;
