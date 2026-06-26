import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function pairingCode() {
  return String(crypto.randomInt(100000, 999999));
}

export function sha256Text(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(filePath, 'r');
  try {
    const stream = handle.createReadStream();
    for await (const chunk of stream) {
      hash.update(chunk);
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

export function maskSecret(value = '') {
  const length = [...value].length;
  if (length === 0) return '';
  if (length <= 8) return '••••••••';
  return `${value.slice(0, 3)}••••••••${value.slice(-2)}`;
}

export function safeFileName(input = 'item') {
  const normalized = input.normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  const trimmed = normalized.trim().replace(/\s+/g, ' ');
  return trimmed.slice(0, 180) || 'item';
}

export function safeRelativePath(input = '') {
  return input
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map(safeFileName)
    .join(path.sep);
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function uniquePath(targetPath) {
  const parsed = path.parse(targetPath);
  let candidate = targetPath;
  let index = 1;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
      index += 1;
    } catch {
      return candidate;
    }
  }
}
