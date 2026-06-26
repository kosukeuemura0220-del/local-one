import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from 'react';
import {
  Clipboard,
  FileArchive,
  FileKey2,
  FolderOpen,
  FolderDown,
  Link2,
  Loader2,
  QrCode,
  Send,
  Shield,
  ToggleLeft,
  ToggleRight,
  UploadCloud,
} from 'lucide-react';
import { createTextTransfer, startPairing, updateSettings } from '../lib/api';
import { formatBytes, transferProgress } from '../lib/format';
import { uploadFiles } from '../lib/upload';
import { companionUrl } from '../lib/urls';
import type { PairingToken, StatusResponse } from '../types';

type Toast = {
  tone: 'success' | 'error' | 'info';
  message: string;
};

type Props = {
  status: StatusResponse;
  onChanged: () => void;
  onToast: (toast: Toast) => void;
};

type Mode = 'files' | 'text' | 'secret';

type FileWithLocalPath = File & {
  webkitRelativePath?: string;
  localOneRelativePath?: string;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

function fileRelativePath(file: File) {
  const withPath = file as FileWithLocalPath;
  return withPath.webkitRelativePath || withPath.localOneRelativePath || file.name;
}

function attachRelativePath(file: File, relativePath: string) {
  Object.defineProperty(file, 'localOneRelativePath', {
    value: relativePath.replace(/^\/+/, '') || file.name,
    configurable: true,
  });
  return file;
}

async function readDirectoryEntries(entry: FileSystemDirectoryEntry) {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    entries.push(...batch);
  }

  return entries;
}

async function filesFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    return [attachRelativePath(file, entry.fullPath || entry.name)];
  }

  if (!entry.isDirectory) return [];

  const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
  const nested = await Promise.all(children.map((child) => filesFromEntry(child)));
  return nested.flat();
}

export function SendPanel({ status, onChanged, onToast }: Props) {
  const [mode, setMode] = useState<Mode>('files');
  const [files, setFiles] = useState<File[]>([]);
  const [secretMode, setSecretMode] = useState(false);
  const [directoryMode, setDirectoryMode] = useState(false);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [folderReading, setFolderReading] = useState(false);
  const [progress, setProgress] = useState({ fileName: '', sentBytes: 0, totalBytes: 0 });
  const [pairing, setPairing] = useState<PairingToken | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);

  const fileBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const effectiveSecret = mode === 'secret' || secretMode;

  function setPickedFiles(fileList: FileList | null) {
    setFiles(fileList ? Array.from(fileList) : []);
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const items = Array.from(event.dataTransfer.items || []) as DataTransferItemWithEntry[];
    const entries = items
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => Boolean(entry));

    if (!entries.length) {
      setPickedFiles(event.dataTransfer.files);
      return;
    }

    setFolderReading(true);
    try {
      const nested = await Promise.all(entries.map((entry) => filesFromEntry(entry)));
      const nextFiles = nested.flat();
      setDirectoryMode(nextFiles.some((file) => fileRelativePath(file).includes('/')));
      setFiles(nextFiles);
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : 'フォルダを読み込めませんでした。' });
    } finally {
      setFolderReading(false);
    }
  }

  function chooseFiles() {
    setDirectoryMode(false);
    fileInput.current?.click();
  }

  function chooseFolderToSend() {
    setDirectoryMode(true);
    folderInput.current?.click();
  }

  async function submitFiles() {
    if (!files.length) {
      onToast({ tone: 'error', message: '先にファイルを選択してください。' });
      return;
    }
    setUploading(true);
    try {
      await uploadFiles({
        files,
        secretMode: effectiveSecret,
        onProgress: (next) => {
          setProgress({
            fileName: next.fileName,
            sentBytes: next.sentBytes,
            totalBytes: next.totalBytes,
          });
        },
      });
      setFiles([]);
      setProgress({ fileName: '', sentBytes: 0, totalBytes: 0 });
      await onChanged();
      onToast({ tone: 'success', message: '転送を検証しました。' });
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : 'アップロードに失敗しました。' });
    } finally {
      setUploading(false);
    }
  }

  async function submitText(event: FormEvent) {
    event.preventDefault();
    if (!textContent.trim()) {
      onToast({ tone: 'error', message: 'テキストが空です。' });
      return;
    }
    setUploading(true);
    try {
      await createTextTransfer({
        title: textTitle.trim() || (mode === 'secret' ? '秘密テキスト' : 'テキストメモ'),
        content: textContent,
        secretMode: effectiveSecret,
      });
      setTextTitle('');
      setTextContent('');
      await onChanged();
      onToast({ tone: 'success', message: effectiveSecret ? '秘密情報を送信しました。' : 'テキストを送信しました。' });
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : '送信に失敗しました。' });
    } finally {
      setUploading(false);
    }
  }

  async function beginPairing() {
    setPairingBusy(true);
    try {
      const token = await startPairing(companionUrl(status));
      setPairing(token);
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : 'ペアリングに失敗しました。' });
    } finally {
      setPairingBusy(false);
    }
  }

  async function copyPairingLink() {
    if (!pairing) return;
    await navigator.clipboard.writeText(pairing.pairingUrl);
    onToast({ tone: 'success', message: 'ペアリングリンクをコピーしました。' });
  }

  async function copyPairingCode() {
    if (!pairing) return;
    await navigator.clipboard.writeText(pairing.code);
    onToast({ tone: 'success', message: 'ペアリングコードをコピーしました。' });
  }

  async function chooseFolder() {
    const selected = await window.localOneDesktop?.chooseFolder?.();
    if (!selected) return;
    try {
      await updateSettings({ receiveDirectory: selected });
      await onChanged();
      onToast({ tone: 'success', message: '受信フォルダを更新しました。' });
    } catch (err) {
      onToast({ tone: 'error', message: err instanceof Error ? err.message : 'フォルダを保存できませんでした。' });
    }
  }

  return (
    <aside className="send-panel">
      <div className="panel-header">
        <div>
          <h2>送信</h2>
          <p>ファイル、動画、GIF、テキスト、.env、キーを送れます。</p>
        </div>
        <button
          className={`switch-button ${effectiveSecret ? 'on' : ''}`}
          type="button"
          onClick={() => setSecretMode((value) => !value)}
          aria-pressed={effectiveSecret}
          disabled={mode === 'secret'}
        >
          {effectiveSecret ? <ToggleRight size={19} /> : <ToggleLeft size={19} />}
          秘密モード
        </button>
      </div>

      <div className="segmented" role="tablist" aria-label="送信モード">
        <button className={mode === 'files' ? 'active' : ''} type="button" onClick={() => setMode('files')}>
          <FileArchive size={16} />
          ファイル
        </button>
        <button className={mode === 'text' ? 'active' : ''} type="button" onClick={() => setMode('text')}>
          <Clipboard size={16} />
          テキスト
        </button>
        <button className={mode === 'secret' ? 'active' : ''} type="button" onClick={() => setMode('secret')}>
          <FileKey2 size={16} />
          秘密
        </button>
      </div>

      {mode === 'files' ? (
        <section className="send-section">
          <div
            className="dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            onClick={chooseFiles}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                chooseFiles();
              }
            }}
            role="button"
            tabIndex={0}
          >
            {folderReading ? <Loader2 className="spin" size={28} /> : <UploadCloud size={28} />}
            <strong>{folderReading ? 'フォルダを読み込み中' : files.length ? `${files.length}件を選択中` : 'ここにファイル/フォルダをドロップ'}</strong>
            <span>
              {files.length
                ? `${formatBytes(fileBytes)}${directoryMode ? ' / フォルダ構成あり' : ''}`
                : 'Mistyなどのフォルダは下の「フォルダを選択」から選べます'}
            </span>
          </div>
          <div className="file-pick-actions">
            <button className="secondary-button" type="button" onClick={chooseFiles}>
              <FileArchive size={16} />
              ファイルを選択
            </button>
            <button className="secondary-button" type="button" onClick={chooseFolderToSend}>
              <FolderOpen size={16} />
              フォルダを選択
            </button>
          </div>
          <input
            ref={fileInput}
            className="hidden-input"
            type="file"
            multiple
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setDirectoryMode(false);
              setPickedFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
          <input
            ref={folderInput}
            className="hidden-input"
            type="file"
            multiple
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setDirectoryMode(true);
              setPickedFiles(event.target.files);
              event.currentTarget.value = '';
            }}
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          />
          <p className="file-mode-note">
            フォルダを送る場合は「フォルダを選択」を押して、Mistyフォルダを選んでください。
          </p>
          {files.length ? (
            <div className="selected-files">
              {files.slice(0, 5).map((file) => (
                <span key={`${fileRelativePath(file)}-${file.size}`}>
                  {fileRelativePath(file)}
                  <small>{formatBytes(file.size)}</small>
                </span>
              ))}
              {files.length > 5 ? <span>ほか{files.length - 5}件</span> : null}
            </div>
          ) : null}
          {uploading ? (
            <div className="upload-progress">
              <div>
                <Loader2 className="spin" size={16} />
                <strong>{progress.fileName || '転送を準備中'}</strong>
                <small>{formatBytes(progress.sentBytes)} / {formatBytes(progress.totalBytes)}</small>
              </div>
              <span className="progress-track">
                <span style={{ width: `${transferProgress(progress.sentBytes, progress.totalBytes)}%` }} />
              </span>
            </div>
          ) : null}
          <button className="primary-button" type="button" onClick={submitFiles} disabled={uploading || folderReading || !files.length}>
            <Send size={17} />
            {uploading ? '送信中…' : '送信'}
          </button>
        </section>
      ) : (
        <form className="send-section" onSubmit={submitText}>
          <label>
            名前
            <input
              value={textTitle}
              onChange={(event) => setTextTitle(event.target.value)}
              placeholder={mode === 'secret' ? '.env.local、APIキー、SSHメモ' : 'メモの名前'}
              autoComplete="off"
            />
          </label>
          <label>
            内容
            <textarea
              value={textContent}
              onChange={(event) => setTextContent(event.target.value)}
              placeholder={mode === 'secret' ? '履歴ではマスクされ、自動で期限切れになります' : 'ここにテキストを貼り付け'}
            />
          </label>
          <button className="primary-button" type="submit" disabled={uploading}>
            {mode === 'secret' ? <Shield size={17} /> : <Send size={17} />}
            {uploading ? '送信中…' : mode === 'secret' ? '秘密情報を送信' : '送信'}
          </button>
        </form>
      )}

      <section className="pair-card">
        <div className="pair-title">
          <QrCode size={18} />
          <h2>デバイスをペアリング</h2>
        </div>
        {pairing ? (
          <>
            <img src={pairing.qrDataUrl} alt="Local ONEのペアリングQRコード" />
            <p className="pair-method-note">
              スマホはカメラでQRを読み取り。PCは下の6桁コードを入力。
            </p>
            <div className="pair-code-block">
              <span>カメラなし端末用コード</span>
              <div className="pair-code">{pairing.code}</div>
            </div>
            <div className="pair-actions">
              <button className="secondary-button" type="button" onClick={copyPairingLink}>
                <Link2 size={16} />
                リンク
              </button>
              <button className="secondary-button" type="button" onClick={copyPairingCode}>
                <Clipboard size={16} />
                コード
              </button>
            </div>
          </>
        ) : (
          <button className="secondary-button" type="button" onClick={beginPairing} disabled={pairingBusy}>
            <QrCode size={16} />
            {pairingBusy ? '作成中…' : 'ペアリング開始'}
          </button>
        )}
      </section>

      <section className="receive-card">
        <div>
          <FolderDown size={18} />
          <h2>受信</h2>
        </div>
        <p title={status.settings?.receiveDirectory || status.device.receiveDirectory}>
          {status.settings?.receiveDirectory || status.device.receiveDirectory}
        </p>
        {window.localOneDesktop ? (
          <button className="secondary-button" type="button" onClick={chooseFolder}>
            <FolderDown size={16} />
            保存先を変更
          </button>
        ) : null}
      </section>
    </aside>
  );
}
