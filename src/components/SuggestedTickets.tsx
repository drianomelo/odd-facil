'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Ticket } from 'lucide-react';
import { BetSelection, buildSuggestedTickets } from '@/lib/analysis/bet-builder';
import { PlayerPropMarket } from '@/lib/analysis/player-props';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TeamMatchup } from '@/components/TeamLogo';

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
    <section id="daily-tickets" aria-labelledby="suggested-tickets-heading" className="scroll-mt-6 overflow-hidden rounded-2xl border border-[#005a9c]/25 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#005a9c]/20 bg-gradient-to-r from-[#eaf5fc] via-white to-[#eaf5fc] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#005a9c]/25 bg-[#eaf5fc] text-[#005a9c]">
            <Ticket aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 id="suggested-tickets-heading" className="text-base font-bold text-[#005a9c]">Bilhetes sugeridos</h3>
            <p className="mt-0.5 text-xs leading-5 text-slate-600">A ordem prioriza vantagem estimada sobre o mercado, EV positivo e amostra. Depois, cada palpite recebe sua melhor odd disponível, mesmo que as casas sejam diferentes.</p>
          </div>
        </div>
        <span className="rounded-full border border-[#005a9c]/25 bg-white px-3 py-1 text-[11px] font-semibold text-[#005a9c]">
          {tickets.length} {tickets.length === 1 ? 'opção' : 'opções'}
        </span>
      </header>

      <div className="p-3 sm:p-4">
        {tickets.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {tickets.map(ticket => {
              const isExaggerated = ticket.id === 'exaggerated';
              return (
                <article key={ticket.id} className={`overflow-hidden rounded-xl border bg-white ${isExaggerated ? 'border-[#ed174b]/40' : 'border-[#005a9c]/20'}`}>
                  <div className={`flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 ${isExaggerated ? 'border-[#ed174b]/20 bg-gradient-to-r from-[#fff0f3] to-white' : 'border-[#005a9c]/15 bg-[#f4fafe]'}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-court-text">{ticket.label}</h4>
                        {isExaggerated && <span className="inline-flex items-center gap-1 rounded-full bg-[#ed174b]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#b3133b]"><AlertTriangle aria-hidden="true" className="h-3 w-3" /> Alto risco</span>}
                      </div>
                      <p className="mt-1 text-xs text-court-textMuted">{ticket.selections.length} {ticket.selections.length === 1 ? 'palpite' : 'palpites'} · {ticket.bookmaker}</p>
                    </div>
                    <div className="rounded-lg border border-[#005a9c]/20 bg-white px-3 py-2 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-court-textMuted">Odd combinada</p>
                      <p className="font-mono text-lg font-bold leading-tight tabular-nums text-[#005a9c]">{ticket.combinedDecimalOdds.toFixed(2)}</p>
                      <p className="font-mono text-[10px] text-court-textMuted">{ticket.combinedAmericanOdds > 0 ? '+' : ''}{ticket.combinedAmericanOdds}</p>
                    </div>
                  </div>

                  <ol className="divide-y divide-[#f1e7ea] px-4">
                    {ticket.selections.map((leg, index) => <TicketSelection key={leg.id} leg={leg} index={index} />)}
                  </ol>

                  <div className="mx-4 mt-3 rounded-lg bg-[#f8fafc] px-3 py-2.5 text-xs leading-5 text-court-textMuted">
                    {ticket.estimatedProbability === null ? ticket.warning : <>Chance estimada para o bilhete: <strong className="font-mono text-court-text">{(ticket.estimatedProbability * 100).toFixed(1)}%</strong></>}
                    <span className="mt-0.5 block text-[11px]">Estimativa experimental; ainda sem validação histórica do modelo.</span>
                  </div>

                  {saveEnabled && (
                    <div className="p-4 pt-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-medium text-court-textMuted">
                          Valor apostado (R$)
                          <input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" placeholder="Ex.: 10,00" value={stakes[ticket.id] || ''} onChange={event => setStakes(current => ({ ...current, [ticket.id]: event.target.value }))} className="input mt-1.5 py-2 text-sm" />
                        </label>
                        <label className="block text-xs font-medium text-court-textMuted">
                          Retorno potencial (R$)
                          <input type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" placeholder={(Number(stakes[ticket.id] || 0) * ticket.combinedDecimalOdds).toFixed(2)} value={returns[ticket.id] || ''} onChange={event => setReturns(current => ({ ...current, [ticket.id]: event.target.value }))} className="input mt-1.5 py-2 text-sm" />
                        </label>
                      </div>
                      <p className="mt-1.5 text-[10px] text-court-textMuted">Opcional: ajuste o retorno se a casa oferecer bônus.</p>
                      <button type="button" disabled={saving === ticket.id || saved.includes(ticket.id) || !(Number(stakes[ticket.id]) > 0)} onClick={() => void saveTicket(ticket)} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#006BB6] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005a9c] focus:outline-none focus:ring-2 focus:ring-[#006BB6]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        {saved.includes(ticket.id) ? <Check aria-hidden="true" className="h-4 w-4" /> : <Ticket aria-hidden="true" className="h-4 w-4" />}
                        {saving === ticket.id ? 'Salvando…' : saved.includes(ticket.id) ? 'Salvo no Histórico' : 'Salvar como aposta'}
                      </button>
                      {message?.id === ticket.id && <p role={message.error ? 'alert' : 'status'} className={`mt-2 text-xs ${message.error ? 'text-court-danger' : 'text-court-success'}`}>{message.text}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#005a9c]/30 bg-[#f4fafe] px-5 py-8 text-center">
            <Ticket aria-hidden="true" className="mx-auto h-7 w-7 text-[#005a9c]/60" />
            <h4 className="mt-2 text-sm font-semibold text-court-text">Nenhum bilhete disponível agora</h4>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-court-textMuted">Nenhum palpite de hoje passou pelos filtros com cotação disponível. A lista será preenchida quando houver opções que atendam aos critérios.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function TicketSelection({ leg, index }: { leg: BetSelection; index: number }) {
  const marketLabel = MARKET_LABELS[leg.market];
  return (
    <li className="flex items-start gap-3 py-3 first:pt-4 last:pb-4">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf5fc] font-mono text-[10px] font-bold text-[#005a9c]">{index + 1}</span>
      <PlayerAvatar name={leg.player} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-court-text">{leg.player}</p>
            <p className="text-xs text-court-textMuted">{marketLabel} · {leg.side === 'Over' ? 'Mais de' : 'Menos de'} <span className="font-mono font-semibold text-court-text">{leg.line}</span></p>
          </div>
          <span className="shrink-0 rounded-md border border-court-border bg-white px-2 py-1 font-mono text-xs font-semibold text-court-text">{leg.quote.price > 0 ? '+' : ''}{leg.quote.price}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-court-textMuted">
          {leg.awayTeam && leg.homeTeam ? <TeamMatchup away={leg.awayTeam} home={leg.homeTeam} /> : <span>{leg.game}</span>}
          <span aria-hidden="true">·</span><span>{Math.round(leg.probability * 100)}% chance individual</span>
          <span aria-hidden="true">·</span><span>Amostra: {leg.sampleSize} jogos</span>
        </div>
      </div>
    </li>
  );
}
