// import React, { useEffect, useState } from 'react';

// export default function AdminPanel() {
//   const [nodes, setNodes] = useState([]);
//   const [form, setForm] = useState({ node_id: '', name: '', lat: '', lng: '', description: '' });
//   const [message, setMessage] = useState('');

//   const loadNodes = async () => {
//     try {
//       const res = await fetch('/nodes');
//       const data = await res.json();
//       setNodes(data);
//     } catch (err) {
//       console.error('Failed to load nodes', err);
//     }
//   };

//   useEffect(() => {
//     loadNodes();
//   }, []);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       const res = await fetch('/nodes', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           node_id: form.node_id,
//           name: form.name,
//           lat: form.lat ? Number(form.lat) : null,
//           lng: form.lng ? Number(form.lng) : null,
//           description: form.description
//         })
//       });

//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || 'Failed to save node');
//       setMessage(`Saved ${data.node_id}`);
//       setForm({ node_id: '', name: '', lat: '', lng: '', description: '' });
//       loadNodes();
//     } catch (err) {
//       setMessage(err.message);
//     }
//   };

//   const handleDelete = async (nodeId) => {
//     try {
//       const res = await fetch(`/nodes/${encodeURIComponent(nodeId)}`, { method: 'DELETE' });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || 'Failed to delete node');
//       setMessage(`Deleted ${nodeId}`);
//       loadNodes();
//     } catch (err) {
//       setMessage(err.message);
//     }
//   };

//   return (
//     <div style={{ padding: 12 }}>
//       <h3>Admin Panel</h3>
//       {message && <p>{message}</p>}

//       <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
//         <input
//           placeholder="Node ID"
//           value={form.node_id}
//           onChange={(e) => setForm({ ...form, node_id: e.target.value })}
//           required
//         />
//         <input
//           placeholder="Name"
//           value={form.name}
//           onChange={(e) => setForm({ ...form, name: e.target.value })}
//         />
//         <input
//           placeholder="Latitude"
//           value={form.lat}
//           onChange={(e) => setForm({ ...form, lat: e.target.value })}
//         />
//         <input
//           placeholder="Longitude"
//           value={form.lng}
//           onChange={(e) => setForm({ ...form, lng: e.target.value })}
//         />
//         <input
//           placeholder="Description"
//           value={form.description}
//           onChange={(e) => setForm({ ...form, description: e.target.value })}
//         />
//         <button type="submit">Save Node</button>
//       </form>

//       <ul>
//         {nodes.map((node) => (
//           <li key={node.node_id} style={{ marginBottom: 8 }}>
//             <strong>{node.node_id}</strong> — {node.name || 'Unnamed'}
//             <button onClick={() => handleDelete(node.node_id)} style={{ marginLeft: 8 }}>
//               Delete
//             </button>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

import React, { useEffect, useState } from 'react';

export default function AdminPanel() {
  const [nodes, setNodes] = useState([]);
  const [form, setForm] = useState({ node_id: '', name: '', lat: '', lng: '', description: '' });

  useEffect(() => {
    fetch('/nodes').then(res => res.json()).then(setNodes);
  }, []);

  const saveNode = () => {
    fetch('/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    }).then(res => res.json()).then(n => {
      setNodes(prev => {
        const idx = prev.findIndex(x => x.node_id === n.node_id);
        if (idx >= 0) { prev[idx] = n; return [...prev]; }
        return [...prev, n];
      });
    });
  };

  return (
    <div>
      <h3>Admin Panel</h3>
      <input placeholder="Node ID" value={form.node_id} onChange={e => setForm({ ...form, node_id: e.target.value })} />
      <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Lat" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} />
      <input placeholder="Lng" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} />
      <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <button onClick={saveNode}>Save</button>
      <ul>
        {nodes.map(n => (
          <li key={n.node_id}>{n.node_id} — {n.name} ({n.lat},{n.lng})</li>
        ))}
      </ul>
    </div>
  );
}
