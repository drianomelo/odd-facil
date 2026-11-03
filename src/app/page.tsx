import Link from "next/link";
import { Zap } from "lucide-react";
import { PlayerMarketExplorer } from "@/components/PlayerMarketExplorer";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07090B]">
      <header className="border-b border-white/10 bg-[#0B0D0F]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-white" aria-label="Odd Fácil NBA - início">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#006BB6] text-white"><Zap size={19} fill="currentColor" /></span>
            <span className="text-lg font-extrabold tracking-tight sm:text-xl">Odd Fácil</span>
            <span className="hidden border-l border-white/15 pl-3 text-xs font-bold uppercase tracking-[0.16em] text-[#58A9E3] sm:inline">NBA</span>
          </Link>
          <nav aria-label="Navegação principal" className="flex min-w-0 items-center gap-3 overflow-x-auto text-xs font-semibold sm:gap-6 sm:text-sm">
            <Link href="/" aria-current="page" className="shrink-0 rounded-full bg-[#12334A] px-3 py-2 text-[#8CCBEE]">Análise</Link>
            <Link href="/performance" className="shrink-0 text-white/60 transition hover:text-white">Minhas apostas</Link>
          </nav>
        </div>
      </header>
      <PlayerMarketExplorer />
    </main>
  );
}
