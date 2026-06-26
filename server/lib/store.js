import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import {
  ensureDir,
  maskSecret,
  pairingCode,
  randomToken,
  safeFileName,
  safeRelativePath,
  sha256File,
  sha256Text,
  uniquePath,
} from './security.js';
import { getDeviceName, getPlatformLabel } from './network.js';

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const SECRET_TTL_MS = 1000 * 60 * 15;

function now() {
  return new Date().toISOString();
}

function publicItem(item) {
  const receivedChunks = Array.isArray(item.receivedChunks) ? item.receivedChunks.length : 0;
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    mimeType: item.mimeType,
    relativePath: item.relativePath,
    size: item.size,
    status: item.status,
    checksum: item.checksum,
    verifiedAt: item.verifiedAt,
    chunkSize: item.chunkSize,
    totalChunks: item.totalChunks,
    receivedChunks,
    receivedBytes: item.receivedBytes || 0,
    preview: item.preview,
    expiresAt: item.expiresAt,
    savedTo: item.savedTo,
    error: item.error,
  };
}

function publicTransfer(transfer) {
  const totalSize = transfer.items.reduce((sum, item) => sum + (item.size || 0), 0);
  const receivedBytes = transfer.items.reduce((sum, item) => sum + (item.receivedBytes || item.size || 0), 0);
  return {
    id: transfer.id,
    type: transfer.type,
    title: transfer.title,
    sender: transfer.sender,
    secretMode: transfer.secretMode,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    status: transfer.status,
    totalSize,
    receivedBytes,
    items: transfer.items.map(publicItem),
  };
}

export class LocalOneStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, 'state.json');
    this.transfersDir = path.join(dataDir, 'transfers');
    this.textDir = path.join(dataDir, 'texts');
    this.inboxDir = process.env.LOCAL_ONE_INBOX_DIR || path.join(dataDir, 'inbox');
    this.pairingTokens = new Map();
    this.secretContents = new Map();
    this.state = null;
  }

  async init() {
    await ensureDir(this.dataDir);
    await ensureDir(this.transfersDir);
    await ensureDir(this.textDir);
    await ensureDir(this.inboxDir);

    try {
      const raw = await fs.readFile(this.statePath, 'utf8');
      this.state = JSON.parse(raw);
    } catch {
      this.state = {
        deviceId: nanoid(16),
        deviceName: getDeviceName(),
        platform: getPlatformLabel(),
        createdAt: now(),
        settings: {
          receiveDirectory: this.inboxDir,
          chunkSize: DEFAULT_CHUNK_SIZE,
          secretTtlMinutes: 15,
          keepCompletedTransfers: true,
        },
        trustedDevices: [],
        transfers: [],
      };
      await this.save();
    }

    this.inboxDir = this.state.settings.receiveDirectory || this.inboxDir;
    await ensureDir(this.inboxDir);
  }

  async save() {
    const serializable = {
      ...this.state,
      transfers: this.state.transfers.map((transfer) => ({
        ...transfer,
        items: transfer.items.map((item) => {
          if (item.kind === 'secret-text') {
            return { ...item, content: undefined };
          }
          return item;
        }),
      })),
    };
    await fs.writeFile(this.statePath, JSON.stringify(serializable, null, 2));
  }

  getDevice() {
    return {
      id: this.state.deviceId,
      name: this.state.deviceName,
      platform: this.state.platform,
      dataDir: this.dataDir,
      receiveDirectory: this.state.settings.receiveDirectory,
    };
  }

  getSettings() {
    return { ...this.state.settings };
  }

  async updateSettings(patch) {
    if (typeof patch.deviceName === 'string' && patch.deviceName.trim()) {
      this.state.deviceName = patch.deviceName.trim().slice(0, 80);
    }
    if (typeof patch.receiveDirectory === 'string' && patch.receiveDirectory.trim()) {
      this.state.settings.receiveDirectory = path.resolve(patch.receiveDirectory.trim());
      this.inboxDir = this.state.settings.receiveDirectory;
      await ensureDir(this.inboxDir);
    }
    if (Number.isFinite(patch.secretTtlMinutes)) {
      this.state.settings.secretTtlMinutes = Math.max(1, Math.min(1440, Number(patch.secretTtlMinutes)));
    }
    await this.save();
    return this.getSettings();
  }

  createPairingToken({ baseUrl }) {
    this.cleanupExpiredPairingTokens();
    const token = randomToken(18);
    let code = pairingCode();
    while ([...this.pairingTokens.values()].some((entry) => entry.code === code)) {
      code = pairingCode();
    }
    const expiresAt = new Date(Date.now() + 1000 * 60 * 5).toISOString();
    const pairingUrl = `${baseUrl}/?pairToken=${encodeURIComponent(token)}`;
    const entry = { token, code, expiresAt, pairingUrl, claimedBy: null };
    this.pairingTokens.set(token, entry);
    return entry;
  }

  cleanupExpiredPairingTokens() {
    const nowMs = Date.now();
    for (const [token, entry] of this.pairingTokens) {
      if (new Date(entry.expiresAt).getTime() < nowMs) {
        this.pairingTokens.delete(token);
      }
    }
  }

  async claimPairingEntry(entry, { deviceName, platform, userAgent }) {
    if (!entry) {
      const error = new Error('ペアリングトークンが無効、または期限切れです。');
      error.statusCode = 404;
      throw error;
    }

    const deviceId = nanoid(16);
    const sessionId = randomToken(32);
    const device = {
      id: deviceId,
      name: String(deviceName || 'モバイル端末').trim().slice(0, 80),
      platform: String(platform || 'ブラウザ').trim().slice(0, 40),
      userAgent: String(userAgent || '').slice(0, 180),
      sessionHash: sha256Text(sessionId),
      pairedAt: now(),
      lastSeen: now(),
    };

    this.state.trustedDevices.push(device);
    entry.claimedBy = device.id;
    this.pairingTokens.delete(entry.token);
    await this.save();

    return { device, sessionId };
  }

  async claimPairingToken({ token, deviceName, platform, userAgent }) {
    this.cleanupExpiredPairingTokens();
    return this.claimPairingEntry(this.pairingTokens.get(token), {
      deviceName,
      platform,
      userAgent,
    });
  }

  async claimPairingCode({ code, deviceName, platform, userAgent }) {
    this.cleanupExpiredPairingTokens();
    const normalizedCode = String(code || '').replace(/\D/g, '').slice(0, 6);
    const entry = [...this.pairingTokens.values()].find((candidate) => candidate.code === normalizedCode);
    if (!entry) {
      const error = new Error('ペアリングコードが無効、または期限切れです。');
      error.statusCode = 404;
      throw error;
    }

    return this.claimPairingEntry(entry, {
      deviceName,
      platform,
      userAgent,
    });
  }

  validateSession(sessionId) {
    if (!sessionId) return null;
    const hash = sha256Text(sessionId);
    const device = this.state.trustedDevices.find((trusted) => trusted.sessionHash === hash);
    if (!device) return null;
    device.lastSeen = now();
    return device;
  }

  async revokeDevice(deviceId) {
    this.state.trustedDevices = this.state.trustedDevices.filter((device) => device.id !== deviceId);
    await this.save();
  }

  listTrustedDevices() {
    return this.state.trustedDevices.map(({ sessionHash, ...device }) => device);
  }

  async createFileTransfer({ sender, secretMode, items }) {
    const transferId = nanoid(14);
    const transferDir = path.join(this.transfersDir, transferId);
    await ensureDir(transferDir);

    const transfer = {
      id: transferId,
      type: 'files',
      title: items.length === 1 ? items[0].name : `${items.length}件の項目`,
      sender,
      secretMode: Boolean(secretMode),
      createdAt: now(),
      updatedAt: now(),
      status: 'uploading',
      items: items.map((item) => {
        const itemId = nanoid(12);
        const chunkSize = Number(item.chunkSize) || DEFAULT_CHUNK_SIZE;
        const totalChunks = Math.max(1, Math.ceil(Number(item.size || 0) / chunkSize));
        const relativePath = safeRelativePath(item.relativePath || item.name);
        const fileName = safeFileName(path.basename(relativePath || item.name || itemId));
        return {
          id: itemId,
          kind: 'file',
          name: fileName,
          mimeType: item.mimeType || 'application/octet-stream',
          relativePath,
          size: Number(item.size || 0),
          path: path.join(transferDir, `${itemId}-${fileName}`),
          status: 'uploading',
          chunkSize,
          totalChunks,
          receivedChunks: [],
          receivedBytes: 0,
          checksum: null,
          verifiedAt: null,
        };
      }),
    };

    this.state.transfers.unshift(transfer);
    await this.save();
    return publicTransfer(transfer);
  }

  async createTextTransfer({ sender, title, content, secretMode }) {
    const transferId = nanoid(14);
    const itemId = nanoid(12);
    const createdAt = now();
    const expiresAt = secretMode
      ? new Date(Date.now() + 1000 * 60 * this.state.settings.secretTtlMinutes).toISOString()
      : null;

    let item;
    if (secretMode) {
      this.secretContents.set(itemId, {
        content,
        expiresAt,
      });
      item = {
        id: itemId,
        kind: 'secret-text',
        name: title || '秘密テキスト',
        mimeType: 'text/plain',
        size: Buffer.byteLength(content, 'utf8'),
        status: 'complete',
        preview: maskSecret(content),
        expiresAt,
        receivedBytes: Buffer.byteLength(content, 'utf8'),
        checksum: sha256Text(content),
        verifiedAt: createdAt,
      };
    } else {
      const fileName = `${itemId}-${safeFileName(title || 'text')}.txt`;
      const textPath = path.join(this.textDir, fileName);
      await fs.writeFile(textPath, content, 'utf8');
      item = {
        id: itemId,
        kind: 'text',
        name: title || 'テキストメモ',
        mimeType: 'text/plain',
        size: Buffer.byteLength(content, 'utf8'),
        path: textPath,
        status: 'complete',
        preview: content.slice(0, 160),
        receivedBytes: Buffer.byteLength(content, 'utf8'),
        checksum: sha256Text(content),
        verifiedAt: createdAt,
      };
    }

    const transfer = {
      id: transferId,
      type: secretMode ? 'secret' : 'text',
      title: title || (secretMode ? '秘密テキスト' : 'テキストメモ'),
      sender,
      secretMode: Boolean(secretMode),
      createdAt,
      updatedAt: createdAt,
      status: 'complete',
      items: [item],
    };

    this.state.transfers.unshift(transfer);
    await this.save();
    return publicTransfer(transfer);
  }

  findTransfer(transferId) {
    return this.state.transfers.find((transfer) => transfer.id === transferId);
  }

  findItem(transferId, itemId) {
    const transfer = this.findTransfer(transferId);
    const item = transfer?.items.find((candidate) => candidate.id === itemId);
    return { transfer, item };
  }

  async writeChunk({ transferId, itemId, chunkIndex, start, buffer }) {
    const { transfer, item } = this.findItem(transferId, itemId);
    if (!transfer || !item || item.kind !== 'file') {
      const error = new Error('転送項目が見つかりません。');
      error.statusCode = 404;
      throw error;
    }

    const index = Number(chunkIndex);
    if (!Number.isInteger(index) || index < 0 || index >= item.totalChunks) {
      const error = new Error('チャンク番号が不正です。');
      error.statusCode = 400;
      throw error;
    }

    const expectedStart = index * item.chunkSize;
    if (Number(start) !== expectedStart) {
      const error = new Error('チャンクの開始位置が転送メタデータと一致しません。');
      error.statusCode = 409;
      throw error;
    }

    await ensureDir(path.dirname(item.path));
    const handle = await fs.open(item.path, 'a+');
    try {
      await handle.write(buffer, 0, buffer.length, expectedStart);
    } finally {
      await handle.close();
    }

    if (!item.receivedChunks.includes(index)) {
      item.receivedChunks.push(index);
      item.receivedChunks.sort((a, b) => a - b);
      const lastChunkSize = item.size % item.chunkSize || item.chunkSize;
      item.receivedBytes = item.receivedChunks.reduce((sum, chunk) => {
        return sum + (chunk === item.totalChunks - 1 ? lastChunkSize : item.chunkSize);
      }, 0);
    }

    item.status = item.receivedChunks.length === item.totalChunks ? 'received' : 'uploading';
    transfer.updatedAt = now();
    await this.save();
    return publicTransfer(transfer);
  }

  async finalizeItem({ transferId, itemId }) {
    const { transfer, item } = this.findItem(transferId, itemId);
    if (!transfer || !item || item.kind !== 'file') {
      const error = new Error('転送項目が見つかりません。');
      error.statusCode = 404;
      throw error;
    }

    if (item.receivedChunks.length !== item.totalChunks) {
      const error = new Error('アップロードに不足しているチャンクがあります。');
      error.statusCode = 409;
      throw error;
    }

    const stat = await fs.stat(item.path);
    if (stat.size !== item.size) {
      item.status = 'error';
      item.error = `サイズが一致しません。期待値: ${item.size}、実際: ${stat.size}。`;
      await this.save();
      const error = new Error(item.error);
      error.statusCode = 409;
      throw error;
    }

    item.checksum = await sha256File(item.path);
    item.verifiedAt = now();
    item.status = 'complete';
    item.receivedBytes = item.size;

    const allDone = transfer.items.every((candidate) => candidate.status === 'complete');
    transfer.status = allDone ? 'complete' : 'uploading';
    transfer.updatedAt = now();
    await this.save();
    return publicTransfer(transfer);
  }

  async getItemContent({ transferId, itemId }) {
    const { item } = this.findItem(transferId, itemId);
    if (!item) {
      const error = new Error('転送項目が見つかりません。');
      error.statusCode = 404;
      throw error;
    }

    if (item.kind === 'secret-text') {
      const secret = this.secretContents.get(item.id);
      if (!secret || new Date(secret.expiresAt).getTime() < Date.now()) {
        const error = new Error('秘密情報の期限が切れています。');
        error.statusCode = 410;
        throw error;
      }
      return {
        type: 'text',
        content: secret.content,
        name: item.name,
        mimeType: 'text/plain',
      };
    }

    if (item.kind === 'text') {
      return {
        type: 'text',
        content: await fs.readFile(item.path, 'utf8'),
        name: item.name,
        mimeType: 'text/plain',
      };
    }

    return {
      type: 'file',
      path: item.path,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
    };
  }

  async saveItemToInbox({ transferId, itemId }) {
    const { transfer, item } = this.findItem(transferId, itemId);
    if (!transfer || !item) {
      const error = new Error('転送項目が見つかりません。');
      error.statusCode = 404;
      throw error;
    }

    const relativePath = item.relativePath ? safeRelativePath(item.relativePath) : safeFileName(item.name);
    const destination = await uniquePath(path.join(this.inboxDir, relativePath));
    await ensureDir(path.dirname(destination));

    if (item.kind === 'file') {
      await fs.copyFile(item.path, destination);
    } else {
      const content = await this.getItemContent({ transferId, itemId });
      const textDestination = destination.endsWith('.txt') ? destination : `${destination}.txt`;
      await fs.writeFile(textDestination, content.content, 'utf8');
      item.savedTo = textDestination;
      transfer.updatedAt = now();
      await this.save();
      return { path: textDestination, transfer: publicTransfer(transfer) };
    }

    item.savedTo = destination;
    transfer.updatedAt = now();
    await this.save();
    return { path: destination, transfer: publicTransfer(transfer) };
  }

  async deleteTransfer(transferId) {
    const transfer = this.findTransfer(transferId);
    if (!transfer) return false;
    this.state.transfers = this.state.transfers.filter((candidate) => candidate.id !== transferId);
    for (const item of transfer.items) {
      if (item.kind === 'secret-text') {
        this.secretContents.delete(item.id);
      }
      if ((item.kind === 'text' || item.kind === 'file') && item.path) {
        await fs.rm(item.path, { force: true });
      }
    }
    await fs.rm(path.join(this.transfersDir, transferId), { recursive: true, force: true });
    await this.save();
    return true;
  }

  listTransfers() {
    this.cleanupExpiredSecrets();
    return this.state.transfers.map(publicTransfer);
  }

  cleanupExpiredSecrets() {
    const nowMs = Date.now();
    for (const [itemId, entry] of this.secretContents) {
      if (new Date(entry.expiresAt).getTime() < nowMs) {
        this.secretContents.delete(itemId);
      }
    }
    for (const transfer of this.state.transfers) {
      for (const item of transfer.items) {
        if (item.kind === 'secret-text' && item.expiresAt && new Date(item.expiresAt).getTime() < nowMs) {
          item.status = 'expired';
        }
      }
    }
  }
}
