import { CalendarDays, CircleHelp, TrendingUp } from 'lucide-react';
import { formatAppDateTime } from '@/lib/utils/date';
import { SeasonPlayerPick, SeasonPickMarket } from '@/lib/analysis/season-player-picks';

const MARKET_LABELS: Record<SeasonPickMarket, string> = {
  player_points: 'Pontos',
  player_rebounds: 'Rebotes',
  player_assists: 'Assistências',
  player_threes: 'Cestas de 3',
  player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};

export function SeasonPlayerPicks({
  picks,
  gamesInWindow,
  excludedScheduledGames,
  note,
  error,
  trackedCount,
}: {
  picks: SeasonPlayerPick[];
  gamesInWindow: number;
  excludedScheduledGames: number;
  note?: string;
  error?: string;
  trackedCount?: number;
}) {
  return (
    <section aria-labelledby="season-picks-title" className="mt-10 overflow-hidden rounded-2xl border border-[#58A9E3]/50 bg-white sm:mt-14">
      <div className="flex flex-col gap-3 border-b border-[#58A9E3]/30 bg-[#EAF5FC] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <h2 id="season-picks-title" className="text-2xl font-bold text-[#005A9C] sm:text-3xl">Sinais da temporada</h2>
          <p className="mt-1 text-sm text-slate-600">Leituras simples a partir dos jogos já realizados nesta temporada.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <p className="flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />{gamesInWindow} jogos agendados nesta janela</p>
          <p>{trackedCount || 0} sinais registrados para apuração</p>
        </div>
      </div>

      {picks.length ? (
        <ul className="divide-y divide-[#58A9E3]/25 px-5 sm:px-7">
          {picks.map(pick => (
            <li key={pick.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-900">{pick.player}</span>
                  <span className="text-xs text-slate-500">{pick.team} · {MARKET_LABELS[pick.market]}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {pick.side === 'Over' ? 'Mais de' : 'Menos de'} <strong>{pick.line}</strong>
                  <span className="mx-2 text-slate-400">·</span>
                  média da temporada <strong>{pick.seasonAverage.toFixed(1)}</strong>
                  <span className="mx-2 text-slate-400">·</span>
                  últimos 5 <strong>{pick.last5Average.toFixed(1)}</strong>
                </p>
                <p className="mt-1 text-xs text-slate-500">{pick.game} · {formatAppDateTime(pick.commenceTime)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#58A9E3]/50 bg-[#F3F9FD] px-3 py-1.5 text-xs font-semibold text-[#005A9C]">
                  <TrendingUp size={14} aria-hidden="true" />
                  {pick.hits}/{pick.sampleSize} jogos nessa direção
                </span>
                <span className="whitespace-nowrap text-xs text-slate-500" title="Resultados dos seus palpites registrados neste mercado">
                  Seu histórico: {pick.personalRecord.wins}-{pick.personalRecord.losses}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-8 text-sm text-slate-600 sm:px-7">
          {error || (gamesInWindow === 0
            ? 'Não há jogos agendados nessa janela no banco de dados.'
            : 'Ainda não há sinais “Mais de” com amostra e tendência suficientes. O jogador precisa ter pelo menos 2 jogos importados antes da partida.')}
        </div>
      )}

      <p className="flex items-start gap-2 border-t border-[#58A9E3]/25 px-5 py-3 text-xs leading-5 text-slate-500 sm:px-7">
        <CircleHelp size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        {note || 'Cada jogo pode ter até um sinal por mercado; o mesmo atleta pode aparecer em mercados diferentes. A frequência é observada, não é probabilidade calibrada, e a linha é uma referência estatística, não cotação de uma casa.'}
        {excludedScheduledGames > 0 && ` ${excludedScheduledGames} jogo(s) sem base atual suficiente foram omitidos.`}
      </p>
    </section>
  );
}
