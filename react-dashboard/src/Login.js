import React, { useState } from 'react';
import { requestPermission } from './notifications';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      const { token } = await res.json();
      const decoded = JSON.parse(atob(token.split('.')[1]));
      localStorage.setItem('jwt', token);
      localStorage.setItem('role', decoded.role);
      requestPermission();
      onLogin(token, decoded.role);
    } else {
      alert('Login failed');
    }
  };

  return (
    <div>
      <h3>Admin Login</h3>
      <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={submit}>Login</button>
    </div>
  );
}
