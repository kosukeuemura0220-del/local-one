import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  Download,
  File,
  FileImage,
  FileKey2,
  FileVideo,
  FolderDown,
  MoreHorizontal,
  RotateCcw,
  Shield,
  Trash2,
} from 'lucide-react';
import { deleteTransfer, downloadItem, saveItem } from '../lib/api';
import {
  formatBytes,
  formatDateTime,
  itemProgress,
  shortenChecksum,
  transferProgress,
} from '../lib/format';
import type { Transfer, TransferItem } from '../types';

type Toast = {
  tone: 'success' | 'error' | 'info';
  message: string;
};

type Props = {
  transfers: Transfer[];
  onChanged: () => void;
  onToast: (toast: Toast) => void;
};

function iconForItem(item: TransferItem) {
  if (item.kind === 'secret-text') return <FileKey2 size={18} />;
  if (item.mimeType?.startsWith('image/')) return <FileImage size={18} />;
  if (item.mimeType?.startsWith('video/')) return <FileVideo size={18} />;
  return <File size={18} />;
}

function statusText(item: TransferItem) {
  if (item.status === 'complete') return item.verifiedAt ? '検証済み' : '完了';
  if (item.status === 'received') return '検証待ち';
  if (item.status === 'expired') return '期限切れ';
  if (item.status === 'error') return item.error || 'エラー';
  return 'アップロード中';
}

function transferStatusText(status: Transfer['status']) {
  if (status === 'complete') return '検証済み';
  if (status === 'error') return 'エラー';
  return '転送中';
}

export function TransferQueue({ transfers, onChanged, onToast }: Props) {
  const [busyId, setBusyId] = useState('');
  const activeTransfers = useMemo(() => transfers, [transfers]);

  async function copyItem(transfer: Transfer, item: TransferItem) {
    setBusyId(item.id);
    try {
      const response = await downloadItem(transfer.id, item.id);
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      onToast({ tone: 'success', message: 'コピーしました。' });
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : 'コピーに失敗しました。' });
    } finally {
      setBusyId('');
    }
  }

  async function download(transfer: Transfer, item: TransferItem) {
    setBusyId(item.id);
    try {
      const response = await downloadItem(transfer.id, item.id);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onToast({ tone: 'success', message: 'ダウンロードを開始しました。' });
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : 'ダウンロードに失敗しました。' });
    } finally {
      setBusyId('');
    }
  }

  async function save(transfer: Transfer, item: TransferItem) {
    setBusyId(item.id);
    try {
      const result = await saveItem(transfer.id, item.id);
      await onChanged();
      onToast({ tone: 'success', message: `${result.path} に保存しました。` });
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : '保存に失敗しました。' });
    } finally {
      setBusyId('');
    }
  }

  async function remove(transfer: Transfer) {
    setBusyId(transfer.id);
    try {
      await deleteTransfer(transfer.id);
      await onChanged();
      onToast({ tone: 'success', message: '転送を削除しました。' });
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : '削除に失敗しました。' });
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="queue-panel">
      <div className="queue-header">
        <div>
          <h2>転送キュー</h2>
          <p>このハブの転送: {transfers.length}件</p>
        </div>
        <div className="queue-summary">
          <span>
            <CheckCircle2 size={15} />
            検証済み {transfers.filter((transfer) => transfer.status === 'complete').length}件
          </span>
          <span>
            <RotateCcw size={15} />
            再開用チャンクあり
          </span>
        </div>
      </div>

      {activeTransfers.length ? (
        <div className="transfer-list">
          {activeTransfers.map((transfer) => (
            <article className="transfer-row" key={transfer.id}>
              <div className="transfer-main">
                <div className="transfer-title-row">
                  <div>
                    <h3>{transfer.title}</h3>
                    <p>
                      {transfer.sender.name} · {formatDateTime(transfer.createdAt)}
                    </p>
                  </div>
                  <div className="transfer-badges">
                    {transfer.secretMode ? (
                      <span className="badge secret">
                        <Shield size={13} />
                        秘密
                      </span>
                    ) : null}
                    <span className={`badge ${transfer.status}`}>
                      {transferStatusText(transfer.status)}
                    </span>
                  </div>
                </div>
                <span className="progress-track">
                  <span
                    style={{
                      width: `${transferProgress(transfer.receivedBytes, transfer.totalSize)}%`,
                    }}
                  />
                </span>
                <div className="transfer-meta">
                  <span>{formatBytes(transfer.receivedBytes)} / {formatBytes(transfer.totalSize)}</span>
                  <button
                    className="icon-button subtle"
                    type="button"
                    onClick={() => remove(transfer)}
                    aria-label="転送を削除"
                    disabled={busyId === transfer.id}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="item-list">
                {transfer.items.map((item) => {
                  const canCopy = item.kind === 'text' || item.kind === 'secret-text';
                  const canUse = item.status === 'complete';
                  return (
                    <div className="item-row" key={item.id}>
                      <span className="file-icon">{iconForItem(item)}</span>
                      <div className="item-copy">
                        <strong>{item.name}</strong>
                        <small>
                          {statusText(item)}
                          {item.checksum ? ` · ${shortenChecksum(item.checksum)}` : ''}
                        </small>
                        {item.status !== 'complete' ? (
                          <span className="progress-track mini">
                            <span
                              style={{
                                width: `${itemProgress(item.receivedBytes, item.size)}%`,
                              }}
                            />
                          </span>
                        ) : null}
                        {item.preview ? <p className="preview-text">{item.preview}</p> : null}
                      </div>
                      <div className="item-actions">
                        {canCopy ? (
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => copyItem(transfer, item)}
                            disabled={!canUse || busyId === item.id}
                            aria-label="コピー"
                          >
                            <Clipboard size={15} />
                          </button>
                        ) : null}
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => download(transfer, item)}
                          disabled={!canUse || busyId === item.id}
                          aria-label="ダウンロード"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => save(transfer, item)}
                          disabled={!canUse || busyId === item.id}
                          aria-label="保存"
                        >
                          <FolderDown size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <MoreHorizontal size={28} />
          <h3>まだ転送はありません</h3>
          <p>ファイルをドロップ、テキストを貼り付け、またはスマホをペアリングして開始します。</p>
        </div>
      )}
    </section>
  );
}
