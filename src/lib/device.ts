export function detectClientPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'ブラウザ';
}

export function defaultDeviceName() {
  const platform = detectClientPlatform();
  return `${platform} ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function getStoredSession() {
  return localStorage.getItem('local-one-session') || '';
}

export function setStoredSession(sessionId: string) {
  localStorage.setItem('local-one-session', sessionId);
}

export function getStoredDeviceName() {
  return localStorage.getItem('local-one-device-name') || defaultDeviceName();
}

export function setStoredDeviceName(name: string) {
  localStorage.setItem('local-one-device-name', name);
}
