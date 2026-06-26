import { RELEASE } from "../lib/links";

export default function Footer() {
  return (
    <footer className="bg-[#0b1322] border-t border-white/[0.06] py-10 px-4 md:px-6">
      <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
        <span>© 2026 Local ONE</span>
        <div className="flex items-center gap-6">
          <a href={RELEASE.repo} className="hover:text-white/70 transition">
            GitHub
          </a>
          <a href="#download" className="hover:text-white/70 transition">
            ダウンロード
          </a>
        </div>
      </div>
    </footer>
  );
}
