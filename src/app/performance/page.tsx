import Link from 'next/link';
import { PerformanceContent } from './PerformanceContent';

export const dynamic = 'force-dynamic';

export default function PerformancePage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-court-border bg-court-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-court-accent" aria-hidden="true">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </div>
            <span className="text-lg font-bold text-court-text">Odd Fácil</span>
            <span className="badge badge-info hidden sm:inline-flex">NBA</span>
          </div>
          <nav aria-label="Navegação principal" className="flex items-center gap-4 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="text-sm text-court-textMuted transition-colors hover:text-court-text">NBA</Link>
            <Link href="/history" className="text-sm text-court-textMuted transition-colors hover:text-court-text">Histórico</Link>
            <Link href="/performance" aria-current="page" className="text-sm font-medium text-court-text">Desempenho</Link>
            <Link href="/manual" className="text-sm text-court-textMuted transition-colors hover:text-court-text">Manual</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <PerformanceContent />
      </div>
    </main>
  );
}
