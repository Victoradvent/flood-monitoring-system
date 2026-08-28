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
  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'operator'
  });
  const [message, setMessage] = useState('');

  const currentUsername = decodeUsername(token);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'Failed to load accounts'
        );
      }

      setUsers(data);
    } catch (err) {
      setMessage(err.message);
    }
  };

  useEffect(() => {
    if (token) {
      loadUsers();
    }
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

      if (!res.ok) {
        throw new Error(
          data.error || 'Failed to create account'
        );
      }

      setMessage(
        `Created ${data.role} account "${data.username}"`
      );

      setForm({
        username: '',
        password: '',
        role: 'operator'
      });

      loadUsers();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const deleteUser = async id => {
    if (
      !window.confirm(
        'Remove this account? They will no longer be able to log in.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json();

        throw new Error(
          data.error || 'Failed to remove account'
        );
      }

      setMessage('Account removed');
      loadUsers();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Admin &amp; Operator Accounts
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Create and manage dashboard accounts.
        </p>
      </div>

      {message && (
        <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <form
        onSubmit={createUser}
        className="grid gap-3"
      >
        <input
          placeholder="Username"
          value={form.username}
          onChange={e =>
            setForm({
              ...form,
              username: e.target.value
            })
          }
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />

        <input
          placeholder="Password (min 8 characters)"
          type="password"
          value={form.password}
          onChange={e =>
            setForm({
              ...form,
              password: e.target.value
            })
          }
          minLength={8}
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />

        <select
          value={form.role}
          onChange={e =>
            setForm({
              ...form,
              role: e.target.value
            })
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        >
          <option value="operator">
            Operator
          </option>

          <option value="admin">
            Admin
          </option>
        </select>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Create Account
        </button>
      </form>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Existing Accounts
        </h4>

        <ul className="space-y-2">
          {users.map(u => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <strong className="text-sm text-slate-900">
                  {u.username}
                </strong>

                <span className="ml-2 text-sm text-slate-500">
                  {u.role}
                </span>
              </div>

              {u.username !== currentUsername && (
                <button
                  onClick={() => deleteUser(u.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
