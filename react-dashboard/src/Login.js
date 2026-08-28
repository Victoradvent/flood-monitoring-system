import React, { useState } from 'react';
import { requestPermission } from './notifications';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = async e => {
    e.preventDefault();

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          data.message ||
          `Login failed (${res.status})`
        );
      }

      if (!data.token) {
        throw new Error(
          'Login succeeded but no token was returned.'
        );
      }

      const decoded = JSON.parse(
        atob(data.token.split('.')[1])
      );

      localStorage.setItem('jwt', data.token);
      localStorage.setItem('role', decoded.role);

      requestPermission();

      onLogin(data.token, decoded.role);
    } catch (err) {
      console.error('Login error:', err);
      alert(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500 text-2xl font-bold text-slate-950 shadow-lg shadow-cyan-500/20">
            FM
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Flood Monitoring System
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Sign in to access the hazard dashboard
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Username
              </label>

              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Sign in
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600">
          Flood & Grid Hazard Monitoring Platform
        </p>
      </div>
    </div>
  );
}
