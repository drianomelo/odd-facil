import { DashboardContent } from "./DashboardContent";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboardContent = await DashboardContent();

  return (
    <main className="min-h-screen">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 text-white">
        <div className="relative mx-auto flex h-16 w-full items-center justify-between px-5 sm:px-8 lg:px-12">
          <div className="pointer-events-auto flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">
              Odd Fácil
            </h1>
            <span className="hidden border-l border-white/30 pl-3 text-xs font-bold uppercase tracking-[0.18em] text-white/80 sm:inline">
              NBA
            </span>
          </div>
          <nav className="pointer-events-auto flex items-center gap-2 overflow-x-auto sm:gap-5">
            <a
              href="/"
              aria-current="page"
              className="rounded-full border border-white/60 bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm sm:text-sm"
            >
              NBA
            </a>
            <a
              href="/history"
              className="whitespace-nowrap text-xs font-medium text-white/90 transition-colors hover:text-white sm:text-sm"
            >
              Histórico
            </a>
            <a
              href="/performance"
              className="whitespace-nowrap text-xs font-medium text-white/90 transition-colors hover:text-white sm:text-sm"
            >
              Desempenho
            </a>
            <a
              href="/manual"
              className="whitespace-nowrap text-xs font-medium text-white/90 transition-colors hover:text-white sm:text-sm"
            >
              Manual
            </a>
          </nav>
        </div>
      </header>
      {dashboardContent}
    </main>
  );
}
