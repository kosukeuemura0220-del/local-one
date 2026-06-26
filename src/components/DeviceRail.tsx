import {
  Copy,
  Laptop,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TabletSmartphone,
  Wifi,
} from 'lucide-react';
import type { Device, Peer, StatusResponse } from '../types';
import { formatDateTime } from '../lib/format';
import { companionUrl } from '../lib/urls';

type Toast = {
  tone: 'success' | 'error' | 'info';
  message: string;
};

type Props = {
  status: StatusResponse;
  onRefresh: () => void;
  onToast: (toast: Toast) => void;
};

function DeviceIcon({ platform }: { platform: string }) {
  const label = platform.toLowerCase();
  if (label.includes('iphone') || label.includes('android')) return <Smartphone size={18} />;
  if (label.includes('ipad') || label.includes('tablet')) return <TabletSmartphone size={18} />;
  if (label.includes('windows')) return <Monitor size={18} />;
  return <Laptop size={18} />;
}

function DeviceRow({
  device,
  meta,
  active,
}: {
  device: Pick<Device, 'name' | 'platform'>;
  meta: string;
  active?: boolean;
}) {
  return (
    <div className={`device-row ${active ? 'active' : ''}`}>
      <span className="device-icon">
        <DeviceIcon platform={device.platform} />
      </span>
      <span className="device-copy">
        <strong>{device.name}</strong>
        <small>{meta}</small>
      </span>
    </div>
  );
}

function PeerRow({ peer }: { peer: Peer }) {
  return (
    <div className="device-row">
      <span className="device-icon">
        <Wifi size={18} />
      </span>
      <span className="device-copy">
        <strong>{peer.name}</strong>
        <small>{peer.addresses[0] ? `${peer.addresses[0]}:${peer.port}` : peer.host}</small>
      </span>
    </div>
  );
}

export function DeviceRail({ status, onRefresh, onToast }: Props) {
  async function copyUrl() {
    const url = companionUrl(status);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    onToast({ tone: 'success', message: 'LAN URLをコピーしました。' });
  }

  return (
    <aside className="device-rail">
      <div className="rail-top">
        <span className="brand-mark">LO</span>
        <button className="icon-button dark" type="button" onClick={onRefresh} aria-label="デバイスを更新">
          <RefreshCw size={16} />
        </button>
      </div>

      <section className="rail-section">
        <h2>この端末</h2>
        <DeviceRow device={status.device} meta={status.device.platform} active />
      </section>

      <section className="rail-section">
        <div className="section-title-row">
          <h2>信頼済み</h2>
          <span>{status.trustedDevices.length}</span>
        </div>
        {status.trustedDevices.length ? (
          status.trustedDevices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              meta={device.lastSeen ? `${formatDateTime(device.lastSeen)}に確認` : device.platform}
            />
          ))
        ) : (
          <p className="muted">まだペアリング済みデバイスはありません。</p>
        )}
      </section>

      <section className="rail-section">
        <div className="section-title-row">
          <h2>近くの端末</h2>
          <span>{status.peers.length}</span>
        </div>
        {status.peers.length ? (
          status.peers.map((peer) => <PeerRow key={peer.id} peer={peer} />)
        ) : (
          <p className="muted">見つからない場合はQRペアリングを使ってください。</p>
        )}
      </section>

      <section className="rail-card">
        <ShieldCheck size={18} />
        <strong>秘密モード</strong>
        <p>履歴ではマスク表示。秘密テキストは{status.settings?.secretTtlMinutes || 15}分後に期限切れになります。</p>
      </section>

      <button className="copy-url-button" type="button" onClick={copyUrl}>
        <Copy size={15} />
        LAN URLをコピー
      </button>
    </aside>
  );
}
