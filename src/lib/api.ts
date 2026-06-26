import type { PairingToken, StatusResponse, Transfer } from '../types';
import { getStoredSession } from './device';

export function apiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured) return configured.replace(/\/$/, '');

  if (import.meta.env.DEV) {
    return `${location.protocol}//${location.hostname}:47110`;
  }

  return '';
}

function headers(extra?: HeadersInit) {
  const session = getStoredSession();
  return {
    ...(session ? { 'X-Local-One-Session': session } : {}),
    ...(extra || {}),
  };
}

async function readError(response: Response) {
  try {
    const payload = await response.json();
    return payload.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: headers(),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body || {}),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function fetchStatus() {
  return apiGet<StatusResponse>('/api/status');
}

export async function startPairing(baseUrl?: string) {
  return apiPost<PairingToken>('/api/pair/start', { baseUrl });
}

export async function claimPairing(payload: {
  token?: string;
  code?: string;
  deviceName: string;
  platform: string;
}) {
  return apiPost<{ device: { id: string; name: string; platform: string }; sessionId: string }>(
    '/api/pair/claim',
    payload
  );
}

export async function createTextTransfer(payload: {
  title: string;
  content: string;
  secretMode: boolean;
}) {
  return apiPost<{ transfer: Transfer }>('/api/transfers/text', payload);
}

export async function saveItem(transferId: string, itemId: string) {
  return apiPost<{ path: string; transfer: Transfer }>(
    `/api/transfers/${transferId}/items/${itemId}/save`
  );
}

export async function deleteTransfer(transferId: string) {
  return apiDelete<{ ok: boolean }>(`/api/transfers/${transferId}`);
}

export async function downloadItem(transferId: string, itemId: string) {
  const response = await fetch(
    `${apiBase()}/api/transfers/${transferId}/items/${itemId}/download`,
    { headers: headers() }
  );
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

export async function updateSettings(payload: {
  deviceName?: string;
  receiveDirectory?: string;
  secretTtlMinutes?: number;
}) {
  return apiPost('/api/settings', payload);
}

export function eventUrl() {
  const base = apiBase() || location.origin;
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/events';
  const session = getStoredSession();
  if (session) url.searchParams.set('session', session);
  return url.toString();
}
