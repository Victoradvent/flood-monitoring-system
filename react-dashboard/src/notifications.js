export function requestPermission() {
  if ("Notification" in window) {
    Notification.requestPermission().then((perm) => {
      console.log("Notification permission:", perm);
    });
  }
}

export function showNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    const n = new Notification(title, { body });
    n.onclick = () => window.focus();
  }
}

export function playAlertSound() {
  const audio = new Audio("/alert-tone.mp3");
  audio.play().catch((err) => console.error("Audio play error", err));
}
