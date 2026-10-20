import { DashboardContent } from "./DashboardContent";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboardContent = await DashboardContent();

  return (
    <main className="min-h-screen">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 text-white">
        <div className="relative mx-auto flex h-16 w-full items-center justify-between gap-2 px-3 sm:px-8 lg:px-12">
          <div className="pointer-events-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white sm:h-9 sm:w-9">
              <svg
                className="h-4 w-4 text-white sm:h-5 sm:w-5"
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
            <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
              Odd Fácil
            </h1>
            <span className="hidden border-l border-white/30 pl-3 text-xs font-bold uppercase tracking-[0.18em] text-white/80 sm:inline">
              NBA
            </span>
          </div>
          <nav className="pointer-events-auto flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-5">
            <a
              href="/"
              aria-current="page"
              className="rounded-full border border-white/60 bg-white/15 px-1.5 py-1.5 text-[9px] font-bold text-white backdrop-blur-sm sm:px-3 sm:text-sm"
            >
              NBA
            </a>
            <a
              href="/history"
              className="whitespace-nowrap px-1 text-[10px] font-medium text-white/90 transition-colors hover:text-white sm:px-0 sm:text-sm"
            >
              Histórico
            </a>
            <a
              href="/performance"
              className="whitespace-nowrap px-1 text-[10px] font-medium text-white/90 transition-colors hover:text-white sm:px-0 sm:text-sm"
            >
              Desempenho
            </a>
            <a
              href="/manual"
              className="whitespace-nowrap px-1 text-[10px] font-medium text-white/90 transition-colors hover:text-white sm:px-0 sm:text-sm"
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
