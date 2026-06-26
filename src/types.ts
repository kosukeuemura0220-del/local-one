export type Device = {
  id: string;
  name: string;
  platform: string;
  pairedAt?: string;
  lastSeen?: string;
};

export type Peer = {
  id: string;
  name: string;
  host?: string;
  addresses: string[];
  port: number;
  lastSeen: string;
};

export type TransferItem = {
  id: string;
  kind: 'file' | 'text' | 'secret-text';
  name: string;
  mimeType?: string;
  relativePath?: string;
  size: number;
  status: 'uploading' | 'received' | 'complete' | 'error' | 'expired';
  checksum?: string | null;
  verifiedAt?: string | null;
  chunkSize?: number;
  totalChunks?: number;
  receivedChunks?: number;
  receivedBytes?: number;
  preview?: string;
  expiresAt?: string | null;
  savedTo?: string;
  error?: string;
};

export type Transfer = {
  id: string;
  type: 'files' | 'text' | 'secret';
  title: string;
  sender: Device;
  secretMode: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'uploading' | 'complete' | 'error';
  totalSize: number;
  receivedBytes: number;
  items: TransferItem[];
};

export type Settings = {
  receiveDirectory: string;
  chunkSize: number;
  secretTtlMinutes: number;
  keepCompletedTransfers: boolean;
};

export type StatusResponse = {
  device: Device & {
    dataDir: string;
    receiveDirectory: string;
  };
  trusted: boolean;
  trustedDevice: Device | null;
  lanUrls: string[];
  currentOrigin: string | null;
  settings: Settings | null;
  trustedDevices: Device[];
  peers: Peer[];
  transfers: Transfer[];
  serverTime: string;
  limits: {
    chunkSize: number;
    fileSizeLimit: null;
    note: string;
  };
};

export type PairingToken = {
  token: string;
  code: string;
  expiresAt: string;
  pairingUrl: string;
  qrDataUrl: string;
};

export type UploadProgress = {
  transferId?: string;
  fileName: string;
  sentBytes: number;
  totalBytes: number;
  currentFileIndex: number;
  totalFiles: number;
};

declare global {
  interface Window {
    localOneDesktop?: {
      chooseFolder: () => Promise<string | null>;
    };
  }
}
