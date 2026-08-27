import React, { useEffect, useState } from 'react';

export default function AdminPanel({ token }) {
  const [nodes, setNodes] = useState([]);
  const [form, setForm] = useState({
    node_id: '',
    name: '',
    lat: '',
    lng: '',
    description: ''
  });
  const [message, setMessage] = useState('');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  const loadNodes = async () => {
    try {
      const res = await fetch('/nodes', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load nodes');
      }

      setNodes(data);
    } catch (err) {
      setMessage(err.message);
    }
  };

  useEffect(() => {
    if (token) {
      loadNodes();
    }
  }, [token]);

  const saveNode = async e => {
    e.preventDefault();

    try {
      const existing = nodes.find(
        node => node.node_id === form.node_id
      );

      const url = existing
        ? `/nodes/${existing.id}`
        : '/nodes';

      const method = existing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify({
          node_id: form.node_id,
          name: form.name,
          lat: form.lat === '' ? null : Number(form.lat),
          lng: form.lng === '' ? null : Number(form.lng),
          description: form.description
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save node');
      }

      setMessage(
        existing
          ? `Updated ${data.node_id}`
          : `Created ${data.node_id}`
      );

      setForm({
        node_id: '',
        name: '',
        lat: '',
        lng: '',
        description: ''
      });

      loadNodes();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const deleteNode = async id => {
    if (!window.confirm('Delete this node?')) {
      return;
    }

    try {
      const res = await fetch(`/nodes/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete node');
      }

      setMessage('Node deleted');
      loadNodes();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <h3>Node Administration</h3>

      {message && <p>{message}</p>}

      <form
        onSubmit={saveNode}
        style={{
          display: 'grid',
          gap: '8px',
          marginBottom: '16px'
        }}
      >
        <input
          placeholder="Node ID"
          value={form.node_id}
          onChange={e =>
            setForm({
              ...form,
              node_id: e.target.value
            })
          }
          required
        />

        <input
          placeholder="Name"
          value={form.name}
          onChange={e =>
            setForm({
              ...form,
              name: e.target.value
            })
          }
        />

        <input
          placeholder="Latitude"
          value={form.lat}
          onChange={e =>
            setForm({
              ...form,
              lat: e.target.value
            })
          }
        />

        <input
          placeholder="Longitude"
          value={form.lng}
          onChange={e =>
            setForm({
              ...form,
              lng: e.target.value
            })
          }
        />

        <input
          placeholder="Description"
          value={form.description}
          onChange={e =>
            setForm({
              ...form,
              description: e.target.value
            })
          }
        />

        <button type="submit">
          Save Node
        </button>
      </form>

      <ul>
        {nodes.map(node => (
          <li key={node.id}>
            <strong>{node.node_id}</strong>
            {' — '}
            {node.name || 'Unnamed'}
            {' '}
            ({node.lat}, {node.lng})

            <button
              onClick={() =>
                deleteNode(node.id)
              }
              style={{ marginLeft: '10px' }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}