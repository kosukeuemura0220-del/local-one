import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "MacまたはWindowsで起動",
    desc: "Local ONE を開くと、QRコードと6桁コードが表示されます。",
  },
  {
    n: "02",
    title: "もう一方の端末をペアリング",
    desc: "カメラでQRを読み取るか、6桁コードを入力するだけで信頼済み端末になります。",
  },
  {
    n: "03",
    title: "送りたいものを選ぶ",
    desc: "ファイル・フォルダ・テキスト・.env・APIキーをドラッグ&ドロップ、または選択して送信。",
  },
  {
    n: "04",
    title: "受信側で保存方法を選ぶ",
    desc: "フォルダへ保存、クリップボードへコピー、.env.localとして配置などを選べます。",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative bg-[#0b1322] py-24 px-4 md:px-6">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">使い方は4ステップ</h2>
          <p className="text-white/50">セットアップに数分、転送は数秒で完了します。</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, x: i % 2 === 0 ? -24 : 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
            >
              <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-teal-300 to-amber-200 shrink-0">
                {s.n}
              </span>
              <div>
                <h3 className="text-white font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
