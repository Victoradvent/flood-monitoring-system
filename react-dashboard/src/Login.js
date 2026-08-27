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
        throw new Error('Login succeeded but no token was returned.');
      }

      const decoded = JSON.parse(
        atob(data.token.split('.')[1])
      );

      localStorage.setItem(
        'jwt',
        data.token
      );

      localStorage.setItem(
        'role',
        decoded.role
      );

      requestPermission();

      onLogin(
        data.token,
        decoded.role
      );
    } catch (err) {
      console.error('Login error:', err);
      alert(err.message || 'Login failed');
    }
  };

  return (
    <div>
      <h3>Flood Monitoring System Login</h3>

      <input
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />

      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <button onClick={submit}>
        Login
      </button>
    </div>
  );
}
