import React, { useEffect, useState } from "react";
import Card from "./components/ui/Card";
import Icon from "./components/ui/Icon";
function decodeUsername(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).username;
  } catch {
    return null;
  }
}
export default function AdminUserPanel({ token }) {
  const [users, setUsers] = useState([]),
    [form, setForm] = useState({
      username: "",
      password: "",
      role: "operator",
    }),
    [message, setMessage] = useState("");
  const currentUsername = decodeUsername(token);
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const loadUsers = async () => {
    try {
      const r = await fetch("/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load accounts");
      setUsers(d);
    } catch (e) {
      setMessage(e.message);
    }
  };
  useEffect(() => {
    if (token) loadUsers();
  }, [token]);
  const createUser = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      const r = await fetch("/users", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to create account");
      setMessage(`Created ${d.role} account "${d.username}"`);
      setForm({ username: "", password: "", role: "operator" });
      loadUsers();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const deleteUser = async (id) => {
    if (
      !window.confirm(
        "Remove this account? They will no longer be able to log in.",
      )
    )
      return;
    try {
      const r = await fetch(`/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok && r.status !== 204) {
        const d = await r.json();
        throw new Error(d.error || "Failed to remove account");
      }
      setMessage("Account removed");
      loadUsers();
    } catch (e) {
      setMessage(e.message);
    }
  };
  return (
    <Card
      title="Admin & Operator Accounts"
      subtitle="Manage dashboard access and roles"
    >
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {" "}
        <form onSubmit={createUser} className="space-y-3">
          <input
            className="input-field"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            className="input-field"
            placeholder="Password (min 8 characters)"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            required
          />
          <select
            className="input-field"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
          <button className="primary-btn w-full" type="submit">
            <Icon name="plus" size={16} />
            Create Account
          </button>
        </form>
        <div>
          {message && (
            <div className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              {message}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-3">Username</th>
                  <th>Role</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-3 font-semibold">{u.username}</td>
                    <td className="capitalize text-slate-500">{u.role}</td>
                    <td className="text-right">
                      {u.username !== currentUsername && (
                        <button
                          onClick={() => deleteUser(u.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Icon name="trash" size={13} />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
}
