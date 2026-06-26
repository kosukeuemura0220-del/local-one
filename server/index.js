import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';
import { LocalOneStore } from './lib/store.js';
import {
  getDeviceName,
  getLanUrls,
  isLoopbackAddress,
  isLoopbackRequest,
  requestOrigin,
} from './lib/network.js';
import { startDiscovery } from './lib/discovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function resolveDataDir() {
  return (
    process.env.LOCAL_ONE_DATA_DIR ||
    path.join(projectRoot, 'data')
  );
}

function senderFromRequest(req, store) {
  const trusted = req.trustedDevice;
  if (trusted) {
    return {
      id: trusted.id,
      name: trusted.name,
      platform: trusted.platform,
    };
  }
  return {
    id: store.state.deviceId,
    name: store.state.deviceName,
    platform: store.state.platform,
  };
}

function errorResponse(res, error) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    console.error(error);
  }
  res.status(status).json({
    error: error.message || '予期しないサーバーエラーが発生しました。',
  });
}

function authMiddleware(store) {
  return (req, res, next) => {
    if (isLoopbackRequest(req)) {
      req.trustedDevice = null;
      return next();
    }

    const session = req.headers['x-local-one-session'] || req.query.session;
    const trusted = store.validateSession(Array.isArray(session) ? session[0] : session);
    if (!trusted) {
      return res.status(401).json({
        error: 'このデバイスはまだLocal ONEとペアリングされていません。',
      });
    }

    req.trustedDevice = trusted;
    return next();
  };
}

function websocketAuth(store, req) {
  const remote = req.socket?.remoteAddress || '';
  if (isLoopbackAddress(remote)) return true;

  const url = new URL(req.url, 'http://local-one');
  const session = url.searchParams.get('session');
  return Boolean(store.validateSession(session));
}

export async function startLocalOneServer({
  port = Number(process.env.LOCAL_ONE_PORT || 47110),
  host = '0.0.0.0',
  staticDir = path.join(projectRoot, 'dist'),
  openBrowser = false,
} = {}) {
  const store = new LocalOneStore({ dataDir: resolveDataDir() });
  await store.init();

  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/events' });
  const clients = new Set();
  const discovery = startDiscovery({
    deviceId: store.state.deviceId,
    deviceName: store.state.deviceName || getDeviceName(),
    port,
  });

  const broadcast = (event, payload = {}) => {
    const body = JSON.stringify({ event, payload, sentAt: new Date().toISOString() });
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(body);
      }
    }
  };

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'false');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Local-One-Session, X-Chunk-Start'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '4mb' }));

  wss.on('connection', (socket, req) => {
    if (!websocketAuth(store, req)) {
      socket.close(1008, 'ペアリングが必要です');
      return;
    }
    clients.add(socket);
    socket.send(JSON.stringify({ event: 'hello', payload: { device: store.getDevice() } }));
    socket.on('close', () => clients.delete(socket));
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, product: 'Local ONE' });
  });

  app.get('/api/status', (req, res) => {
    const session = req.headers['x-local-one-session'] || req.query.session;
    const trustedDevice = isLoopbackRequest(req)
      ? null
      : store.validateSession(Array.isArray(session) ? session[0] : session);
    const trusted = isLoopbackRequest(req) || Boolean(trustedDevice);
    res.json({
      device: store.getDevice(),
      trusted,
      trustedDevice: trustedDevice
        ? { id: trustedDevice.id, name: trustedDevice.name, platform: trustedDevice.platform }
        : null,
      lanUrls: getLanUrls(port),
      currentOrigin: requestOrigin(req),
      settings: trusted ? store.getSettings() : null,
      trustedDevices: trusted ? store.listTrustedDevices() : [],
      peers: trusted ? discovery.getPeers() : [],
      transfers: trusted ? store.listTransfers() : [],
      serverTime: new Date().toISOString(),
      limits: {
        chunkSize: store.getSettings().chunkSize,
        fileSizeLimit: null,
        note: 'Local ONE側ではファイルサイズ上限を設けません。実際の上限は空き容量、ブラウザ、端末の制約に依存します。',
      },
    });
  });

  app.post('/api/pair/claim', async (req, res) => {
    try {
      const claimPayload = {
        deviceName: req.body.deviceName,
        platform: req.body.platform,
        userAgent: req.headers['user-agent'],
      };
      const result = req.body.code
        ? await store.claimPairingCode({
            code: req.body.code,
            ...claimPayload,
          })
        : await store.claimPairingToken({
            token: req.body.token,
            ...claimPayload,
          });
      broadcast('pairing:claimed', { device: result.device });
      res.json({
        device: {
          id: result.device.id,
          name: result.device.name,
          platform: result.device.platform,
        },
        sessionId: result.sessionId,
        hostDevice: store.getDevice(),
      });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  const requireTrusted = authMiddleware(store);

  app.post('/api/pair/start', requireTrusted, async (req, res) => {
    try {
      const baseUrl = req.body.baseUrl || getLanUrls(port)[0] || requestOrigin(req) || `http://127.0.0.1:${port}`;
      const token = store.createPairingToken({ baseUrl });
      const qrDataUrl = await QRCode.toDataURL(token.pairingUrl, {
        margin: 1,
        width: 320,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      res.json({ ...token, qrDataUrl });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  app.post('/api/pair/revoke', requireTrusted, async (req, res) => {
    try {
      await store.revokeDevice(req.body.deviceId);
      broadcast('device:revoked', { deviceId: req.body.deviceId });
      res.json({ ok: true, trustedDevices: store.listTrustedDevices() });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  app.post('/api/settings', requireTrusted, async (req, res) => {
    try {
      const settings = await store.updateSettings(req.body || {});
      broadcast('settings:update', { settings });
      res.json({ settings });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  app.get('/api/discovery', requireTrusted, (_req, res) => {
    res.json({ peers: discovery.getPeers() });
  });

  app.get('/api/transfers', requireTrusted, (_req, res) => {
    res.json({ transfers: store.listTransfers() });
  });

  app.post('/api/transfers/init', requireTrusted, async (req, res) => {
    try {
      const transfer = await store.createFileTransfer({
        sender: senderFromRequest(req, store),
        secretMode: req.body.secretMode,
        items: Array.isArray(req.body.items) ? req.body.items : [],
      });
      broadcast('transfer:update', { transfer });
      res.json({ transfer });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  app.post('/api/transfers/text', requireTrusted, async (req, res) => {
    try {
      const content = String(req.body.content || '');
      if (!content.trim()) {
        return res.status(400).json({ error: '内容を入力してください。' });
      }
      const transfer = await store.createTextTransfer({
        sender: senderFromRequest(req, store),
        title: req.body.title,
        content,
        secretMode: req.body.secretMode,
      });
      broadcast('transfer:update', { transfer });
      res.json({ transfer });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  app.put(
    '/api/transfers/:transferId/items/:itemId/chunks/:chunkIndex',
    requireTrusted,
    express.raw({ type: 'application/octet-stream', limit: '16mb' }),
    async (req, res) => {
      try {
        const transfer = await store.writeChunk({
          transferId: req.params.transferId,
          itemId: req.params.itemId,
          chunkIndex: req.params.chunkIndex,
          start: Number(req.headers['x-chunk-start']),
          buffer: req.body,
        });
        broadcast('transfer:update', { transfer });
        res.json({ transfer });
      } catch (error) {
        errorResponse(res, error);
      }
    }
  );

  app.post('/api/transfers/:transferId/items/:itemId/finalize', requireTrusted, async (req, res) => {
    try {
      const transfer = await store.finalizeItem({
        transferId: req.params.transferId,
        itemId: req.params.itemId,
      });
      broadcast('transfer:update', { transfer });
      res.json({ transfer });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  app.get('/api/transfers/:transferId/items/:itemId/download', requireTrusted, async (req, res) => {
    try {
      const content = await store.getItemContent({
        transferId: req.params.transferId,
        itemId: req.params.itemId,
      });

      res.setHeader('Content-Type', content.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(content.name)}"`);

      if (content.type === 'text') {
        res.send(content.content);
        return;
      }

      res.setHeader('Content-Length', content.size);
      fs.createReadStream(content.path).pipe(res);
    } catch (error) {
      errorResponse(res, error);
    }
  });

  app.post('/api/transfers/:transferId/items/:itemId/save', requireTrusted, async (req, res) => {
    try {
      const result = await store.saveItemToInbox({
        transferId: req.params.transferId,
        itemId: req.params.itemId,
      });
      broadcast('transfer:update', { transfer: result.transfer });
      res.json(result);
    } catch (error) {
      errorResponse(res, error);
    }
  });

  app.delete('/api/transfers/:transferId', requireTrusted, async (req, res) => {
    try {
      const deleted = await store.deleteTransfer(req.params.transferId);
      broadcast('transfer:delete', { transferId: req.params.transferId });
      res.json({ ok: deleted });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text').send('Local ONEサーバーは起動中です。Web UIは npm run dev:web で起動するか、アプリをビルドしてください。');
    });
  }

  await new Promise((resolve) => {
    server.listen(port, host, resolve);
  });

  const localUrl = `http://127.0.0.1:${port}`;
  const lanUrls = getLanUrls(port);
  console.log(`Local ONEサーバー起動中: ${localUrl}`);
  for (const url of lanUrls) {
    console.log(`LAN URL: ${url}`);
  }
  console.log(`データ保存先: ${store.dataDir}`);

  if (openBrowser) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    import('node:child_process').then(({ exec }) => exec(`${opener} ${localUrl}`));
  }

  return {
    port,
    app,
    server,
    store,
    close: async () => {
      discovery.close();
      wss.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDev = process.argv.includes('--dev');
  startLocalOneServer({
    port: Number(process.env.LOCAL_ONE_PORT || 47110),
    staticDir: isDev ? null : path.join(projectRoot, 'dist'),
    openBrowser: false,
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
