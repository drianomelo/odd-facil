'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Filter, RotateCcw } from 'lucide-react';
import { formatAppDateTime } from '@/lib/utils/date';
import { PlayerPropMarket } from '@/lib/analysis/player-props';
import { getTicketOutcome } from '@/lib/analysis/ticket-result';
import { getNbaSeasonPhase } from '@/lib/analysis/nba-season';
import { ManualTicketForm } from './ManualTicketForm';
import { SeasonPickTracking } from '@/components/SeasonPickTracking';

type ForecastResult = 'pending' | 'won' | 'lost' | 'push' | 'void';
type SeasonPhase = 'preseason' | 'regular';
type HistoryFilters = { result: string; market: string; phase: string; from: string; to: string };
type Forecast = {
  id: string;
  eventId: string;
  player: string;
  playerTeam?: string | null;
  market: PlayerPropMarket;
  line: number;
  selection: 'Over' | 'Under';
  projection: number;
  predictedProbability: number;
  americanOdds: number | null;
  bookmaker: string | null;
  confidence: string;
  sampleSize: number;
  commenceTime: string;
  recordedAt: string;
  actualValue: number | null;
  result: ForecastResult;
  gradedAt: string | null;
  game: string | null;
  seasonPhase: SeasonPhase;
  marketMovement?: {
    status: 'closed' | 'available' | 'unavailable' | 'unconfigured';
    sameBookmaker?: boolean;
    currentLine?: number;
    currentAmericanOdds?: number;
    currentBookmaker?: string;
    lineChanged?: boolean;
    oddsChanged?: boolean | null;
  };
};
type SavedTicketLeg = { position: number; player: string; playerTeam?: string | null; market: PlayerPropMarket; line: number; selection: 'Over' | 'Under'; americanOdds: number | null; bookmaker: string; result: ForecastResult; actualValue: number | null; commenceTime: string | null };
type SavedTicket = { id: string; source: string; label: string; bookmaker: string; combinedDecimalOdds: number | null; combinedAmericanOdds: number | null; stakeAmount: number; potentialReturn: number | null; actualReturn: number | null; manualOutcome: 'won' | 'lost' | 'push/void' | null; outcomeSource: 'manual' | 'boxscore' | 'forecast'; createdAt: string; outcome: 'pending' | 'won' | 'lost' | 'push/void'; legs: SavedTicketLeg[] };
type HistoryResponse = {
  page: { limit: number; offset: number; total: number };
  summary: { total: number; pending: number; won: number; lost: number; push: number; void: number; preseason: number; regular: number };
  forecasts: Forecast[];
};

const DEFAULT_FILTERS: HistoryFilters = { result: 'all', market: 'all', phase: 'regular', from: '', to: '' };

const MARKET_LABELS: Record<PlayerPropMarket, string> = {
  player_points: 'Pontos',
  player_rebounds: 'Rebotes',
  player_assists: 'Assistências',
  player_threes: 'Cestas de 3',
  player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};

const RESULT_LABELS: Record<ForecastResult, string> = {
  pending: 'Pendente',
  won: 'Acertou',
  lost: 'Errou',
  push: 'Push',
  void: 'Anulada',
};

const RESULT_STYLES: Record<ForecastResult, string> = {
  pending: 'bg-court-warning/15 text-court-warning',
  won: 'bg-court-success/15 text-court-success',
  lost: 'bg-court-danger/15 text-court-danger',
  push: 'bg-court-accent/15 text-court-accent',
  void: 'bg-court-border text-court-textMuted',
};

function formatOdds(price: number | null): string {
  if (price === null) return 'Sem cotação';
  return price > 0 ? `+${price}` : String(price);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function buildQuery(filters: HistoryFilters, offset = 0): string {
  const params = new URLSearchParams({ limit: '30', offset: String(offset) });
  if (filters.result !== 'all') params.set('result', filters.result);
  if (filters.market !== 'all') params.set('market', filters.market);
  if (filters.phase !== 'all') params.set('phase', filters.phase);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

export function HistoryContent({ initialPhase = 'all' }: { initialPhase?: string }) {
  const initialFilters = { ...DEFAULT_FILTERS, phase: initialPhase };
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [rows, setRows] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'predictions' | 'seasonPicks' | 'bets'>('predictions');

  const load = useCallback(async (filters: HistoryFilters, offset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/analysis/nba/history?${buildQuery(filters, offset)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar as previsões.');
      setData(body as HistoryResponse);
      setRows(current => append ? [...current, ...(body.forecasts as Forecast[])] : body.forecasts as Forecast[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar o histórico.');
      if (!append) setRows([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(appliedFilters, 0, false);
  }, [appliedFilters, load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({ ...draftFilters });
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters({ ...DEFAULT_FILTERS });
  }

  const summary = data?.summary;
  return (
    <section className="space-y-6" aria-labelledby="history-title">
      <div className="flex flex-col gap-2 border-b border-court-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="history-title" className="text-2xl font-bold text-court-text sm:text-3xl">Histórico</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-court-textMuted">
            Consulte o desempenho das previsões do sistema e controle suas apostas pessoais em áreas separadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4"><Link href="/times" className="btn-secondary px-3 py-2 text-sm">Desempenho por time</Link><div className="flex items-center gap-2 text-sm text-court-textMuted" aria-live="polite">
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
          <span>{activeTab === 'predictions' ? summary ? `${summary.total} previsões registradas` : 'Carregando previsões' : activeTab === 'seasonPicks' ? 'Sinais da temporada atual' : 'Controle de apostas pessoais'}</span>
        </div></div>
      </div>

      <div className="flex gap-2 border-b border-court-border" role="tablist" aria-label="Tipo de histórico">
        <button type="button" role="tab" aria-selected={activeTab === 'predictions'} onClick={() => setActiveTab('predictions')} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === 'predictions' ? 'border-court-accent text-court-text' : 'border-transparent text-court-textMuted'}`}>Previsões do sistema</button>
        <button type="button" role="tab" aria-selected={activeTab === 'seasonPicks'} onClick={() => setActiveTab('seasonPicks')} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === 'seasonPicks' ? 'border-court-accent text-court-text' : 'border-transparent text-court-textMuted'}`}>Sinais da temporada</button>
        <button type="button" role="tab" aria-selected={activeTab === 'bets'} onClick={() => setActiveTab('bets')} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === 'bets' ? 'border-court-accent text-court-text' : 'border-transparent text-court-textMuted'}`}>Apostas pessoais</button>
      </div>

      {activeTab === 'seasonPicks' ? <SeasonPickTracking mode="history" /> : null}
      {activeTab === 'predictions' ? <>
      {summary && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-court-border pb-4 text-sm" aria-label="Resumo do histórico">
          <span><strong className="text-court-text">{summary.pending}</strong> <span className="text-court-textMuted">pendentes</span></span>
          <span><strong className="text-court-success">{summary.won}</strong> <span className="text-court-textMuted">acertos</span></span>
          <span><strong className="text-court-danger">{summary.lost}</strong> <span className="text-court-textMuted">erros</span></span>
          <span><strong className="text-court-text">{summary.push}</strong> <span className="text-court-textMuted">push</span></span>
          <span><strong className="text-court-textMuted">{summary.void}</strong> <span className="text-court-textMuted">anuladas</span></span>
          <span className="basis-full text-xs text-court-textMuted sm:basis-auto sm:border-l sm:border-court-border sm:pl-4">
            Temporada regular: {summary.regular} · Pré-temporada: {summary.preseason}
          </span>
        </div>
      )}

      <form onSubmit={applyFilters} className="rounded-xl border border-court-border bg-court-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-court-accent/10 p-2 text-court-accent"><Filter aria-hidden="true" className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-semibold text-court-text">Filtrar previsões</h3>
              <p className="mt-1 text-xs leading-5 text-court-textMuted">Escolha o resultado, o mercado ou o período que quer consultar.</p>
            </div>
          </div>
          {data && <span className="rounded-full bg-court-bg px-3 py-1 text-xs text-court-textMuted">{data.page.total} {data.page.total === 1 ? 'resultado' : 'resultados'}</span>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-court-textMuted">
          Resultado
          <select className="input py-2 text-sm" value={draftFilters.result} onChange={event => setDraftFilters(current => ({ ...current, result: event.target.value }))}>
            <option value="all">Todos</option><option value="pending">Pendente</option><option value="won">Acertou</option><option value="lost">Errou</option><option value="push">Push</option><option value="void">Anulada</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-court-textMuted">
          Mercado
          <select className="input py-2 text-sm" value={draftFilters.market} onChange={event => setDraftFilters(current => ({ ...current, market: event.target.value }))}>
            <option value="all">Todos</option>
            {Object.entries(MARKET_LABELS).map(([market, label]) => <option key={market} value={market}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-court-textMuted">
          De
          <input className="input py-2 text-sm" type="date" value={draftFilters.from} onChange={event => setDraftFilters(current => ({ ...current, from: event.target.value }))} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-court-textMuted">
          Até
          <input className="input py-2 text-sm" type="date" value={draftFilters.to} onChange={event => setDraftFilters(current => ({ ...current, to: event.target.value }))} />
        </label>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 border-t border-court-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-court-textMuted">As alterações entram em vigor ao aplicar os filtros.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={clearFilters} className="btn-ghost px-3 py-2 text-sm"><RotateCcw aria-hidden="true" className="h-4 w-4" />Limpar filtros</button>
            <button type="submit" className="btn-primary px-4 py-2 text-sm"><Filter aria-hidden="true" className="h-4 w-4" />Aplicar filtros</button>
          </div>
        </div>
      </form>

      <div className="flex items-center justify-between text-sm text-court-textMuted" aria-live="polite">
        <span>{data ? `${data.page.total} resultados` : ' '}</span>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-court-danger/40 bg-court-danger/10 p-4 text-sm text-court-text">
          <p>{error}</p>
          <button type="button" onClick={() => void load(appliedFilters, 0, false)} className="mt-2 font-medium text-court-accent underline underline-offset-4">Tentar novamente</button>
        </div>
      )}

      {loading ? (
        <div className="divide-y divide-court-border border-y border-court-border" aria-label="Carregando histórico">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse bg-court-card/50" />)}
        </div>
      ) : rows.length ? (
        <div className="border-y border-court-border">
          <div className="hidden grid-cols-[1.25fr_1.35fr_1fr_0.9fr_0.8fr_0.8fr] gap-5 border-b border-court-border py-2 text-xs font-medium text-court-textMuted sm:grid">
            <span>Partida e horário</span><span>Jogador / mercado</span><span>Palpite / cotação</span><span>Projeção / real</span><span>Apuração</span><span className="text-right">Amostra</span>
          </div>
          <div className="divide-y divide-court-border">
          {rows.map(forecast => (
            <article key={forecast.id} className="grid grid-cols-2 gap-x-4 gap-y-4 py-4 sm:grid-cols-[1.25fr_1.35fr_1fr_0.9fr_0.8fr_0.8fr] sm:items-center sm:gap-5">
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-court-text">{forecast.game || `Partida ${forecast.eventId}`}</p>
                  {forecast.seasonPhase === 'preseason' && <span className="rounded bg-court-warning/15 px-2 py-0.5 text-[11px] font-medium text-court-warning">Pré-temporada</span>}
                </div>
                <p className="mt-1 text-xs tabular-nums text-court-textMuted">{formatAppDateTime(forecast.commenceTime)}</p>
              </div>

              <div className="min-w-0">
                <p className="text-xs text-court-textMuted sm:hidden">Jogador / mercado</p>
                <p className="truncate font-medium text-court-text">{forecast.player}</p>
                {forecast.playerTeam && <p className="text-[11px] text-court-textMuted">{forecast.playerTeam}</p>}
                <p className="mt-1 truncate text-xs text-court-textMuted">{MARKET_LABELS[forecast.market]}</p>
              </div>

              <div>
                <p className="text-xs text-court-textMuted sm:hidden">Palpite</p>
                <p className="font-semibold text-court-text">{forecast.selection === 'Over' ? 'Mais de' : 'Menos de'} {forecast.line}</p>
                <p className="mt-1 text-xs text-court-textMuted">{formatOdds(forecast.americanOdds)}{forecast.bookmaker ? ` · ${forecast.bookmaker}` : ''}</p>
                {forecast.marketMovement?.status === 'available' && forecast.marketMovement.sameBookmaker && (
                  <p className="mt-2 text-xs leading-5 text-court-textMuted">
                    {forecast.marketMovement.lineChanged
                      ? `Linha ${forecast.line} → ${forecast.marketMovement.currentLine}`
                      : 'Linha sem alteração'}
                    {' · '}
                    {forecast.marketMovement.oddsChanged
                      ? `odd ${formatOdds(forecast.americanOdds)} → ${formatOdds(forecast.marketMovement.currentAmericanOdds ?? null)}`
                      : 'odd sem alteração'}
                  </p>
                )}
                {forecast.marketMovement?.status === 'available' && !forecast.marketMovement.sameBookmaker && (
                  <p className="mt-2 text-xs leading-5 text-court-textMuted">Cotação atual: linha {forecast.marketMovement.currentLine}, {formatOdds(forecast.marketMovement.currentAmericanOdds ?? null)} @ {forecast.marketMovement.currentBookmaker}. Casa diferente; comparação de preço não direta.</p>
                )}
                {forecast.marketMovement?.status === 'unavailable' && <p className="mt-2 text-xs text-court-textMuted">Cotação atual indisponível na fonte.</p>}
                {forecast.marketMovement?.status === 'unconfigured' && <p className="mt-2 text-xs text-court-textMuted">Configure a PropLine para comparar com a cotação atual.</p>}
              </div>

              <div>
                <p className="text-xs text-court-textMuted sm:hidden">Projeção / real</p>
                <p className="tabular-nums text-court-text">{forecast.projection.toFixed(1)} <span className="text-court-textMuted">/</span> {forecast.actualValue === null ? '—' : forecast.actualValue.toFixed(1)}</p>
                <p className="mt-1 text-xs text-court-textMuted">{Math.round(forecast.predictedProbability * 100)}% estimada</p>
              </div>

              <div>
                <p className="text-xs text-court-textMuted sm:hidden">Status</p>
                <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${RESULT_STYLES[forecast.result]}`}>{RESULT_LABELS[forecast.result]}</span>
              </div>

              <div className="text-right text-xs text-court-textMuted">
                <span className="sm:hidden">Amostra: </span>{forecast.sampleSize} jogos
                <p className="mt-1">{forecast.confidence} confiança</p>
              </div>
            </article>
          ))}
          </div>
        </div>
      ) : !error ? (
        <div className="border-y border-court-border py-12 text-center">
          <h3 className="font-semibold text-court-text">Nenhuma previsão neste filtro</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-court-textMuted">Tente outro resultado, mercado ou período. As previsões do dia aparecem aqui depois de serem registradas.</p>
        </div>
      ) : null}

      {data && rows.length < data.page.total && !loading && (
        <div className="flex justify-center">
          <button type="button" disabled={loadingMore} onClick={() => void load(appliedFilters, rows.length, true)} className="btn-secondary px-5 py-2.5 text-sm">
            {loadingMore ? 'Carregando…' : 'Carregar mais previsões'}
          </button>
        </div>
      )}
      </> : <SavedTickets />}
    </section>
  );
}

function SavedTickets() {
  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stakeDrafts, setStakeDrafts] = useState<Record<string, string>>({});
  const [updatingStake, setUpdatingStake] = useState<string | null>(null);
  const [stakeFeedback, setStakeFeedback] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const ticketsInPeriod = tickets.filter(ticket => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ticket.createdAt));
    const inPeriod = (!period.from || date >= period.from) && (!period.to || date <= period.to);
    return inPeriod;
  });
  const ticketGroups = [
    { outcome: 'pending' as const, title: 'Pendentes', note: 'Aguardando a apuração dos jogos.', style: 'text-court-warning' },
    { outcome: 'won' as const, title: 'Acertados', note: 'Bilhetes com todas as seleções vencedoras.', style: 'text-court-success' },
    { outcome: 'lost' as const, title: 'Errados', note: 'Bilhetes com pelo menos uma seleção perdida.', style: 'text-court-danger' },
    { outcome: 'push/void' as const, title: 'Devolvidos ou anulados', note: 'Bilhetes devolvidos ou anulados conforme a apuração.', style: 'text-court-textMuted' },
  ].map(group => ({ ...group, tickets: ticketsInPeriod.filter(ticket => ticket.outcome === group.outcome) }));
  const visibleTicketGroups = ticketGroups.filter(group => group.tickets.length > 0);
  const totalStaked = ticketsInPeriod.reduce((total, ticket) => total + ticket.stakeAmount, 0);
  const getSettledReturn = (ticket: SavedTicket): number | null => {
    if (ticket.outcome === 'pending') return null;
    if (ticket.actualReturn !== null) return ticket.actualReturn;
    if (ticket.outcome === 'lost') return 0;
    if (ticket.outcome === 'push/void') return ticket.stakeAmount;
    if (ticket.potentialReturn !== null) return ticket.potentialReturn;
    if (ticket.combinedDecimalOdds !== null) return ticket.stakeAmount * ticket.combinedDecimalOdds;
    return null;
  };
  const financiallySettled = ticketsInPeriod.filter(ticket => getSettledReturn(ticket) !== null);
  const settledStake = financiallySettled.reduce((total, ticket) => total + ticket.stakeAmount, 0);
  const settledReturn = financiallySettled.reduce((total, ticket) => total + (getSettledReturn(ticket) ?? 0), 0);
  const settledProfit = settledReturn - settledStake;

  useEffect(() => {
    let active = true;
    fetch('/api/analysis/nba/tickets', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os bilhetes.');
        if (active) {
          const saved = body.tickets as SavedTicket[];
          setTickets(saved.filter(ticket => ticket.legs.length > 0 && ticket.legs.every(leg => leg.commenceTime && getNbaSeasonPhase(leg.commenceTime) === 'regular')));
          setStakeDrafts(Object.fromEntries(saved.map(ticket => [ticket.id, JSON.stringify({
            stakeAmount: ticket.stakeAmount > 0 ? String(ticket.stakeAmount) : '',
            combinedDecimalOdds: ticket.combinedDecimalOdds === null ? '' : String(ticket.combinedDecimalOdds),
            potentialReturn: ticket.potentialReturn !== null ? String(ticket.potentialReturn) : ticket.stakeAmount > 0 && ticket.combinedDecimalOdds !== null ? (ticket.stakeAmount * ticket.combinedDecimalOdds).toFixed(2) : '',
            actualReturn: ticket.actualReturn === null ? '' : String(ticket.actualReturn),
            manualOutcome: ticket.manualOutcome ?? '',
          })])));
        }
      })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar bilhetes.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  async function updateStake(ticketId: string) {
    let fields: { stakeAmount: string; combinedDecimalOdds: string; potentialReturn: string; actualReturn: string; manualOutcome: string };
    try { fields = JSON.parse(stakeDrafts[ticketId]); } catch { return; }
    const stakeAmount = Number(fields.stakeAmount);
    if (!(stakeAmount > 0) || updatingStake) return;
    setUpdatingStake(ticketId);
    setStakeFeedback(null);
    try {
      const response = await fetch('/api/analysis/nba/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ticketId,
          stakeAmount,
          combinedDecimalOdds: fields.combinedDecimalOdds === '' ? null : Number(fields.combinedDecimalOdds),
          potentialReturn: fields.potentialReturn === '' ? null : Number(fields.potentialReturn),
          actualReturn: fields.actualReturn === '' ? null : Number(fields.actualReturn),
          manualOutcome: fields.manualOutcome === '' ? null : fields.manualOutcome,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível atualizar o valor.');
      setTickets(current => current.map(ticket => {
        if (ticket.id !== ticketId) return ticket;
        const manualOutcome = body.manualOutcome as SavedTicket['manualOutcome'];
        return { ...ticket, ...body, manualOutcome, outcome: manualOutcome ?? getTicketOutcome(ticket.legs.map(leg => leg.result)), outcomeSource: manualOutcome ? 'manual' : 'forecast' };
      }));
      setStakeDrafts(current => ({ ...current, [ticketId]: JSON.stringify({ stakeAmount: String(body.stakeAmount), combinedDecimalOdds: body.combinedDecimalOdds === null ? '' : String(body.combinedDecimalOdds), potentialReturn: body.potentialReturn === null ? '' : String(body.potentialReturn), actualReturn: body.actualReturn === null ? '' : String(body.actualReturn), manualOutcome: body.manualOutcome ?? '' }) }));
      setStakeFeedback({ id: ticketId, text: 'Dados da aposta atualizados.' });
    } catch (updateError) {
      setStakeFeedback({ id: ticketId, text: updateError instanceof Error ? updateError.message : 'Falha ao atualizar o valor.', error: true });
    } finally {
      setUpdatingStake(null);
    }
  }

  async function deleteTicket(ticket: SavedTicket) {
    if (!window.confirm(`Excluir “${ticket.label}” do seu histórico pessoal?`)) return;
    setDeleting(ticket.id);
    setDeleteError('');
    try {
      const response = await fetch('/api/analysis/nba/tickets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ticket.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível excluir o bilhete.');
      setTickets(current => current.filter(item => item.id !== ticket.id));
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : 'Falha ao excluir o bilhete.');
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <p className="text-sm text-court-textMuted">Carregando apostas pessoais…</p>;
  return (
    <section aria-labelledby="saved-tickets-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="saved-tickets-heading" className="text-lg font-semibold text-court-text">Bilhetes salvos</h3>
          <p className="mt-1 text-sm text-court-textMuted">Cada bilhete salvo conta como uma aposta. Ajuste odd, retorno e valor recebido conforme o comprovante da casa.</p>
        </div>
        {tickets.length > 0 && <span className="text-xs text-court-textMuted">{ticketsInPeriod.length} apostas no período</span>}
      </div>
      <ManualTicketForm onSaved={() => setReloadKey(key => key + 1)} />
      {error && <p role="alert" className="rounded-lg border border-court-danger/40 p-3 text-sm text-court-danger">{error}</p>}
      {deleteError && <p role="alert" className="rounded-lg border border-court-danger/40 p-3 text-sm text-court-danger">{deleteError}</p>}
      <div className="rounded-xl border border-court-border bg-court-card p-4 sm:p-5" aria-label="Filtros das apostas pessoais">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-court-accent/10 p-2 text-court-accent"><CalendarDays aria-hidden="true" className="h-4 w-4" /></span>
            <div><h4 className="text-sm font-semibold text-court-text">Período das apostas</h4><p className="mt-1 text-xs leading-5 text-court-textMuted">Filtre os bilhetes pela data em que foram salvos.</p></div>
          </div>
          <span className="rounded-full bg-court-bg px-3 py-1 text-xs text-court-textMuted">{ticketsInPeriod.length} {ticketsInPeriod.length === 1 ? 'aposta' : 'apostas'}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-court-textMuted">Data inicial<input type="date" value={period.from} onChange={event => setPeriod(current => ({ ...current, from: event.target.value }))} className="input mt-1.5 py-2 text-sm" /></label>
          <label className="text-xs font-medium text-court-textMuted">Data final<input type="date" value={period.to} onChange={event => setPeriod(current => ({ ...current, to: event.target.value }))} className="input mt-1.5 py-2 text-sm" /></label>
        </div>
        {(period.from || period.to) && <div className="mt-3 flex justify-end border-t border-court-border pt-3"><button type="button" onClick={() => setPeriod({ from: '', to: '' })} className="btn-ghost px-3 py-2 text-sm"><RotateCcw aria-hidden="true" className="h-4 w-4" />Limpar período</button></div>}
      </div>
      {ticketsInPeriod.length > 0 && <div className="grid gap-3 sm:grid-cols-3" aria-label="Resumo financeiro das apostas">
        <div className="rounded-lg border border-court-border p-3"><p className="text-xs text-court-textMuted">Total apostado</p><p className="mt-1 font-mono font-semibold text-court-text">{formatCurrency(totalStaked)}</p></div>
        <div className="rounded-lg border border-court-border p-3"><p className="text-xs text-court-textMuted">Retorno apurado</p><p className="mt-1 font-mono font-semibold text-court-text">{formatCurrency(settledReturn)}</p></div>
        <div className="rounded-lg border border-court-border p-3"><p className="text-xs text-court-textMuted">Lucro / prejuízo apurado</p><p className={`mt-1 font-mono font-semibold ${settledProfit >= 0 ? 'text-court-success' : 'text-court-danger'}`}>{formatCurrency(settledProfit)}</p></div>
      </div>}
      {ticketsInPeriod.length > 0 && <p className="-mt-2 text-xs text-court-textMuted">O retorno apurado usa o valor recebido que você informar; sem esse dado, calcula pela odd e pelo retorno potencial. Bilhetes ainda pendentes não entram no lucro.</p>}
      {visibleTicketGroups.length > 0 && (
        <nav aria-label="Navegar pelos resultados das apostas" className="flex flex-wrap gap-2 border-y border-court-border py-3">
          {visibleTicketGroups.map(group => (
            <a key={group.outcome} href={`#saved-ticket-group-${group.outcome.replace('/', '-')}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-court-border bg-court-card px-3 py-2 text-sm font-medium text-court-text transition-colors hover:border-court-accent/50 hover:bg-court-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-accent">
              <span className={group.style}>{group.title}</span>
              <span className="rounded-full bg-court-bg px-2 py-0.5 text-xs text-court-textMuted">{group.tickets.length}</span>
            </a>
          ))}
        </nav>
      )}
      <div className="space-y-6">
        {ticketGroups.map(group => group.tickets.length > 0 && (
        <section key={group.outcome} id={`saved-ticket-group-${group.outcome.replace('/', '-')}`} aria-labelledby={`saved-ticket-group-heading-${group.outcome.replace('/', '-')}`} className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-court-border pb-2">
            <div><h4 id={`saved-ticket-group-heading-${group.outcome.replace('/', '-')}`} className={`font-semibold ${group.style}`}>{group.title}</h4><p className="mt-0.5 text-xs text-court-textMuted">{group.note}</p></div>
            <span className="rounded-full bg-court-bg px-2.5 py-1 text-xs text-court-textMuted">{group.tickets.length}</span>
          </div>
          <div className="mt-3 space-y-3">
        {group.tickets.map(ticket => {
          const fields = (() => { try { return JSON.parse(stakeDrafts[ticket.id] || '{}'); } catch { return {}; } })() as { stakeAmount?: string; combinedDecimalOdds?: string; potentialReturn?: string; actualReturn?: string; manualOutcome?: string };
          const updateField = (name: keyof typeof fields, value: string) => setStakeDrafts(current => {
            let draft: typeof fields = {};
            try { draft = JSON.parse(current[ticket.id] || '{}'); } catch { /* empty draft */ }
            return { ...current, [ticket.id]: JSON.stringify({ ...draft, [name]: value }) };
          });
          return (
          <article key={ticket.id} className="rounded-xl border border-court-border bg-court-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-court-text">{ticket.label}</h4>
                <p className="mt-1 text-xs text-court-textMuted">{ticket.bookmaker} · salvo {formatAppDateTime(ticket.createdAt)} · apostado {formatCurrency(ticket.stakeAmount)} · odd {ticket.combinedDecimalOdds?.toFixed(2) ?? 'não informada'} · retorno potencial {ticket.potentialReturn === null ? 'não informado' : formatCurrency(ticket.potentialReturn)} · retorno recebido {ticket.actualReturn === null ? 'não informado' : formatCurrency(ticket.actualReturn)}</p>
                <p className="mt-1 text-xs text-court-textMuted">Resultado: {ticket.outcomeSource === 'manual' ? 'informado pela casa' : 'apurado pelo sistema'}</p>
                {ticket.stakeAmount === 0 && <p className="mt-1 text-xs text-court-warning">Valor não informado quando este bilhete foi salvo. Atualize abaixo para incluir no controle de gastos.</p>}
              </div>
              <span className={`rounded px-2.5 py-1 text-xs font-semibold ${ticket.outcome === 'won' ? RESULT_STYLES.won : ticket.outcome === 'lost' ? RESULT_STYLES.lost : ticket.outcome === 'pending' ? RESULT_STYLES.pending : RESULT_STYLES.push}`}>
                {ticket.outcome === 'won' ? 'Bilhete acertou' : ticket.outcome === 'lost' ? 'Bilhete errou' : ticket.outcome === 'pending' ? 'Aguardando pernas' : 'Push/anulada · conferir regra da casa'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-court-border pt-3">
              <label className="flex-1 text-xs text-court-textMuted">
                Valor que apostou (R$)
                <input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" placeholder="Ex.: 10,00" value={stakeDrafts[ticket.id] ?? ''} onChange={event => setStakeDrafts(current => ({ ...current, [ticket.id]: event.target.value }))} className="input mt-1 py-2 text-sm" />
              </label>
              <button type="button" disabled={updatingStake === ticket.id || !(Number(stakeDrafts[ticket.id]) > 0) || Number(stakeDrafts[ticket.id]) === ticket.stakeAmount} onClick={() => void updateStake(ticket.id)} className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50">
                {updatingStake === ticket.id ? 'Salvando…' : 'Atualizar valor'}
              </button>
              {stakeFeedback?.id === ticket.id && <p role={stakeFeedback.error ? 'alert' : 'status'} className={`basis-full text-xs ${stakeFeedback.error ? 'text-court-danger' : 'text-court-success'}`}>{stakeFeedback.text}</p>}
            </div>
            <div className="mt-4 grid gap-3 border-t border-court-border pt-3 sm:grid-cols-2">
              <label className="text-xs text-court-textMuted">Valor apostado (R$)<input type="number" min="0.01" max="1000000" step="0.01" value={fields.stakeAmount ?? ''} onChange={event => updateField('stakeAmount', event.target.value)} className="input mt-1 py-2 text-sm" /></label>
              <label className="text-xs text-court-textMuted">Odd decimal da casa<input type="number" min="0.01" max="100000" step="0.0001" placeholder="Indisponível para mesma partida" value={fields.combinedDecimalOdds ?? ''} onChange={event => updateField('combinedDecimalOdds', event.target.value)} className="input mt-1 py-2 text-sm" /></label>
              <label className="text-xs text-court-textMuted">Retorno potencial (R$)<input type="number" min="0" max="1000000000" step="0.01" value={fields.potentialReturn ?? ''} onChange={event => updateField('potentialReturn', event.target.value)} className="input mt-1 py-2 text-sm" /></label>
              <label className="text-xs text-court-textMuted">Retorno recebido (R$) · inclui bônus<input type="number" min="0" max="1000000000" step="0.01" value={fields.actualReturn ?? ''} onChange={event => updateField('actualReturn', event.target.value)} className="input mt-1 py-2 text-sm" /></label>
              <label className="text-xs text-court-textMuted">Resultado da casa<select value={fields.manualOutcome ?? ''} onChange={event => updateField('manualOutcome', event.target.value)} className="input mt-1 py-2 text-sm"><option value="">Usar apuração do sistema</option><option value="won">Ganhou</option><option value="lost">Perdeu</option><option value="push/void">Devolvida / anulada</option></select></label>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <button type="button" disabled={updatingStake === ticket.id || !(Number(fields.stakeAmount) > 0)} onClick={() => void updateStake(ticket.id)} className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50">{updatingStake === ticket.id ? 'Salvando…' : 'Salvar alterações'}</button>
                <button type="button" disabled={deleting === ticket.id} onClick={() => void deleteTicket(ticket)} className="btn-ghost px-3 py-2 text-xs text-court-danger disabled:opacity-50">{deleting === ticket.id ? 'Excluindo…' : 'Excluir bilhete'}</button>
                {stakeFeedback?.id === ticket.id && <p role={stakeFeedback.error ? 'alert' : 'status'} className={`text-xs ${stakeFeedback.error ? 'text-court-danger' : 'text-court-success'}`}>{stakeFeedback.text}</p>}
              </div>
            </div>
            <ol className="mt-3 divide-y divide-court-border border-t border-court-border">
              {ticket.legs.map(leg => (
                <li key={`${ticket.id}-${leg.position}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium text-court-text">{leg.player}{leg.playerTeam ? ` · ${leg.playerTeam}` : ''} · {MARKET_LABELS[leg.market]} {leg.selection === 'Over' ? 'Mais de' : 'Menos de'} {leg.line}</p>
                    <p className="mt-1 text-xs text-court-textMuted">{formatOdds(leg.americanOdds)} @ {leg.bookmaker} · real {leg.actualValue === null ? 'aguardando' : leg.actualValue}</p>
                  </div>
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${RESULT_STYLES[leg.result]}`}>{RESULT_LABELS[leg.result]}</span>
                </li>
              ))}
            </ol>
            {ticket.outcome === 'push/void' && <p className="text-xs leading-5 text-court-textMuted">Todas as pernas foram apuradas, mas pelo menos uma foi push ou anulada. Casas podem remover essa perna e recalcular a odd do bilhete conforme suas regras.</p>}
          </article>
        );})}
          </div>
        </section>
        ))}
        {!loading && ticketsInPeriod.length === 0 && <p className="rounded-lg border border-court-border p-6 text-center text-sm text-court-textMuted">Nenhuma aposta neste período.</p>}
      </div>
    </section>
  );
}
