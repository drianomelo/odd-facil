'use client';

import { useMemo, useState } from 'react';
import { PlayerAnalysisCard } from '@/components/PlayerAnalysisCard';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TeamLogo, TeamMatchup } from '@/components/TeamLogo';
import { PlayerPropCandidate, PlayerPropMarket, PlayerPropQuote } from '@/lib/analysis/player-props';

const MARKET_LABELS: Record<PlayerPropMarket, string> = {
  player_points: 'Pontos',
  player_rebounds: 'Rebotes',
  player_assists: 'Assistências',
  player_threes: 'Cestas de 3',
  player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};

type Group = {
  market: PlayerPropMarket;
  totalCount: number;
  eligibleCount: number;
  picks: PlayerPropCandidate[];
  performance?: { settled: number; wins: number; losses: number; pushes: number; pending: number };
};

type BookOption = { key: string; name: string; prices: number[]; decimalOdds: number };

function bookKey(quote: PlayerPropQuote) {
  return quote.bookmakerKey || quote.bookmaker.trim().toLowerCase();
}

function sideQuote(pick: PlayerPropCandidate) {
  const side = pick.recommendationSide || 'Over';
  const quotes = pick.quotes.filter(quote => quote.side === side);
  return quotes.length ? quotes : [side === 'Over' ? pick.bestOver : pick.bestUnder].filter((quote): quote is PlayerPropQuote => !!quote);
}

function americanToDecimal(price: number) {
  return price > 0 ? 1 + price / 100 : 1 + 100 / Math.abs(price);
}

export function PlayerAnalysisBoard({ groups, saveEnabled = true }: { groups: Group[]; saveEnabled?: boolean }) {
  const candidates = groups.flatMap(group => group.picks);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bookmaker, setBookmaker] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [potentialReturn, setPotentialReturn] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const selected = candidates.filter(pick => selectedIds.includes(pick.id));

  const books = useMemo(() => {
    if (!selected.length) return [];
    const quoteMaps = selected.map(pick => new Map(sideQuote(pick).map(quote => [bookKey(quote), quote])));
    return Array.from(quoteMaps[0].keys()).filter(key => quoteMaps.every(map => map.has(key))).map(key => {
      const quotes = quoteMaps.map(map => map.get(key)!);
      return {
        key,
        name: quotes[0].bookmaker,
        prices: quotes.map(quote => quote.price),
        decimalOdds: quotes.reduce((product, quote) => product * americanToDecimal(quote.price), 1),
      };
    }).sort((a, b) => b.decimalOdds - a.decimalOdds);
  }, [selected]);

  const selectedBook = books.find(book => book.key === bookmaker) || books[0];
  const sameGame = new Set(selected.map(pick => pick.gameId)).size !== selected.length;

  function togglePick(pick: PlayerPropCandidate) {
    setFeedback(null);
    setSaved(false);
    setSelectedIds(current => current.includes(pick.id)
      ? current.filter(id => id !== pick.id)
      : current.length < 10 ? [...current, pick.id] : current);
    setExpanded(true);
  }

  async function saveTicket() {
    if (!selected.length || !selectedBook || saving) return;
    if (!(Number(stakeAmount) > 0)) {
      setFeedback({ text: 'Informe quanto você apostou para registrar este bilhete.', error: true });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/analysis/nba/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'custom',
          label: `Meu bilhete (${selected.length} ${selected.length === 1 ? 'palpite' : 'palpites'})`,
          bookmaker: selectedBook.name,
          stakeAmount: Number(stakeAmount),
          ...(Number(potentialReturn) >= 0 && potentialReturn !== '' ? { potentialReturn: Number(potentialReturn) } : {}),
          legs: selected.map((pick, index) => ({
            eventId: pick.gameId,
            player: pick.player,
            market: pick.market,
            line: pick.line,
            side: pick.recommendationSide || 'Over',
            bookmaker: sideQuote(pick).find(quote => bookKey(quote) === selectedBook.key)?.bookmaker || selectedBook.name,
            bookmakerKey: selectedBook.key,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar o bilhete.');
      setSaved(true);
      setFeedback({ text: 'Bilhete salvo no Histórico para acompanhar os palpites e os resultados.' });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'Falha ao salvar o bilhete.', error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section aria-labelledby="custom-ticket-heading" className="space-y-3">
        <div>
          <h3 id="custom-ticket-heading" className="text-base font-semibold text-[#005A9C]">Monte seu bilhete pelos palpites do radar</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Use o botão no fim de cada análise detalhada. Depois confira as seleções e a casa no carrinho antes de salvar.</p>
        </div>
        <div className="space-y-5">
          {groups.map(group => (
            <section key={group.market} aria-label={`Análise de ${MARKET_LABELS[group.market]}`} className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="font-semibold text-court-text">{MARKET_LABELS[group.market]}</h4>
                  <p className="text-xs text-court-textMuted">{group.totalCount} props analisadas · {group.eligibleCount} candidatas para validação · destaque ordenado por qualidade dos dados, EV experimental e diferença do mercado</p>
                </div>
                <p className="text-xs text-court-textMuted">
                  {group.performance?.settled
                    ? `Histórico: ${group.performance.wins}-${group.performance.losses}-${group.performance.pushes} · ${group.performance.pending} pendentes`
                    : `Histórico da versão atual: sem jogos apurados · ${group.performance?.pending ?? 0} pendentes`}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {group.picks.map(pick => (
                  <PlayerAnalysisCard
                    key={pick.id}
                    pick={pick}
                    selected={selectedIds.includes(pick.id)}
                    disabled={selectedIds.length >= 10}
                    onToggle={togglePick}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {saveEnabled && selected.length > 0 && (
        <aside aria-label="Carrinho do meu bilhete" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl overflow-hidden rounded-2xl border border-[#58A9E3]/70 bg-white shadow-2xl shadow-[#005A9C]/20 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(30rem,calc(100vw-3rem))]">
          <div className="flex items-center justify-between border-b border-court-border px-4 py-3">
            <div>
              <h3 className="font-semibold text-court-text">Meu bilhete · {selected.length}/10</h3>
              <p className="text-xs text-court-textMuted">Revise suas seleções antes de salvar</p>
            </div>
            <button type="button" className="btn-ghost px-3 py-2 text-xs" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Recolher' : 'Abrir'}</button>
          </div>
          {expanded && (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4">
              <ol className="space-y-2">
                {selected.map((pick, index) => {
                  const quote = sideQuote(pick).find(item => bookKey(item) === selectedBook?.key);
                  return (
                    <li key={pick.id} className="flex items-start justify-between gap-3 rounded-lg border border-court-border bg-court-surface/60 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <PlayerAvatar name={pick.player} size="sm" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 text-sm font-medium text-court-text">{index + 1}. {pick.player}<TeamLogo team={pick.team} size="xs" /> · {MARKET_LABELS[pick.market]} {pick.recommendationSide === 'Under' ? 'Menos de' : 'Mais de'} {pick.line}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-court-textMuted">{pick.awayTeam && pick.homeTeam ? <TeamMatchup away={pick.awayTeam} home={pick.homeTeam} /> : pick.game} · {quote ? `${quote.price > 0 ? '+' : ''}${quote.price}` : 'sem cotação nesta casa'}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => togglePick(pick)} className="shrink-0 text-xs font-medium text-court-danger hover:underline">Remover</button>
                    </li>
                  );
                })}
              </ol>

              {books.length ? (
                <label className="block text-xs text-court-textMuted">
                  Casa disponível para todas as seleções
                  <select value={selectedBook?.key} onChange={event => setBookmaker(event.target.value)} className="mt-1 w-full rounded-lg border border-court-border bg-court-surface px-3 py-2 text-sm text-court-text">
                    {books.map(book => <option key={book.key} value={book.key}>{book.name}</option>)}
                  </select>
                </label>
              ) : <p className="rounded-lg border border-court-warning/30 bg-court-warning/10 p-3 text-xs text-court-warning">As seleções precisam ter cotações da mesma casa. Remova alguma seleção para encontrar uma casa em comum.</p>}

              {selectedBook && (sameGame
                ? <p className="text-xs leading-5 text-court-warning">Há seleções da mesma partida. A odd conjunta depende de uma cotação específica da casa e não será estimada aqui.</p>
                : <p className="text-xs text-court-textMuted">Odd combinada estimada: <span className="font-mono font-semibold text-court-text">{selectedBook.decimalOdds.toFixed(2)}</span></p>)}
              <label className="block text-xs text-court-textMuted">
                Valor apostado (R$)
                <input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" value={stakeAmount} onChange={event => setStakeAmount(event.target.value)} placeholder="Ex.: 10,00" className="mt-1 w-full rounded-lg border border-court-border bg-court-surface px-3 py-2 text-sm text-court-text" />
              </label>
              <label className="block text-xs text-court-textMuted">
                Retorno potencial (R$) · opcional para bônus
                <input type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" value={potentialReturn} onChange={event => setPotentialReturn(event.target.value)} placeholder={selectedBook && !sameGame && Number(stakeAmount) > 0 ? (Number(stakeAmount) * selectedBook.decimalOdds).toFixed(2) : 'Informe se a casa mostrar'} className="mt-1 w-full rounded-lg border border-court-border bg-court-surface px-3 py-2 text-sm text-court-text" />
              </label>
              {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-xs ${feedback.error ? 'text-court-danger' : 'text-court-success'}`}>{feedback.text}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={!selectedBook || !(Number(stakeAmount) > 0) || saving || saved} onClick={() => void saveTicket()} className="btn-primary flex-1 justify-center px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? 'Salvando…' : saved ? 'Salvo no Histórico' : 'Salvar bilhete'}
                </button>
                <button type="button" onClick={() => { setSelectedIds([]); setBookmaker(''); setFeedback(null); setSaved(false); setStakeAmount(''); setPotentialReturn(''); }} className="btn-ghost px-3 py-2 text-sm">Limpar</button>
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
