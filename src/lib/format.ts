export function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function itemProgress(receivedBytes = 0, size = 0) {
  if (size <= 0) return 100;
  return clampPercent((receivedBytes / size) * 100);
}

export function transferProgress(receivedBytes = 0, totalSize = 0) {
  if (totalSize <= 0) return 100;
  return clampPercent((receivedBytes / totalSize) * 100);
}

export function shortenChecksum(value?: string | null) {
  if (!value) return '';
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
