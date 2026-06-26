import { FormEvent, useState } from 'react';
import { KeyRound, Link2, Lock, Smartphone } from 'lucide-react';
import { claimPairing } from '../lib/api';
import {
  defaultDeviceName,
  detectClientPlatform,
  setStoredDeviceName,
  setStoredSession,
} from '../lib/device';
import { companionUrl } from '../lib/urls';
import type { StatusResponse } from '../types';

type Props = {
  pairToken: string;
  status: StatusResponse | null;
  error: string;
  existingSession: string;
  onPaired: () => void;
};

export function PairingGate({ pairToken, status, error, existingSession, onPaired }: Props) {
  const [deviceName, setDeviceName] = useState(defaultDeviceName());
  const [pairCode, setPairCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const visibleUrl = status ? companionUrl(status) : 'ローカルサーバーを待機中';
  const normalizedPairCode = pairCode.replace(/\D/g, '').slice(0, 6);

  async function completePairing(payload: { token?: string; code?: string }) {
    setBusy(true);
    setMessage('');
    try {
      const result = await claimPairing({
        ...payload,
        deviceName,
        platform: detectClientPlatform(),
      });
      setStoredSession(result.sessionId);
      setStoredDeviceName(deviceName);
      onPaired();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'ペアリングに失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  async function submitToken(event: FormEvent) {
    event.preventDefault();
    if (!pairToken) return;
    await completePairing({ token: pairToken });
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    if (normalizedPairCode.length !== 6) {
      setMessage('6桁のペアリングコードを入力してください。');
      return;
    }

    await completePairing({ code: normalizedPairCode });
  }

  return (
    <main className="pairing-screen">
      <section className="pairing-panel">
        <div className="brand-row">
          <span className="brand-mark">LO</span>
          <div>
            <h1>Local ONE</h1>
            <p>{status?.device?.name || 'ローカル転送ハブ'}</p>
          </div>
        </div>

        {pairToken ? (
          <form className="pairing-form" onSubmit={submitToken}>
            <div className="pairing-icon">
              <Smartphone size={26} />
            </div>
            <h2>このデバイスをペアリング</h2>
            <label>
              デバイス名
              <input
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button className="primary-button" type="submit" disabled={busy || !deviceName.trim()}>
              <KeyRound size={17} />
              {busy ? 'ペアリング中…' : 'ペアリングする'}
            </button>
            {message ? <p className="form-message error-text">{message}</p> : null}
          </form>
        ) : (
          <div className="locked-state">
            <div className="pairing-icon">
              <Lock size={26} />
            </div>
            <h2>ペアリングが必要です</h2>
            <p>
              この画面は正常です。スマホはカメラでQRを読み取り、カメラのないPCは6桁コードで接続できます。
            </p>
            <form className="manual-pairing-form" onSubmit={submitCode}>
              <label>
                6桁コード
                <input
                  value={pairCode}
                  onChange={(event) => setPairCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="123456"
                  autoComplete="one-time-code"
                />
              </label>
              <label>
                デバイス名
                <input
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={busy || normalizedPairCode.length !== 6 || !deviceName.trim()}
              >
                <KeyRound size={17} />
                {busy ? 'ペアリング中…' : 'コードでペアリング'}
              </button>
            </form>
            <ol className="pairing-steps">
              <li>MacまたはWindowsのLocal ONE画面を開く</li>
              <li>右側の「デバイスをペアリング」を押す</li>
              <li>iPhone/AndroidはカメラでQRコードを読み取る</li>
              <li>Windowsなどカメラなし端末は、QR下の6桁コードをこの画面に入力</li>
            </ol>
            {existingSession ? (
              <p className="form-message">
                保存済みセッションがありますが、このハブでは認証できませんでした。
              </p>
            ) : null}
            {message ? <p className="form-message error-text">{message}</p> : null}
            {error ? <p className="form-message error-text">{error}</p> : null}
            <div className="pairing-hint">
              <Link2 size={15} />
              {visibleUrl}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
