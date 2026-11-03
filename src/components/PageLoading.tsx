export function PageLoading({ game = false }: { game?: boolean }) {
  return (
    <main aria-busy="true" aria-live="polite" className="min-h-screen bg-[#07090B]">
      <div className="h-1 overflow-hidden bg-[#161A1E]">
        <div className="h-full w-1/3 animate-[loading-bar_1.4s_ease-in-out_infinite] rounded-full bg-[#ED174B]" />
      </div>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="flex items-center gap-3 text-sm font-semibold text-[#8CCBEE]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-[#58A9E3]" aria-hidden="true" />
          <span>{game ? "Carregando as props desta partida…" : "Carregando jogos e análises…"}</span>
        </div>
        {game ? (
          <div className="mt-7 space-y-5">
            <div className="h-40 animate-pulse rounded-2xl bg-[#111416]" />
            <div className="h-9 w-64 animate-pulse rounded-lg bg-[#111416]" />
            {[0, 1, 2].map((row) => <div key={row} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-[#111416]" />)}
          </div>
        ) : (
          <div className="mt-7 space-y-8">
            <div className="h-[42vh] min-h-72 animate-pulse rounded-2xl bg-[#006BB6]" />
            <div className="h-8 w-56 animate-pulse rounded-lg bg-[#111416]" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((card) => <div key={card} className="h-52 animate-pulse rounded-2xl border border-white/10 bg-[#111416]" />)}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
