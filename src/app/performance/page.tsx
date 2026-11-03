import Link from "next/link";
import { BasketballLogo } from "@/components/BasketballLogo";
import { PersonalBetsDashboard } from "@/components/PersonalBetsDashboard";

export const dynamic = "force-dynamic";

export default function PerformancePage() {
  return (
    <main className="min-h-screen bg-court-bg">
      <header className="border-b border-white/10 bg-[#0B0D0F]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-7 lg:px-10">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 text-white"
            aria-label="Odd Fácil NBA - início"
          >
            <BasketballLogo />
            <span className="text-lg font-extrabold tracking-tight sm:text-xl">
              Odd Fácil
            </span>
            <span className="hidden border-l border-white/15 pl-3 text-xs font-bold uppercase tracking-[0.16em] text-[#00519F] sm:inline">
              NBA
            </span>
          </Link>
          <nav
            aria-label="Navegação principal"
            className="flex h-16 shrink-0 items-center gap-3 text-xs font-semibold sm:gap-6 sm:text-sm"
          >
            <Link
              href="/"
              className="inline-flex h-full items-center text-white transition hover:text-[#8CCBEE]"
            >
              Análise
            </Link>
            <Link
              href="/performance"
              aria-current="page"
              className="relative inline-flex h-full items-center text-[#00519F] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[#00519F]"
            >
              Minhas apostas
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 lg:px-10">
        <PersonalBetsDashboard />
      </div>
    </main>
  );
}
