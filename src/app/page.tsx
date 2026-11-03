import Link from "next/link";
import { Zap } from "lucide-react";
import { PlayerMarketExplorer } from "@/components/PlayerMarketExplorer";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-[#E1EAF0] bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[#10243A]" aria-label="Odd Fácil NBA - início">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#006BB6] text-white"><Zap size={19} fill="currentColor" /></span>
            <span className="text-lg font-extrabold tracking-tight sm:text-xl">Odd Fácil</span>
            <span className="hidden border-l border-[#D6E5F0] pl-3 text-xs font-bold uppercase tracking-[0.16em] text-[#005A9C] sm:inline">NBA</span>
          </Link>
          <nav aria-label="Navegação principal" className="flex min-w-0 items-center gap-3 overflow-x-auto text-xs font-semibold sm:gap-6 sm:text-sm">
            <Link href="/" aria-current="page" className="shrink-0 rounded-full bg-[#EAF5FC] px-3 py-2 text-[#005A9C]">Análise</Link>
            <Link href="/history" className="shrink-0 text-slate-600 transition hover:text-[#005A9C]">Histórico</Link>
            <Link href="/performance" className="shrink-0 text-slate-600 transition hover:text-[#005A9C]">Desempenho</Link>
            <Link href="/manual" className="shrink-0 text-slate-600 transition hover:text-[#005A9C]">Manual</Link>
          </nav>
        </div>
      </header>
      <PlayerMarketExplorer />
    </main>
  );
}
