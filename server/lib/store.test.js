import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalOneStore } from './store.js';

async function withStore(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-one-test-'));
  try {
    const store = new LocalOneStore({ dataDir: dir });
    await store.init();
    await fn(store, dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('pairing claims create a trusted session', async () => {
  await withStore(async (store) => {
    const token = store.createPairingToken({ baseUrl: 'http://127.0.0.1:47110' });
    const result = await store.claimPairingToken({
      token: token.token,
      deviceName: 'iPhone',
      platform: 'iPhone',
      userAgent: 'test',
    });

    assert.equal(result.device.name, 'iPhone');
    assert.equal(store.validateSession(result.sessionId).id, result.device.id);
    assert.equal(store.listTrustedDevices().length, 1);
  });
});

test('pairing codes create a trusted session for camera-less devices', async () => {
  await withStore(async (store) => {
    const token = store.createPairingToken({ baseUrl: 'http://127.0.0.1:47110' });
    const result = await store.claimPairingCode({
      code: token.code,
      deviceName: 'Windows PC',
      platform: 'Windows',
      userAgent: 'test',
    });

    assert.equal(result.device.name, 'Windows PC');
    assert.equal(store.validateSession(result.sessionId).id, result.device.id);
    assert.equal(store.listTrustedDevices().length, 1);
  });
});

test('secret text is not persisted to state file', async () => {
  await withStore(async (store, dir) => {
    const transfer = await store.createTextTransfer({
      sender: { id: 'local', name: 'MacBook', platform: 'Mac' },
      title: '.env.local',
      content: 'OPENAI_API_KEY=secret',
      secretMode: true,
    });

    assert.equal(transfer.items[0].kind, 'secret-text');
    assert.equal(transfer.items[0].preview.includes('secret'), false);

    const state = await fs.readFile(path.join(dir, 'state.json'), 'utf8');
    assert.equal(state.includes('OPENAI_API_KEY=secret'), false);
  });
});

test('deleting a text transfer removes its stored text file', async () => {
  await withStore(async (store) => {
    const transfer = await store.createTextTransfer({
      sender: { id: 'local', name: 'MacBook', platform: 'Mac' },
      title: 'note',
      content: 'delete me',
      secretMode: false,
    });
    const itemPath = store.findItem(transfer.id, transfer.items[0].id).item.path;

    await fs.access(itemPath);
    assert.equal(await store.deleteTransfer(transfer.id), true);
    await assert.rejects(() => fs.access(itemPath));
  });
});

test('chunked file transfer verifies size and checksum', async () => {
  await withStore(async (store) => {
    const payload = Buffer.from('hello local one');
    const transfer = await store.createFileTransfer({
      sender: { id: 'local', name: 'MacBook', platform: 'Mac' },
      secretMode: false,
      items: [
        {
          name: 'note.txt',
          mimeType: 'text/plain',
          relativePath: 'note.txt',
          size: payload.length,
          chunkSize: 5,
        },
      ],
    });
    const item = transfer.items[0];

    for (let index = 0; index < item.totalChunks; index += 1) {
      const start = index * item.chunkSize;
      await store.writeChunk({
        transferId: transfer.id,
        itemId: item.id,
        chunkIndex: index,
        start,
        buffer: payload.subarray(start, start + item.chunkSize),
      });
    }

    const complete = await store.finalizeItem({ transferId: transfer.id, itemId: item.id });
    assert.equal(complete.status, 'complete');
    assert.equal(complete.items[0].status, 'complete');
    assert.equal(complete.items[0].checksum.length, 64);
  });
});
