// Lightweight WebSocket client wrapper
// Adjust WS_URL to match backend WebSocket endpoint (ws://localhost:3000 by default)
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
export const WS_URL = process.env.REACT_APP_WS_URL || `${protocol}//${window.location.host}/ws`;
let socket = null;
const listeners = new Set();

export function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;
  socket = new WebSocket(WS_URL);

  socket.onopen = () => console.log('WebSocket connected');
  socket.onclose = () => {
    console.log('WebSocket closed, reconnecting in 3s');
    setTimeout(connect, 3000);
  };
  socket.onerror = (e) => console.error('WebSocket error', e);

  socket.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      listeners.forEach((cb) => cb(msg));
    } catch (err) {
      console.error('Invalid WS message', err);
    }
  };
  return socket;
}

export function subscribe(cb) {
  listeners.add(cb);
  connect();
  return () => listeners.delete(cb);
}
