import { motion } from "framer-motion";
import { Apple, MonitorSmartphone, Smartphone, AlertTriangle } from "lucide-react";
import { RELEASE } from "../lib/links";

export default function Download() {
  return (
    <section id="download" className="relative bg-[#0f172a] py-24 px-4 md:px-6">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">今すぐダウンロード</h2>
          <p className="text-white/50">完全無料。インストール後、すぐに使い始められます。</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center"
          >
            <Apple className="h-9 w-9 text-teal-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold text-lg mb-1">Mac</h3>
            <p className="text-sm text-white/40 mb-6">Apple Silicon / Intel 対応</p>
            <a
              href={RELEASE.macArm}
              className="block w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold py-3 mb-3 transition"
            >
              Apple Silicon版 (.dmg)
            </a>
            <a
              href={RELEASE.macIntel}
              className="block w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 font-medium py-3 transition"
            >
              Intel版 (.dmg)
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center"
          >
            <MonitorSmartphone className="h-9 w-9 text-amber-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold text-lg mb-1">Windows</h3>
            <p className="text-sm text-white/40 mb-6">Windows 10 / 11 (x64)</p>
            <a
              href={RELEASE.winInstaller}
              className="block w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-[#1a1304] font-semibold py-3 mb-3 transition"
            >
              インストーラー版 (.exe)
            </a>
            <a
              href={RELEASE.winPortable}
              className="block w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 font-medium py-3 transition"
            >
              ポータブル版 (.exe)
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-5 mb-8"
        >
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/60 leading-relaxed">
            このアプリは個人配布のため未署名です。Macで「開発元を確認できません」と表示された場合は
            <span className="text-white/80 font-medium">右クリック→「開く」</span>
            を選んでください。Windowsでは SmartScreen の警告で
            <span className="text-white/80 font-medium">「詳細情報」→「実行」</span>
            をクリックしてください。
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
        >
          <Smartphone className="h-5 w-5 text-teal-400 shrink-0" />
          <p className="text-sm text-white/50">
            iPhone / Android からは、Mac または Windows で起動後に表示されるURLへブラウザでアクセスしてください(PWA対応)。
          </p>
        </motion.div>
      </div>
    </section>
  );
}
