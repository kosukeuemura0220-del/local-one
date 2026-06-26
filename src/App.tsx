import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { DeviceRail } from './components/DeviceRail';
import { PairingGate } from './components/PairingGate';
import { SendPanel } from './components/SendPanel';
import { TransferQueue } from './components/TransferQueue';
import { eventUrl, fetchStatus } from './lib/api';
import { getStoredSession } from './lib/device';
import { companionUrl } from './lib/urls';
import type { StatusResponse } from './types';

type Toast = {
  tone: 'success' | 'error' | 'info';
  message: string;
};

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);

  const pairToken = useMemo(() => {
    return new URLSearchParams(location.search).get('pairToken') || '';
  }, []);

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchStatus();
      setStatus(next);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Local ONEに接続できませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!status?.trusted) return;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(eventUrl());
      socket.onmessage = () => refresh();
    } catch {
      return;
    }
    return () => socket?.close();
  }, [refresh, status?.trusted]);

  const handlePaired = useCallback(async () => {
    const url = new URL(location.href);
    url.searchParams.delete('pairToken');
    window.history.replaceState({}, '', url.toString());
    await refresh();
    showToast({ tone: 'success', message: 'デバイスをペアリングしました。' });
  }, [refresh, showToast]);

  if (loading && !status) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">LO</div>
        <div>
          <h1>Local ONE</h1>
          <p>ローカル転送ハブに接続しています…</p>
        </div>
      </main>
    );
  }

  if (!status?.trusted) {
    return (
      <PairingGate
        pairToken={pairToken}
        status={status}
        error={error}
        existingSession={getStoredSession()}
        onPaired={handlePaired}
      />
    );
  }

  return (
    <main className="app-shell">
      <DeviceRail status={status} onRefresh={refresh} onToast={showToast} />

      <section className="workspace" aria-label="転送ワークスペース">
        <header className="workspace-header">
          <div>
            <div className="brand-row">
              <span className="brand-mark compact">LO</span>
              <h1>Local ONE</h1>
            </div>
            <p>
              {status.device.name} は {companionUrl(status)} で待機中です。
            </p>
          </div>
          <div className="header-actions">
            <span className="status-pill">
              <Activity size={15} />
              ローカル
            </span>
            <button className="icon-button" type="button" onClick={refresh} aria-label="更新">
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {error ? (
          <div className="banner error">
            <AlertCircle size={18} />
            {error}
          </div>
        ) : null}

        <TransferQueue
          transfers={status.transfers}
          onChanged={refresh}
          onToast={showToast}
        />
      </section>

      <SendPanel status={status} onChanged={refresh} onToast={showToast} />

      {toast ? (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
