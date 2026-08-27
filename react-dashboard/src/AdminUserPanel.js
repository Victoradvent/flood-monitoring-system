import React, { useEffect, useState } from 'react';

function decodeUsername(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).username;
  } catch {
    return null;
  }
}

export default function AdminUserPanel({ token }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'operator' });
  const [message, setMessage] = useState('');
  const currentUsername = decodeUsername(token);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to load accounts');
      setUsers(data);
    } catch (err) {
      setMessage(err.message);
    }
  };

  useEffect(() => {
    if (token) loadUsers();
  }, [token]);

  const createUser = async e => {
    e.preventDefault();
    setMessage('');

    try {
      const res = await fetch('/users', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      setMessage(`Created ${data.role} account "${data.username}"`);
      setForm({ username: '', password: '', role: 'operator' });
      loadUsers();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const deleteUser = async id => {
    if (!window.confirm('Remove this account? They will no longer be able to log in.')) {
      return;
    }

    try {
      const res = await fetch(`/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove account');
      }

      setMessage('Account removed');
      loadUsers();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <h3>Admin &amp; Operator Accounts</h3>

      {message && <p>{message}</p>}

      <form onSubmit={createUser} style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Username"
          value={form.username}
          onChange={e => setForm({ ...form, username: e.target.value })}
          required
        />

        <input
          placeholder="Password (min 8 characters)"
          type="password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          minLength={8}
          required
        />

        <select
          value={form.role}
          onChange={e => setForm({ ...form, role: e.target.value })}
        >
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>

        <button type="submit">Create Account</button>
      </form>

      <ul>
        {users.map(u => (
          <li key={u.id}>
            <strong>{u.username}</strong>
            {' — '}
            {u.role}

            {u.username !== currentUsername && (
              <button
                onClick={() => deleteUser(u.id)}
                style={{ marginLeft: 10 }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
