import os from 'node:os';

export function getDeviceName() {
  return process.env.LOCAL_ONE_DEVICE_NAME || os.hostname() || 'Local ONE端末';
}

export function getPlatformLabel(platform = process.platform) {
  if (platform === 'darwin') return 'Mac';
  if (platform === 'win32') return 'Windows';
  if (platform === 'linux') return 'Linux';
  return platform;
}

export function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

export function getLanUrls(port) {
  return getLanAddresses().map((address) => `http://${address}:${port}`);
}

export function normalizeRemoteAddress(address = '') {
  return address.replace(/^::ffff:/, '');
}

export function isLoopbackAddress(address = '') {
  const normalized = normalizeRemoteAddress(address);
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}

export function isLoopbackRequest(req) {
  return isLoopbackAddress(req.socket?.remoteAddress || req.ip);
}

export function requestOrigin(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers.host;
  return host ? `${protocol}://${host}` : null;
}
