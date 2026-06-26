import { Bonjour } from 'bonjour-service';

export function startDiscovery({ deviceId, deviceName, port }) {
  const peers = new Map();
  let bonjour;
  let browser;
  let service;

  try {
    bonjour = new Bonjour();
    service = bonjour.publish({
      name: deviceName,
      type: 'localone',
      port,
      txt: {
        deviceId,
        product: 'Local ONE',
      },
    });

    browser = bonjour.find({ type: 'localone' }, (entry) => {
      const peerId = entry.txt?.deviceId;
      if (!peerId || peerId === deviceId) return;

      peers.set(peerId, {
        id: peerId,
        name: entry.name || 'Local ONE Device',
        host: entry.host,
        addresses: entry.addresses || [],
        port: entry.port,
        lastSeen: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.warn('[discovery] mDNS disabled:', error.message);
  }

  return {
    getPeers() {
      const cutoff = Date.now() - 1000 * 60 * 3;
      return [...peers.values()].filter((peer) => new Date(peer.lastSeen).getTime() > cutoff);
    },
    close() {
      try {
        browser?.stop();
        service?.stop();
        bonjour?.destroy();
      } catch {
        // Best effort shutdown.
      }
    },
  };
}
