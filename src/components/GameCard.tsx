"use client";

import { formatAppDateTime, formatAppTime } from "@/lib/utils/date";
import { Game, MarketOdds } from "@/types";
import { StatusLabel } from "@/lib/utils/labels";
import { getNbaTeamInfo, TeamLogo } from "@/components/TeamLogo";

interface GameCardProps {
  game: Game;
}

export function GameCard({ game }: GameCardProps) {
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";
  const gameTime = formatAppTime(game.commence_time);
  const gameDate = formatAppDateTime(game.commence_time).split(" ")[0];
  const winnerMarket = game.markets.find((market) => market.market === "h2h");
  const awayInfo = getNbaTeamInfo(game.away_team.abbreviation);
  const homeInfo = getNbaTeamInfo(game.home_team.abbreviation);
  const awayColor = awayInfo?.color || "#006BB6";
  const homeColor = homeInfo?.color || "#ED174B";

  return (
    <article
      className="relative isolate min-w-0 overflow-hidden rounded-2xl border border-[#D5E6F2] bg-white px-4 pb-5 pt-4 shadow-sm transition-all hover:border-[#9BC7E3] hover:shadow-md sm:px-6"
      style={{
        background: `linear-gradient(112deg, ${awayColor}12 0%, #ffffff 43%, #ffffff 57%, ${homeColor}12 100%)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.055]"
        style={{
          background: `linear-gradient(110deg, ${awayColor} 0%, transparent 48%, transparent 52%, ${homeColor} 100%)`,
        }}
      />

      {(isLive || isFinished) && (
        <span
          className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide sm:right-4 sm:top-4 ${
            isLive
              ? "animate-pulse border-[#ed174b]/25 bg-[#ed174b]/10 text-[#b3133b]"
              : "border-[#58A9E3]/40 bg-[#EAF5FC] text-[#005A9C]"
          }`}
        >
          {isLive ? "AO VIVO" : StatusLabel[game.status] || game.status}
        </span>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <TeamOdds
          abbreviation={game.away_team.abbreviation}
          color={awayColor}
          market={winnerMarket}
          side="away"
          score={isFinished ? game.away_score : undefined}
          faded={isFinished}
        />

        <div className="flex flex-col items-center gap-1.5">
          {!isLive && !isFinished && (
            <span className="mb-0.5 rounded-full border border-[#58A9E3]/40 bg-white/85 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#005A9C]">
              {StatusLabel[game.status] || game.status}
            </span>
          )}
          <span className="font-mono text-[10px] font-semibold tabular-nums text-court-textMuted sm:text-[11px]">
            {gameDate}
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-court-textMuted sm:text-xs">
            VS
          </span>
          <span className="font-mono text-[10px] font-semibold tabular-nums text-court-textMuted sm:text-[11px]">
            {gameTime}
          </span>
          {isFinished && game.away_score != null && game.home_score != null && (
            <span className="whitespace-nowrap font-mono text-[11px] font-bold tabular-nums text-court-text sm:text-sm">
              {game.away_score} – {game.home_score}
            </span>
          )}
        </div>

        <TeamOdds
          abbreviation={game.home_team.abbreviation}
          color={homeColor}
          market={winnerMarket}
          side="home"
          score={isFinished ? game.home_score : undefined}
          faded={isFinished}
        />
      </div>
    </article>
  );
}

function TeamOdds({
  abbreviation,
  color,
  market,
  side,
  score,
  faded,
}: {
  abbreviation: string;
  color: string;
  market: MarketOdds | undefined;
  side: "away" | "home";
  score?: number;
  faded: boolean;
}) {
  const probability = market?.fair_probabilities?.[side];

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div
        className="relative mb-0.5 flex h-[88px] w-[88px] items-center justify-center rounded-full sm:h-[108px] sm:w-[108px]"
        style={{
          background: `radial-gradient(circle, ${color}20 0%, ${color}0C 58%, transparent 76%)`,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-[-18px] -z-10 rounded-full opacity-[0.12] blur-xl"
          style={{ backgroundColor: color }}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 z-0 -translate-y-1/2 opacity-[0.12] ${side === "away" ? "-left-16 sm:-left-24" : "-right-16 sm:-right-24"}`}
        >
          <TeamLogo team={abbreviation} size="watermark" />
        </span>
        <div className={`relative z-10 ${faded ? "opacity-60" : ""}`}>
          <TeamLogo team={abbreviation} size="hero" />
        </div>
      </div>

      <span className="text-sm font-extrabold tracking-wide text-court-text sm:text-base">
        {abbreviation}
      </span>
      {score !== undefined && (
        <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-court-textMuted">
          {score}
        </span>
      )}
      <span className="mt-1 rounded-full border border-white/80 bg-white/75 px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums text-court-text sm:text-xs">
        {probability !== undefined ? `${Math.round(probability * 100)}%` : "—"}
      </span>
    </div>
  );
}
