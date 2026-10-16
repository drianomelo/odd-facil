'use client';

import { useState } from 'react';
import { BetSelection, buildSuggestedTickets } from '@/lib/analysis/bet-builder';
import { PlayerPropMarket } from '@/lib/analysis/player-props';
import { PlayerAvatar } from '@/components/PlayerAvatar';

const MARKET_LABELS: Record<PlayerPropMarket, string> = {
  player_points: 'Pontos',
  player_rebounds: 'Rebotes',
  player_assists: 'Assistências',
  player_threes: 'Cestas de 3',
  player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};

export function SuggestedTickets({ tickets, saveEnabled = true }: { tickets: ReturnType<typeof buildSuggestedTickets>; saveEnabled?: boolean }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [returns, setReturns] = useState<Record<string, string>>({});

  async function saveTicket(ticket: ReturnType<typeof buildSuggestedTickets>[number]) {
    if (!(Number(stakes[ticket.id]) > 0)) {
      setMessage({ id: ticket.id, text: 'Informe quanto você apostou para registrar este bilhete.', error: true });
      return;
    }
    setSaving(ticket.id);
    setMessage(null);
    try {
      const response = await fetch('/api/analysis/nba/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: ticket.id,
          label: ticket.label,
          bookmaker: ticket.bookmaker,
          stakeAmount: Number(stakes[ticket.id]),
          ...(returns[ticket.id] !== undefined && returns[ticket.id] !== '' ? { potentialReturn: Number(returns[ticket.id]) } : {}),
          legs: ticket.selections.map(leg => ({
            eventId: leg.gameId,
            player: leg.player,
            market: leg.market,
            line: leg.line,
            side: leg.side,
            bookmaker: leg.quote.bookmaker,
            bookmakerKey: leg.quote.bookmakerKey,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar o bilhete.');
      setSaved(current => current.includes(ticket.id) ? current : [...current, ticket.id]);
      setMessage({ id: ticket.id, text: 'Salvo no Histórico para acompanhar cada palpite e o resultado do bilhete.' });
    } catch (error) {
      setMessage({ id: ticket.id, text: error instanceof Error ? error.message : 'Falha ao salvar o bilhete.', error: true });
    } finally {
      setSaving(null);
    }
  }

  return (
    <section id="daily-tickets" aria-labelledby="suggested-tickets-heading" className="scroll-mt-6 space-y-3 rounded-xl border border-court-accent/30 bg-court-card p-4 sm:p-5">
      <div>
        <h3 id="suggested-tickets-heading" className="text-base font-semibold text-court-text">Bilhetes sugeridos</h3>
        <p className="mt-1 text-xs leading-5 text-court-textMuted">Seleções filtradas por amostra, estabilidade de minutos, cotação e EV experimental positivo. Ainda não há validação histórica do modelo.</p>
      </div>
      {tickets.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {tickets.map(ticket => (
            <article key={ticket.id} className="rounded-lg border border-court-border bg-court-surface/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-court-text">{ticket.label}</h4>
                  <p className="mt-1 text-xs text-court-textMuted">Odd combinada: {ticket.combinedDecimalOdds.toFixed(2)} ({ticket.combinedAmericanOdds > 0 ? '+' : ''}{ticket.combinedAmericanOdds})</p>
                  <p className="mt-1 text-xs font-medium text-court-textMuted">Casa para todas as seleções: {ticket.bookmaker}</p>
                </div>
                <span className="rounded bg-court-warning/15 px-2 py-1 text-[11px] text-court-warning">Experimental</span>
              </div>
              <div className="mt-3 divide-y divide-court-border">
                {ticket.selections.map(leg => <TicketSelection key={leg.id} leg={leg} />)}
              </div>
              <p className="mt-3 text-xs leading-5 text-court-textMuted">
                {ticket.estimatedProbability === null
                  ? ticket.warning
                  : `Chance estimada pelo modelo para a seleção: ${(ticket.estimatedProbability * 100).toFixed(1)}%.`}
              </p>
              {saveEnabled && (
                <div className="mt-4 border-t border-court-border pt-3">
                  <label className="mb-3 block text-xs text-court-textMuted">
                    Valor apostado (R$)
                    <input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" placeholder="Ex.: 10,00" value={stakes[ticket.id] || ''} onChange={event => setStakes(current => ({ ...current, [ticket.id]: event.target.value }))} className="input mt-1 py-2 text-sm" />
                  </label>
                  <label className="mb-3 block text-xs text-court-textMuted">
                    Retorno potencial (R$) · opcional para bônus
                    <input type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" placeholder={(Number(stakes[ticket.id] || 0) * ticket.combinedDecimalOdds).toFixed(2)} value={returns[ticket.id] || ''} onChange={event => setReturns(current => ({ ...current, [ticket.id]: event.target.value }))} className="input mt-1 py-2 text-sm" />
                  </label>
                  <button type="button" disabled={saving === ticket.id || saved.includes(ticket.id) || !(Number(stakes[ticket.id]) > 0)} onClick={() => void saveTicket(ticket)} className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60">
                    {saving === ticket.id ? 'Salvando…' : saved.includes(ticket.id) ? 'Salvo no Histórico' : 'Salvar para acompanhar'}
                  </button>
                  {message?.id === ticket.id && <p role={message.error ? 'alert' : 'status'} className={`mt-2 text-xs ${message.error ? 'text-court-danger' : 'text-court-success'}`}>{message.text}</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-court-border p-4 text-sm text-court-textMuted">Nenhum palpite de hoje passou pelos filtros de qualidade com cotação disponível. Isso pode acontecer; não forçamos uma sugestão só para preencher a tela.</p>
      )}
    </section>
  );
}

function TicketSelection({ leg }: { leg: BetSelection }) {
  const marketLabel = MARKET_LABELS[leg.market];
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <PlayerAvatar name={leg.player} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-court-text">{leg.player} · {marketLabel} {leg.side === 'Over' ? 'Mais de' : 'Menos de'} {leg.line}</span>
          <span className="font-mono text-court-text">{leg.quote.price > 0 ? '+' : ''}{leg.quote.price}</span>
        </div>
        <p className="mt-1 text-xs text-court-textMuted">{leg.game} · {leg.quote.bookmaker} · chance individual {Math.round(leg.probability * 100)}% · amostra {leg.sampleSize} jogos</p>
      </div>
    </div>
  );
}
