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

  const recommendedEquipment = equipment.filter(item => item.recommended);

  useEffect(() => {
    if (!token) return undefined;

    const ws = new WebSocket(`ws://${window.location.hostname}:3000`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'grid_hazard' || msg.type === 'grid_recommendation') {
          alert(msg.message);
        }
        if (msg.type === 'grid_recommendation' && msg.equipment) {
          setEquipment(prev => prev.map(eq => eq.id === msg.equipment.id ? msg.equipment : eq));
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

  const recommendCutoff = async (id) => {
    try {
      const res = await axios.post(`/grid/${id}/cutoff`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
      setEquipment((prev) => prev.map((eq) => (eq.id === id ? res.data.equipment : eq)));
    } catch (err) {
      console.error('Recommendation error', err);
    }
  };

  return (
    <div className="grid-panel">
      <h3>Grid Equipment Monitoring</h3>

      {recommendedEquipment.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '12px', border: '1px solid #f5c2c7', background: '#fff1f0' }}>
          <h4>Recommended Cutoff Actions</h4>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {recommendedEquipment.map(item => (
              <li key={item.id}>
                <strong>{item.name}</strong> — {item.status || 'ON'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {equipment.length === 0 ? (
        <p>No equipment found.</p>
      ) : (
        <ul>
          {equipment.map((item) => (
            <li key={item.id} style={{ marginBottom: '8px' }}>
              <strong>{item.name}</strong> — {item.status || 'ON'}
              <div style={{ marginTop: '4px' }}>
                <button onClick={() => recommendCutoff(item.id)} style={{ marginRight: '8px' }}>
                  Recommend Cutoff
                </button>
                {item.recommended && (
                  <span style={{ marginLeft: '12px', color: '#b33', fontWeight: 'bold' }}>
                    Cutoff recommended
                  </span>
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
