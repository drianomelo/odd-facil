"use client";

import {
  APP_TIMEZONE,
  formatAppDateTime,
  formatAppTime,
  formatRelativeTime,
} from "@/lib/utils/date";
import { CalendarDays, Clock3, RefreshCw, Ticket } from "lucide-react";

interface StatsSummaryProps {
  opportunities: number;
  playerPicks: number;
  playerAnalysisConfigured: boolean;
  games: number;
  lastUpdate: string;
  nextUpdate: string;
  demoMode: boolean;
  staticMode?: boolean;
}

export function StatsSummary({
  opportunities,
  playerPicks,
  playerAnalysisConfigured,
  games,
  lastUpdate,
  nextUpdate,
  demoMode,
  staticMode = false,
}: StatsSummaryProps) {
  const stats = [
    {
      label: "Palpites no radar",
      value: playerAnalysisConfigured ? playerPicks : "—",
      detail: staticMode ? "exemplos locais" : "em destaque nos cards",
      accent: "text-[#FFD3B5]",
      player: "Victor Wembanyama",
      image:
        "https://commons.wikimedia.org/wiki/Special:FilePath/Wembanyama_and_Hart%2C_2026_NBA_Finals.png?width=160",
    },
    {
      label: "Jogos agendados",
      value: staticMode ? "—" : games,
      detail: staticMode ? "APIs pausadas" : "nos próximos 7 dias",
      accent: "text-white",
      player: "Shai Gilgeous-Alexander",
      image:
        "https://commons.wikimedia.org/wiki/Special:FilePath/OKC_Thunder_at_Washington_Wizards_(51815871018).jpg?width=160",
    },
    {
      label: "Oportunidades de jogo",
      value: staticMode ? "—" : opportunities,
      detail: staticMode ? "APIs pausadas" : "passaram pelos filtros",
      accent: "text-white",
      player: "Stephen Curry",
      image:
        "https://commons.wikimedia.org/wiki/Special:FilePath/Stephen_Curry_shooting.jpg?width=160",
    },
  ];

  return (
    <section
      aria-labelledby="dashboard-summary-heading"
      className="flex w-full flex-col justify-center text-white"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="dashboard-summary-heading"
          className="text-2xl font-bold tracking-tight sm:text-4xl"
        >
          Análise do dia
        </h2>
      </div>

      <div className="mt-4 flex w-fit max-w-full flex-col items-start gap-3 text-white sm:flex-row sm:gap-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#58A9E3]/60 bg-[#006BB6]/60">
            <Clock3
              aria-hidden="true"
              className="h-[18px] w-[18px] text-white/90"
            />
          </div>
          <p className="flex flex-col">
            <span className="text-xs font-semibold">Ultima Atualização</span>
            <span className="flex items-center gap-1 opacity-70 text-[11px]">
              <span className="inline-flex items-center gap-1">
                <CalendarDays
                  aria-hidden="true"
                  className="h-[11px] w-[11px]"
                />
                {formatAppDateTime(lastUpdate).split(" ")[0]}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 aria-hidden="true" className="h-[11px] w-[11px]" />
                {formatAppTime(lastUpdate)}
              </span>
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#58A9E3]/60 bg-[#005A9C]/60">
            <RefreshCw
              aria-hidden="true"
              className="h-[18px] w-[18px] text-white/90"
            />
          </div>
          <p className="flex flex-col">
            <span className="text-xs font-semibold">Próxima atualização</span>
            <span className="flex items-center gap-1 opacity-70 text-[11px]">
              <span className="inline-flex items-center gap-1">
                <CalendarDays
                  aria-hidden="true"
                  className="h-[11px] w-[11px]"
                />
                {formatAppDateTime(nextUpdate).split(" ")[0]}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 aria-hidden="true" className="h-[11px] w-[11px]" />
                {formatAppTime(nextUpdate)}
              </span>
            </span>
          </p>
        </div>
      </div>

      <a
        href="#daily-tickets"
        className="mt-6 inline-flex w-fit max-w-full shrink-0 items-center gap-3 rounded-full border border-white/55 bg-white px-5 py-3 text-xs font-semibold text-[#005A9C] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:mt-10 sm:px-10 sm:text-sm"
      >
        Bilhetes do dia
        <Ticket aria-hidden="true" className="h-4 w-4 mt-px" />
      </a>

      <div className="mt-9 grid grid-cols-3 gap-2 sm:mt-16 sm:gap-2">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="relative min-w-0 rounded-xl border border-[#58A9E3]/60 bg-[#005A9C]/55 px-2 pb-3 pt-9 text-white shadow-sm sm:px-4 sm:pb-5 sm:pt-12"
          >
            <div className="absolute -top-7 h-[52px] w-[52px] overflow-hidden rounded-full border border-[#58A9E3]/60 bg-[#005A9C]">
              <img
                src={stat.image}
                alt={`Foto de partida com ${stat.player}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-full object-cover"
              />
            </div>
              <span className="font-mono text-lg tabular-nums sm:text-5xl">
              {stat.value}
            </span>
            <p className="mt-2 line-clamp-2 min-h-7 text-[9px] font-semibold leading-3 text-white/90 sm:min-h-0 sm:truncate sm:text-xs sm:leading-normal">
              {stat.label}
            </p>
            <p className="text-[9px] text-white/75 sm:text-[10px]">
              {stat.detail}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
