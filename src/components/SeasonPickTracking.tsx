'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { CalendarDays, Filter, RotateCcw } from 'lucide-react';
import { formatAppDateTime } from '@/lib/utils/date';
import { PlayerPropMarket } from '@/lib/analysis/player-props';

type Result = 'won' | 'lost' | 'push' | 'void' | null;
type Pick = {
  id: string; event_id: string; player_id: string; player_name: string; player_team: string;
  opponent_team: string; game: string; market: PlayerPropMarket; line: string; selection: string;
  projection: string; sample_size: number; observed_hits: number; observed_rate: string;
  commence_time: string; recorded_at: string; actual_value: string | null; result: Result;
  details: { last5Average?: number };
};
type MarketSummary = { market: string; total: number; pending: number; won: number; lost: number; push: number; void: number };
type ResponseData = { season: string; summary: Omit<MarketSummary, 'market'>; markets: MarketSummary[]; picks: Pick[]; archivedCount: number };

const MARKET_LABELS: Record<PlayerPropMarket, string> = {
  player_points: 'Pontos', player_rebounds: 'Rebotes', player_assists: 'Assistências',
  player_threes: 'Cestas de 3', player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};
const RESULT_LABELS: Record<string, string> = { won: 'Acertou', lost: 'Errou', push: 'Push', void: 'Anulada' };

export function SeasonPickTracking({ mode, filterPortal: FilterPortal, onActiveFilterCountChange, onRecordCountChange }: { mode: 'history' | 'performance'; filterPortal?: ComponentType<{ children: ReactNode }>; onActiveFilterCountChange?: (count: number) => void; onRecordCountChange?: (count: number) => void }) {
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [market, setMarket] = useState('all');
  const [result, setResult] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ market: 'all', result: 'all', from: '', to: '' });

  useEffect(() => {
    let current = true;
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(applied).forEach(([key, value]) => { if (value !== 'all' && value) params.set(key, value); });
    fetch(`/api/analysis/nba/season-picks/history?${params}`, { cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Falha ao carregar sinais.'); return body as ResponseData; })
      .then(body => { if (current) { setData(body); setError(''); } })
      .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : 'Falha ao carregar sinais.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [applied]);

  const decisionCount = (data?.summary.won || 0) + (data?.summary.lost || 0);
  const rate = decisionCount ? ((data!.summary.won / decisionCount) * 100).toFixed(1) : '—';
  const markets = useMemo(() => Array.from(new Set((data?.markets || []).map(row => row.market))), [data]);
  useEffect(() => {
    if (mode === 'history') onActiveFilterCountChange?.([applied.market !== 'all', applied.result !== 'all', Boolean(applied.from), Boolean(applied.to)].filter(Boolean).length);
  }, [applied, mode, onActiveFilterCountChange]);
  useEffect(() => {
    if (mode === 'history') onRecordCountChange?.(data?.summary.total ?? 0);
  }, [data, mode, onRecordCountChange]);
  function clearFilters() { setMarket('all'); setResult('all'); setFrom(''); setTo(''); setApplied({ market: 'all', result: 'all', from: '', to: '' }); }

  return <section className="space-y-5" aria-labelledby="season-picks-title">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-court-border pb-4">
      <div><h2 id="season-picks-title" className="text-lg font-semibold text-court-text">{mode === 'history' ? 'Sinais registrados para apuração' : 'Desempenho dos sinais da temporada'}</h2><p className="mt-1 text-sm text-court-textMuted">Temporada {data?.season || 'atual'} · previsões salvas antes dos jogos e apuradas com os boxscores.</p></div>
      <span className="flex items-center gap-2 text-xs text-court-textMuted"><CalendarDays className="h-4 w-4" />{loading ? 'Carregando…' : `${data?.summary.total ?? 0} sinais`}</span>
    </div>
    {mode === 'performance' && data && <dl className="grid grid-cols-2 divide-x divide-y divide-court-border border-y border-court-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
      {[['Registrados', data.summary.total], ['Pendentes', data.summary.pending], ['Acertos', data.summary.won], ['Erros', data.summary.lost], ['Push / anulados', data.summary.push + data.summary.void], ['Acerto entre decisões', rate === '—' ? rate : `${rate}%`]].map(([label, value]) => <div key={String(label)} className="px-3 py-4"><dt className="text-xs text-court-textMuted">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-court-text">{value}</dd></div>)}
    </dl>}
    {mode === 'performance' && !!data?.markets.length && <div className="overflow-x-auto border-y border-court-border"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="text-xs text-court-textMuted"><th className="py-3 font-medium">Mercado</th><th className="py-3 text-right font-medium">Sinais</th><th className="py-3 text-right font-medium">Pendentes</th><th className="py-3 text-right font-medium">Acertos</th><th className="py-3 text-right font-medium">Erros</th><th className="py-3 text-right font-medium">Taxa*</th></tr></thead><tbody className="divide-y divide-court-border">{data.markets.map(row => { const settled = row.won + row.lost; return <tr key={row.market}><th className="py-3 font-medium text-court-text">{MARKET_LABELS[row.market as PlayerPropMarket] || row.market}</th><td className="py-3 text-right">{row.total}</td><td className="py-3 text-right">{row.pending}</td><td className="py-3 text-right text-court-success">{row.won}</td><td className="py-3 text-right text-court-danger">{row.lost}</td><td className="py-3 text-right">{settled ? `${(row.won / settled * 100).toFixed(1)}%` : '—'}</td></tr>; })}</tbody></table></div>}
    {mode === 'performance' && <p className="text-xs leading-5 text-court-textMuted">*A taxa considera apenas acertos e erros. Não representa probabilidade calibrada nem retorno financeiro: esses sinais não usam cotações.</p>}
    {!!data?.archivedCount && <p className="rounded-lg border border-court-border bg-court-card px-3 py-2 text-xs leading-5 text-court-textMuted">{data.archivedCount} sinais do método anterior foram preservados no banco e ficaram fora destes totais, porque usavam uma amostra de apenas um jogo.</p>}
    {mode === 'history' && FilterPortal && <FilterPortal><form onSubmit={event => { event.preventDefault(); setApplied({ market, result, from, to }); }} className="space-y-4">
      <div className="space-y-3"><label className="block text-xs font-medium text-court-textMuted">Resultado<select className="input mt-1.5 w-full py-2 text-sm" value={result} onChange={event => setResult(event.target.value)}><option value="all">Todos</option><option value="pending">Pendente</option><option value="won">Acertou</option><option value="lost">Errou</option><option value="push">Push</option><option value="void">Anulada</option></select></label>
      <label className="block text-xs font-medium text-court-textMuted">Mercado<select className="input mt-1.5 w-full py-2 text-sm" value={market} onChange={event => setMarket(event.target.value)}><option value="all">Todos</option>{markets.map(key => <option key={key} value={key}>{MARKET_LABELS[key as PlayerPropMarket] || key}</option>)}</select></label></div>
      <div className="space-y-3 border-t border-court-border pt-4"><h3 className="text-sm font-semibold text-court-text">Período</h3>
      <label className="block text-xs font-medium text-court-textMuted">De<input className="input mt-1.5 w-full py-2 text-sm" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label className="block text-xs font-medium text-court-textMuted">Até<input className="input mt-1.5 w-full py-2 text-sm" type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>
      <div className="space-y-2 border-t border-court-border pt-3"><button type="submit" className="btn-primary w-full justify-center px-3 py-2 text-sm"><Filter className="h-4 w-4" />Aplicar</button><button type="button" onClick={clearFilters} className="btn-ghost w-full justify-center px-3 py-2 text-sm"><RotateCcw className="h-4 w-4" />Limpar filtros</button></div>
    </form></FilterPortal>}
    {error && <p role="alert" className="border-y border-court-danger/40 py-3 text-sm text-court-danger">{error}</p>}
    {loading ? <div className="h-28 animate-pulse rounded-lg bg-court-card" aria-label="Carregando sinais" /> : !data?.picks.length ? <p className="border-y border-court-border py-8 text-center text-sm text-court-textMuted">Nenhum sinal encontrado. Os próximos sinais elegíveis serão registrados antes dos jogos.</p> : <div className="overflow-x-auto border-y border-court-border"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="text-xs text-court-textMuted"><th className="py-3 pr-3 font-medium">Partida / horário</th><th className="py-3 pr-3 font-medium">Jogador / time</th><th className="py-3 pr-3 font-medium">Mercado</th><th className="py-3 pr-3 text-right font-medium">Sinal</th><th className="py-3 pr-3 text-right font-medium">Média / real</th><th className="py-3 pr-3 text-right font-medium">Frequência anterior</th><th className="py-3 text-right font-medium">Apuração</th></tr></thead><tbody className="divide-y divide-court-border">{data.picks.map(pick => <tr key={pick.id}><td className="py-3 pr-3"><span className="block font-medium text-court-text">{pick.game}</span><span className="text-xs text-court-textMuted">{formatAppDateTime(pick.commence_time)}</span></td><td className="py-3 pr-3"><span className="block font-medium text-court-text">{pick.player_name}</span><span className="text-xs text-court-textMuted">{pick.player_team}</span></td><td className="py-3 pr-3 text-court-textMuted">{MARKET_LABELS[pick.market] || pick.market}</td><td className="py-3 pr-3 text-right font-medium text-court-text">{pick.selection === 'Over' ? 'Mais de' : 'Menos de'} {Number(pick.line).toFixed(1)}</td><td className="py-3 pr-3 text-right tabular-nums text-court-textMuted">{Number(pick.projection).toFixed(1)} / {pick.actual_value === null ? '—' : Number(pick.actual_value).toFixed(1)}</td><td className="py-3 pr-3 text-right tabular-nums text-court-textMuted">{pick.observed_hits}/{pick.sample_size} ({(Number(pick.observed_rate) * 100).toFixed(0)}%)</td><td className="py-3 text-right"><span className={`rounded px-2 py-1 text-xs font-semibold ${pick.result === 'won' ? 'bg-court-success/15 text-court-success' : pick.result === 'lost' ? 'bg-court-danger/15 text-court-danger' : pick.result ? 'bg-court-border text-court-textMuted' : 'bg-court-warning/15 text-court-warning'}`}>{pick.result ? RESULT_LABELS[pick.result] : 'Pendente'}</span></td></tr>)}</tbody></table></div>}
  </section>;
}
