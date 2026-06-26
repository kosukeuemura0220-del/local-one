import type { Transfer, UploadProgress } from '../types';
import { apiBase } from './api';
import { getStoredSession } from './device';

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

type FileWithPath = File & {
  webkitRelativePath?: string;
  localOneRelativePath?: string;
};

function authHeaders(extra?: HeadersInit) {
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

export async function uploadFiles({
  files,
  secretMode,
  onProgress,
  signal,
}: {
  files: File[];
  secretMode: boolean;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}) {
  if (!files.length) throw new Error('ファイルを1つ以上選択してください。');

  const itemPayloads = files.map((file) => ({
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    relativePath: (file as FileWithPath).webkitRelativePath || (file as FileWithPath).localOneRelativePath || file.name,
    size: file.size,
    chunkSize: DEFAULT_CHUNK_SIZE,
  }));

  const initResponse = await fetch(`${apiBase()}/api/transfers/init`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ items: itemPayloads, secretMode }),
    signal,
  });
  if (!initResponse.ok) throw new Error(await readError(initResponse));

  let { transfer } = (await initResponse.json()) as { transfer: Transfer };
  const transferId = transfer.id;
  let sentAcrossBatch = 0;
  const totalAcrossBatch = files.reduce((sum, file) => sum + file.size, 0);

  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const file = files[fileIndex];
    const item = transfer.items[fileIndex];
    if (!item) throw new Error('サーバー側で一致する転送項目を作成できませんでした。');

    const chunkSize = item.chunkSize || DEFAULT_CHUNK_SIZE;
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      const chunkResponse = await fetch(
        `${apiBase()}/api/transfers/${transferId}/items/${item.id}/chunks/${chunkIndex}`,
        {
          method: 'PUT',
          headers: authHeaders({
            'Content-Type': 'application/octet-stream',
            'X-Chunk-Start': String(start),
          }),
          body: chunk,
          signal,
        }
      );
      if (!chunkResponse.ok) throw new Error(await readError(chunkResponse));
      transfer = ((await chunkResponse.json()) as { transfer: Transfer }).transfer;

      sentAcrossBatch += chunk.size;
      onProgress?.({
        transferId,
        fileName: file.name,
        sentBytes: sentAcrossBatch,
        totalBytes: totalAcrossBatch,
        currentFileIndex: fileIndex + 1,
        totalFiles: files.length,
      });
    }

    const finalizeResponse = await fetch(
      `${apiBase()}/api/transfers/${transferId}/items/${item.id}/finalize`,
      {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
        signal,
      }
    );
    if (!finalizeResponse.ok) throw new Error(await readError(finalizeResponse));
    transfer = ((await finalizeResponse.json()) as { transfer: Transfer }).transfer;
  }

  return transfer;
}
