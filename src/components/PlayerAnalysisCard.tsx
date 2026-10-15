'use client';

import { formatAppDateTime } from '@/lib/utils/date';
import { PlayerPropCandidate, PlayerPropMarket } from '@/lib/analysis/player-props';
import { PlayerAvatar } from '@/components/PlayerAvatar';

const MARKET_LABELS: Record<PlayerPropMarket, string> = {
  player_points: 'Pontos',
  player_rebounds: 'Rebotes',
  player_assists: 'Assistências',
  player_threes: 'Cestas de 3',
  player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};

export function PlayerAnalysisCard({ pick, selected = false, disabled = false, onToggle }: {
  pick: PlayerPropCandidate;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: (pick: PlayerPropCandidate) => void;
}) {
  const side = pick.recommendationSide || 'Over';
  const isOver = side === 'Over';
  const probability = isOver ? pick.probabilityOver : pick.probabilityUnder;
  const marketProbability = isOver ? pick.marketProbabilityOver : pick.marketProbabilityUnder;
  const edge = isOver ? pick.edge : pick.edgeUnder;
  const expectedValue = isOver ? pick.expectedValue : pick.expectedValueUnder;
  const price = isOver ? pick.bestOver : pick.bestUnder;
  const comparison = pick.projection - pick.line;
  const recentAverage = pick.last5Average - pick.line;
  const projectionGap = Math.abs(comparison);
  const alignedWithRecentForm = comparison === 0 || (comparison > 0) === (recentAverage > 0);

  const interpretation = projectionGap < 0.5
    ? 'A projeção está praticamente em cima da linha; a chance pode depender de poucos minutos ou posses.'
    : `${side === 'Over' ? 'A projeção fica acima' : 'A projeção fica abaixo'} da linha por ${projectionGap.toFixed(1)} ${MARKET_LABELS[pick.market].toLowerCase()}.`;

  return (
    <article className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar name={pick.player} size="lg" />
          <div className="min-w-0">
            <p className="text-xs text-court-textMuted">{pick.game} · {formatAppDateTime(pick.commenceTime)}</p>
            <h4 className="mt-1 font-semibold text-court-text">{pick.player}</h4>
            <p className="text-sm text-court-textMuted">{MARKET_LABELS[pick.market]} · {side} {pick.line}</p>
          </div>
        </div>
        <span className={`badge ${pick.shortlistEligible ? 'badge-success' : 'badge-warning'}`}>
          {pick.shortlistEligible ? 'Candidato para validação' : !pick.teamVerified ? 'Exploratório · time não confirmado' : pick.sampleSize < 15 ? 'Exploratório · amostra curta' : 'Exploratório · minutos instáveis'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 border-y border-court-border py-3 text-center">
        <div><p className="text-xs text-court-textMuted">Projeção</p><p className="font-mono font-semibold text-court-text">{pick.projection.toFixed(1)}</p></div>
        <div><p className="text-xs text-court-textMuted">Chance modelo</p><p className="font-mono font-semibold text-court-text">{(probability * 100).toFixed(0)}%</p></div>
        <div><p className="text-xs text-court-textMuted">Edge / EV</p><p className="font-mono font-semibold text-court-text">{edge === undefined ? '—' : `${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(1)} p.p.`}</p></div>
      </div>
      <div className="space-y-1 text-xs text-court-textMuted">
        <p>Mercado sem margem: {marketProbability === undefined ? 'indisponível' : `${(marketProbability * 100).toFixed(1)}%`} · EV experimental: {expectedValue === undefined ? '—' : `${(expectedValue * 100).toFixed(1)}%`}</p>
        <p>Melhor odd: {price ? `${price.bookmaker} (${price.price > 0 ? '+' : ''}${price.price})` : 'sem cotação pareada'}</p>
        <p>Adversário: {pick.teamVerified ? `${pick.opponent} · time confirmado` : 'não confirmado pelo histórico'}</p>
        <p>Amostra: {pick.sampleSize} jogos · confiança {pick.confidence} · L5 {pick.last5Average.toFixed(1)} · L10 {pick.last10Average.toFixed(1)} · L20 {pick.last20Average.toFixed(1)}</p>
      </div>
      <div className="rounded-lg border border-court-border bg-court-surface/60 p-3 text-sm">
        <p className="font-medium text-court-text">Leitura do palpite</p>
        <p className="mt-1 text-xs leading-5 text-court-textMuted">{interpretation}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-court-success">Sinais a favor</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-court-textMuted">
              <li>A média dos últimos 5 jogos ficou {recentAverage >= 0 ? 'acima' : 'abaixo'} da linha por {Math.abs(recentAverage).toFixed(1)}.</li>
              {alignedWithRecentForm
                ? <li>A projeção e a média recente apontam para o mesmo lado da linha.</li>
                : <li>A projeção diverge da média dos últimos 5; a tendência recente não confirma o lado.</li>}
              {edge !== undefined
                ? <li>Chance estimada {edge >= 0 ? 'supera' : 'fica abaixo'} do mercado sem margem em {Math.abs(edge * 100).toFixed(1)} pontos percentuais.</li>
                : <li>Não há mercado sem margem calculável para comparar a chance estimada.</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-court-warning">Pontos de atenção</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-court-textMuted">
              <li>Variação recente: L5 {pick.last5Average.toFixed(1)}, L10 {pick.last10Average.toFixed(1)} e L20 {pick.last20Average.toFixed(1)}.</li>
              {pick.minutesTrend === undefined
                ? <li>Tendência de minutos indisponível.</li>
                : <li>Minutos recentes {pick.minutesTrend >= 1 ? 'subiram' : 'caíram'} {Math.abs((pick.minutesTrend - 1) * 100).toFixed(0)}% contra a média da amostra.</li>}
              {pick.opponentAverage === undefined
                ? <li>Sem amostra direta suficiente contra este adversário para ajustar o confronto.</li>
                : <li>Média contra o adversário: {pick.opponentAverage.toFixed(1)} em até 20 jogos recentes.</li>}
            </ul>
          </div>
        </div>
      </div>
      <details className="text-xs text-court-textMuted">
        <summary className="cursor-pointer font-medium text-court-text">Ver cálculos e limitações do modelo</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {pick.reasons.map(reason => <li key={reason}>{reason}</li>)}
          {pick.limitations.map(limitation => <li key={limitation}>{limitation}</li>)}
        </ul>
      </details>
      {onToggle && (
        <button type="button" disabled={disabled && !selected} onClick={() => onToggle(pick)} className={`${selected ? 'btn-ghost border border-court-border' : 'btn-secondary'} w-full justify-center px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50`}>
          {selected ? 'Remover do meu bilhete' : disabled ? 'Limite de 10 seleções' : 'Adicionar ao meu bilhete'}
        </button>
      )}
    </article>
  );
}
