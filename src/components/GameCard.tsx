'use client';

import { formatAppDateTime, formatAppTime, formatRelativeTime } from '@/lib/utils/date';
import { Game, MarketOdds, Odd, SelectionType } from '@/types';
import { StatusLabel, FreshnessLabel, FreshnessColor } from '@/lib/utils/labels';
import { TeamLogo } from '@/components/TeamLogo';

interface GameCardProps {
  game: Game;
}

export function GameCard({ game }: GameCardProps) {
  const isLive = game.status === 'live';
  const isFinished = game.status === 'finished';
  const gameTime = formatAppTime(game.commence_time);
  const gameDate = formatAppDateTime(game.commence_time).split(' ')[0];

  const bestOddsByMarket = game.markets.reduce((acc: Record<string, MarketOdds>, m) => {
    const key = `${m.market}-${m.line || '0'}`;
    if (!acc[key] || hasBetterOdds(m, acc[key])) {
      acc[key] = m;
    }
    return acc;
  }, {});

  return (
    <article className="card relative border-[#58A9E3]/50 bg-white shadow-sm transition-all hover:border-[#005A9C]/60 hover:shadow-md hover:shadow-[#005A9C]/10">
      {isLive && (
        <div className="absolute top-3 right-3 badge badge-danger animate-pulse">AO VIVO</div>
      )}
      {isFinished && (
        <div className="absolute top-3 right-3 badge border border-[#58A9E3]/40 bg-[#EAF5FC] text-[#005A9C]">FINALIZADO</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex flex-col items-center sm:items-start">
            <div className="flex items-center gap-2 text-sm text-court-textMuted">
              <span className="font-mono">{gameDate}</span>
              <span className="w-px h-4 bg-court-border hidden sm:block" />
              <span className="font-mono font-medium">{gameTime}</span>
            </div>
            <div className="flex items-center gap-2.5 mt-1">
              <TeamLogo team={game.away_team.abbreviation} size="sm" />
              <span className={`font-semibold text-court-text ${isFinished ? 'text-court-textMuted' : ''}`}>
                {game.away_team.abbreviation}
              </span>
              <span className="text-court-textMuted">@</span>
              <TeamLogo team={game.home_team.abbreviation} size="sm" />
              <span className={`font-semibold text-court-text ${isFinished ? 'text-court-textMuted' : ''}`}>
                {game.home_team.abbreviation}
              </span>
            </div>
          </div>
          
          {isFinished && game.home_score !== null && game.away_score !== null && (
            <div className="flex items-center gap-4 ml-4 border-l border-court-border pl-4">
              <div className="text-center">
                <div className="text-xl font-bold font-mono tabular-nums text-court-text">{game.away_score}</div>
                <div className="text-xs text-court-textMuted">{game.home_score}</div>
              </div>
              <span className="text-court-textMuted">×</span>
              <div className="text-center">
                <div className="text-xl font-bold font-mono tabular-nums text-court-text">{game.home_score}</div>
                <div className="text-xs text-court-textMuted">{game.away_score}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-shrink-0">
          <span className={`badge ${isLive ? 'border border-[#ed174b]/25 bg-[#ed174b]/10 text-[#b3133b]' : 'border border-[#58A9E3]/40 bg-[#EAF5FC] text-[#005A9C]'}`}>
            {StatusLabel[game.status] || game.status}
          </span>
          
          {Object.keys(bestOddsByMarket).length ? (
            <div className="flex items-center gap-4 text-sm">
              {Object.entries(bestOddsByMarket).slice(0, 3).map(([_, market]) => (
                <MarketOddsSummary key={`${market.market}-${market.line}`} market={market} />
              ))}
              {Object.keys(bestOddsByMarket).length > 3 && (
                <span className="text-court-textMuted text-xs">+{Object.keys(bestOddsByMarket).length - 3} mercados</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-court-textMuted">Odds ainda não publicadas</span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-court-border/50 flex flex-wrap items-center gap-4 text-xs text-court-textMuted">
        <span>Atualizado: {formatRelativeTime(game.updated_at)}</span>
        {game.markets.length > 0 && (
          <span>
            Odds: {game.markets.map(m => Object.values(m.best_odds).map(o => o?.freshness).filter(Boolean).join(', ')).filter(Boolean).join(', ')}
          </span>
        )}
      </div>
    </article>
  );
}

function hasBetterOdds(a: MarketOdds, b: MarketOdds): boolean {
  const aBest = Math.max(...Object.values(a.best_odds).map(o => o?.odds || 0));
  const bBest = Math.max(...Object.values(b.best_odds).map(o => o?.odds || 0));
  return aBest > bBest;
}

function MarketOddsSummary({ market }: { market: MarketOdds }) {
  const selections = Object.entries(market.best_odds).filter(([_, v]) => v);
  if (selections.length === 0) return null;

  const labels: Record<string, string> = {
    home: 'Casa',
    away: 'Fora',
    over: 'Mais',
    under: 'Menos',
    home_spread: 'Casa',
    away_spread: 'Fora',
  };

  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-[#58A9E3]/30 bg-[#F4FAFE] px-2 py-1 text-xs" title="Odd máxima e probabilidade média do mercado sem margem">
      {selections.map(([sel, odd]) => odd && (
        <OddsSelection key={sel} selection={sel as SelectionType} odd={odd} market={market} label={labels[sel] || sel} />
      ))}
    </div>
  );
}

function OddsSelection({ selection, odd, market, label }: { selection: SelectionType; odd: Odd; market: MarketOdds; label: string }) {
  const probability = market.fair_probabilities?.[selection];
  return (
    <span className="font-mono font-medium text-court-text">
      {label} {probability !== undefined ? `${Math.round(probability * 100)}% · ` : ''}{odd.odds.toFixed(2)}
    </span>
  );
}
