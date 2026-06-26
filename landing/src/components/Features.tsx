import { motion } from "framer-motion";
import {
  FolderUp,
  ShieldCheck,
  QrCode,
  Wifi,
  KeyRound,
  Gauge,
} from "lucide-react";

const features = [
  {
    icon: FolderUp,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    title: "容量無制限のフォルダ転送",
    desc: "動画・画像・ZIP・プロジェクトフォルダまで、サイズの上限なく送れます。大容量はチャンク分割転送で安定動作。",
  },
  {
    icon: KeyRound,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "秘密モード",
    desc: ".envやAPIキーは履歴に残さず、表示はマスク、一定時間で自動的に破棄されます。",
  },
  {
    icon: QrCode,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    title: "QR / 6桁コードでペアリング",
    desc: "カメラで読み取るだけ、またはコード入力だけで端末同士が信頼済みになります。",
  },
  {
    icon: Wifi,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    title: "同一Wi-Fi内で自動検出",
    desc: "mDNSによる近くのLocal ONEデバイス検出。インターネットには一切アップロードしません。",
  },
  {
    icon: ShieldCheck,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "SHA-256で破損チェック",
    desc: "転送前後でハッシュを検証し、ファイルの破損や欠落を防ぎます。",
  },
  {
    icon: Gauge,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    title: "進捗・速度をリアルタイム表示",
    desc: "転送速度、残り時間、キューの状態を画面上で確認できます。",
  },
];

export default function Features() {
  return (
    <section className="relative bg-[#0f172a] py-24 px-4 md:px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            これ一つで、ローカル転送が完結する
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto">
            Local ONE は「ファイル送信アプリ」ではなく、何でも自由に行き来できる
            ローカル転送レイヤーです。
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition"
            >
              <div className={`inline-flex items-center justify-center h-11 w-11 rounded-xl ${f.bg} mb-4`}>
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
