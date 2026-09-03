import React, { useEffect, useState } from "react";
import Card from "./components/ui/Card";
import Icon from "./components/ui/Icon";
export default function AdminPanel({ token }) {
  const [nodes, setNodes] = useState([]);
  const [form, setForm] = useState({
    node_id: "",
    name: "",
    lat: "",
    lng: "",
    description: "",
  });
  const [message, setMessage] = useState("");
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const loadNodes = async () => {
    try {
      const r = await fetch("/nodes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load nodes");
      setNodes(d);
    } catch (e) {
      setMessage(e.message);
    }
  };
  useEffect(() => {
    if (token) loadNodes();
  }, [token]);
  const saveNode = async (e) => {
    e.preventDefault();
    try {
      const existing = nodes.find((n) => n.node_id === form.node_id);
      const r = await fetch(existing ? `/nodes/${existing.id}` : "/nodes", {
        method: existing ? "PUT" : "POST",
        headers: authHeaders,
        body: JSON.stringify({
          node_id: form.node_id,
          name: form.name,
          lat: form.lat === "" ? null : Number(form.lat),
          lng: form.lng === "" ? null : Number(form.lng),
          description: form.description,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to save node");
      setMessage(existing ? `Updated ${d.node_id}` : `Created ${d.node_id}`);
      setForm({ node_id: "", name: "", lat: "", lng: "", description: "" });
      loadNodes();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const deleteNode = async (id) => {
    if (!window.confirm("Delete this node?")) return;
    try {
      const r = await fetch(`/nodes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Failed to delete node");
      }
      setMessage("Node deleted");
      loadNodes();
    } catch (e) {
      setMessage(e.message);
    }
  };
  return (
    <Card
      title="Node Administration"
      subtitle="Create and manage monitoring points"
      action={
        <span className="text-xs text-slate-400">{nodes.length} nodes</span>
      }
    >
      {message && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {message}
        </div>
      )}
      <form
        onSubmit={saveNode}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <input
          className="input-field"
          placeholder="Node ID"
          value={form.node_id}
          onChange={(e) => setForm({ ...form, node_id: e.target.value })}
          required
        />
        <input
          className="input-field"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="input-field"
          placeholder="Latitude"
          value={form.lat}
          onChange={(e) => setForm({ ...form, lat: e.target.value })}
        />
        <input
          className="input-field"
          placeholder="Longitude"
          value={form.lng}
          onChange={(e) => setForm({ ...form, lng: e.target.value })}
        />
        <button className="primary-btn" type="submit">
          <Icon name="plus" size={16} />
          {nodes.some((n) => n.node_id === form.node_id)
            ? "Update Node"
            : "Save Node"}
        </button>
      </form>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-3">Node ID</th>
              <th>Name</th>
              <th>Coordinates</th>
              <th>Description</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {nodes.map((n) => (
              <tr key={n.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-semibold text-slate-800">
                  {n.node_id}
                </td>
                <td>{n.name || "Unnamed"}</td>
                <td className="text-xs text-slate-500">
                  {n.lat ?? "—"}, {n.lng ?? "—"}
                </td>
                <td className="max-w-xs truncate text-xs text-slate-500">
                  {n.description || "—"}
                </td>
                <td className="text-right">
                  <button
                    onClick={() => deleteNode(n.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Icon name="trash" size={14} />
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
