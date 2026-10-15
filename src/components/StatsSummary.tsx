'use client';

import { APP_TIMEZONE, formatAppDateTime, formatRelativeTime } from '@/lib/utils/date';

interface StatsSummaryProps {
  opportunities: number;
  playerPicks: number;
  playerAnalysisConfigured: boolean;
  games: number;
  lastUpdate: string;
  nextUpdate: string;
  demoMode: boolean;
}

export function StatsSummary({ opportunities, playerPicks, playerAnalysisConfigured, games, lastUpdate, nextUpdate, demoMode }: StatsSummaryProps) {
  const stats = [
    { label: 'Palpites no radar', value: playerAnalysisConfigured ? playerPicks : '—', detail: 'em destaque nos cards', accent: 'text-[#FFD3B5]' },
    { label: 'Jogos agendados', value: games, detail: 'nos próximos 7 dias', accent: 'text-white' },
    { label: 'Oportunidades de jogo', value: opportunities, detail: 'passaram pelos filtros', accent: 'text-white' },
  ];

  return (
    <section aria-labelledby="dashboard-summary-heading" className="flex w-full flex-col justify-center text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">Odd Fácil · NBA</p>
          <h2 id="dashboard-summary-heading" className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Análise do dia</h2>
        </div>
        {demoMode && <span className="rounded-full bg-[#07172f]/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Demo</span>}
      </div>

      <div className="mt-5 divide-y divide-white/20 border-y border-white/20">
        {stats.map(stat => (
          <div key={stat.label} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-xs font-semibold text-white/90">{stat.label}</p>
              <p className="mt-0.5 text-[10px] text-white/60">{stat.detail}</p>
            </div>
            <span className={`font-mono text-3xl font-bold tabular-nums ${stat.accent}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 text-[10px] leading-4 text-white/65">
        <p>Atualizado {formatAppDateTime(lastUpdate)} · {formatRelativeTime(lastUpdate)}</p>
        <p>Próxima atualização: {formatAppDateTime(nextUpdate)} ({APP_TIMEZONE})</p>
      </div>
    </section>
  );
}
