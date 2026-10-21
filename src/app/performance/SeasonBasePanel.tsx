'use client';

import { useEffect, useState } from 'react';
import { PlayerPropMarket } from '@/lib/analysis/player-props';

type PlayerSeasonAverage = {
  playerId: string;
  player: string;
  team: string;
  games: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
  pra: number;
  last5: { games: number; points: number; rebounds: number; assists: number; threes: number; pra: number };
};
type MarketPicks = { market: PlayerPropMarket; total: number; wins: number; losses: number; pushes: number; voids: number; pending: number; accuracy: number | null };
type SeasonBase = {
  season: string;
  gameCount: number;
  teamsCount: number;
  playerAppearances: number;
  playerCount: number;
  manualPicks: number;
  picksByMarket: MarketPicks[];
  players: PlayerSeasonAverage[];
};

const MARKETS: Record<PlayerPropMarket, string> = {
  player_points: 'Pontos',
  player_rebounds: 'Rebotes',
  player_assists: 'Assistências',
  player_threes: 'Cestas de 3',
  player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};

const average = (value: number) => value.toFixed(1);
const percentage = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;

export function SeasonBasePanel() {
  const [data, setData] = useState<SeasonBase | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    fetch('/api/analysis/nba/season-base', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os dados da temporada.');
        if (active) setData(body as SeasonBase);
      })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar a base.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-court-card" aria-label="Carregando base da temporada" />;
  if (error) return <div role="alert" className="space-y-3 border-y border-court-danger/40 py-5 text-sm text-court-text"><p>{error}</p><button type="button" onClick={() => { setError(''); setLoading(true); setRetry(value => value + 1); }} className="text-court-accent underline underline-offset-4">Tentar novamente</button></div>;
  if (!data || !data.gameCount) return <div className="rounded-xl border border-court-border p-5"><h2 className="font-semibold text-court-text">Ainda sem jogos importados</h2><p className="mt-2 text-sm text-court-textMuted">Depois de importar os boxscores finais, as médias da temporada e os resultados dos seus palpites aparecerão aqui.</p></div>;

  return (
    <section className="space-y-6" aria-labelledby="season-base-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-court-border pb-4">
        <div>
          <h2 id="season-base-title" className="text-xl font-semibold text-court-text">Base real · Temporada {data.season}</h2>
          <p className="mt-1 text-sm text-court-textMuted">Médias calculadas somente com partidas desta temporada e palpites que você registrou por fora.</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); setRetry(value => value + 1); }} className="btn-secondary px-3 py-2 text-xs">Atualizar dados</button>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-court-border border-y border-court-border sm:grid-cols-4 sm:divide-y-0">
        <Metric label="Partidas importadas" value={data.gameCount} />
        <Metric label="Times com jogo" value={data.teamsCount} />
        <Metric label="Jogadores com minutos" value={data.playerCount} />
        <Metric label="Palpites pessoais" value={data.manualPicks} />
      </dl>

      <section aria-labelledby="manual-picks-base-title" className="space-y-3">
        <div><h3 id="manual-picks-base-title" className="font-semibold text-court-text">Seu histórico por categoria</h3><p className="mt-1 text-xs text-court-textMuted">A taxa considera apenas acertos e erros; push e anulações ficam fora do cálculo.</p></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.picksByMarket.map(row => (
            <article key={row.market} className="rounded-lg border border-court-border bg-court-card p-3">
              <div className="flex items-start justify-between gap-3"><h4 className="text-sm font-medium text-court-text">{MARKETS[row.market]}</h4><span className="font-mono text-sm font-semibold text-[#005A9C]">{percentage(row.accuracy)}</span></div>
              <p className="mt-2 text-xs text-court-textMuted">{row.wins} acertos · {row.losses} erros · {row.pending} pendentes</p>
              <p className="mt-1 text-[11px] text-court-textMuted">{row.total} seleções registradas{row.pushes + row.voids ? ` · ${row.pushes} push · ${row.voids} anuladas` : ''}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="player-season-averages-title" className="space-y-3">
        <div><h3 id="player-season-averages-title" className="font-semibold text-court-text">Médias por jogador</h3><p className="mt-1 text-xs text-court-textMuted">Amostra mostra quantos jogos cada jogador disputou. Com poucos jogos, a média ainda pode oscilar bastante.</p></div>
        <div className="max-h-[65vh] overflow-auto rounded-xl border border-court-border">
          <table className="w-full min-w-[850px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-court-card text-court-textMuted"><tr>
              <th className="px-3 py-3 font-medium">Jogador</th><th className="px-3 py-3 font-medium">Time</th><th className="px-3 py-3 text-right font-medium">Jogos</th><th className="px-3 py-3 text-right font-medium">Min</th><th className="px-3 py-3 text-right font-medium">PTS</th><th className="px-3 py-3 text-right font-medium">REB</th><th className="px-3 py-3 text-right font-medium">AST</th><th className="px-3 py-3 text-right font-medium">3PM</th><th className="px-3 py-3 text-right font-medium">PRA</th>
            </tr></thead>
            <tbody className="divide-y divide-court-border">
              {data.players.map(player => <tr key={player.playerId} className="text-court-text">
                <td className="px-3 py-3 font-medium">{player.player}</td><td className="px-3 py-3 text-court-textMuted">{player.team}</td><td className="px-3 py-3 text-right font-mono">{player.games}</td><td className="px-3 py-3 text-right font-mono">{average(player.minutes)}</td><td className="px-3 py-3 text-right font-mono">{average(player.points)}</td><td className="px-3 py-3 text-right font-mono">{average(player.rebounds)}</td><td className="px-3 py-3 text-right font-mono">{average(player.assists)}</td><td className="px-3 py-3 text-right font-mono">{average(player.threes)}</td><td className="px-3 py-3 text-right font-mono">{average(player.pra)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="px-3 py-4"><dt className="text-xs text-court-textMuted">{label}</dt><dd className="mt-1 font-mono text-xl font-bold tabular-nums text-court-text">{value}</dd></div>;
}
