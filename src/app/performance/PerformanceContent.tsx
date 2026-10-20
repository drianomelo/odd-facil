'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlayerPropMarket } from '@/lib/analysis/player-props';

type MarketPerformance = {
  market: PlayerPropMarket;
  totalForecasts: number;
  pending: number;
  settled: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number | null;
  meanAbsoluteError: number | null;
  brierScore: number | null;
};

type SettledForecast = {
  id: string;
  player: string;
  playerTeam?: string | null;
  market: PlayerPropMarket;
  line: number;
  selection: 'Over' | 'Under';
  projection: number;
  predictedProbability: number;
  americanOdds: number | null;
  bookmaker: string | null;
  actualValue: number | null;
  result: 'won' | 'lost' | 'push' | 'void';
  commenceTime: string;
  game: string | null;
};

type Performance = {
  totalForecasts: number;
  modelVersion: string;
  seasonPhase: 'regular';
  pending: number;
  settled: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  hitRate: number | null;
  brierScore: number | null;
  betsWithOdds: number;
  netUnits: number;
  roiPercent: number | null;
  recentSettled: SettledForecast[];
  byMarket: MarketPerformance[];
  message?: string;
  playerTeamFacets: Array<{ team: string; player: string }>;
};

const MARKET_LABELS: Record<PlayerPropMarket, string> = {
  player_points: 'Pontos',
  player_rebounds: 'Rebotes',
  player_assists: 'Assistências',
  player_threes: 'Cestas de 3',
  player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};

const RESULT_LABELS: Record<SettledForecast['result'], string> = {
  won: 'Acertou',
  lost: 'Errou',
  push: 'Push',
  void: 'Anulada',
};

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

export function PerformanceContent() {
  const [data, setData] = useState<Performance | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'model' | 'tickets'>('model');
  const [teamFilter, setTeamFilter] = useState('all');
  const [playerFilter, setPlayerFilter] = useState('all');

  async function load(team = teamFilter, player = playerFilter) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (team !== 'all') params.set('team', team);
      if (player !== 'all') params.set('player', player);
      const response = await fetch(`/api/analysis/nba/performance?${params}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar o desempenho.');
      setData(body as Performance);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar os resultados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(teamFilter, playerFilter); }, [teamFilter, playerFilter]);

  const playerOptions = Array.from(new Set((data?.playerTeamFacets || [])
    .filter(item => teamFilter === 'all' || item.team === teamFilter)
    .map(item => item.player))).sort((a, b) => a.localeCompare(b));

  return (
    <section className="space-y-7" aria-labelledby="performance-title">
      <div className="flex flex-col gap-3 border-b border-court-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="performance-title" className="text-2xl font-bold text-court-text sm:text-3xl">Desempenho</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-court-textMuted">
            Consulte separadamente os resultados gerais das previsões e o desempenho dos bilhetes que você salvou como apostas.
          </p>
        </div>
        <Link href={activeTab === 'model' ? '/history?phase=regular' : '/history'} className="text-sm font-medium text-court-accent underline-offset-4 hover:underline">{activeTab === 'model' ? 'Ver previsões registradas' : 'Gerenciar apostas no Histórico'}</Link>
      </div>

      <div className="flex gap-2 border-b border-court-border" role="tablist" aria-label="Desempenho por origem">
        <button type="button" role="tab" aria-selected={activeTab === 'model'} onClick={() => setActiveTab('model')} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === 'model' ? 'border-court-accent text-court-text' : 'border-transparent text-court-textMuted'}`}>Resultados gerais</button>
        <button type="button" role="tab" aria-selected={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === 'tickets' ? 'border-court-accent text-court-text' : 'border-transparent text-court-textMuted'}`}>Meus bilhetes salvos</button>
      </div>

      {activeTab === 'model' && error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-court-danger/40 py-4 text-sm text-court-text">
          <p>{error}</p>
          <button type="button" onClick={() => void load(teamFilter, playerFilter)} className="font-medium text-court-accent underline underline-offset-4">Tentar novamente</button>
        </div>
      )}

      {activeTab === 'model' && loading && !data ? (
        <div className="space-y-4" aria-label="Carregando desempenho">
          <div className="h-24 animate-pulse rounded-lg bg-court-card" />
          <div className="h-56 animate-pulse rounded-lg bg-court-card" />
        </div>
      ) : activeTab === 'model' && data ? (
        <>
          <div className="grid gap-3 rounded-xl border border-court-border p-4 sm:grid-cols-2" aria-label="Filtros do desempenho do modelo">
            <label className="text-xs font-medium text-court-textMuted">Time do jogador<select className="input mt-1 py-2 text-sm" value={teamFilter} onChange={event => { setTeamFilter(event.target.value); setPlayerFilter('all'); }}><option value="all">Todos os times</option>{Array.from(new Set(data.playerTeamFacets.map(item => item.team))).sort((a, b) => a.localeCompare(b)).map(team => <option key={team} value={team}>{team}</option>)}</select></label>
            <label className="text-xs font-medium text-court-textMuted">Jogador<select className="input mt-1 py-2 text-sm" value={playerFilter} onChange={event => setPlayerFilter(event.target.value)}><option value="all">Todos os jogadores</option>{playerOptions.map(player => <option key={player} value={player}>{player}</option>)}</select></label>
          </div>
          {!data.playerTeamFacets.length && <p className="text-xs leading-5 text-court-textMuted">Os próximos palpites serão registrados com o time do jogador. Previsões antigas não têm esse dado salvo.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-court-border py-4" aria-live="polite">
            <p className="text-sm text-court-text">
              {data.settled === 0
                ? 'Aguardando resultados reais para iniciar a avaliação.'
                : `${data.settled} previsões já foram apuradas.`}
            </p>
            <p className="text-xs text-court-textMuted">Temporada regular · modelo {data.modelVersion}</p>
          </div>

          <section aria-labelledby="overview-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="overview-title" className="text-lg font-semibold text-court-text">Visão geral</h2>
              {data.pending > 0 && <span className="text-xs text-court-textMuted">{data.pending} aguardando apuração</span>}
            </div>
            <dl className="grid grid-cols-2 divide-x divide-y divide-court-border border-y border-court-border sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6">
              <Metric label="Registradas" value={String(data.totalForecasts)} />
              <Metric label="Apuradas" value={String(data.settled)} />
              <Metric label="Acertos" value={String(data.wins)} detail={data.settled ? percent(data.hitRate) : 'Aguardando jogos'} />
              <Metric label="Erros" value={String(data.losses)} />
              <Metric label="Empates / anuladas" value={`${data.pushes} / ${data.voids}`} />
              <Metric label="ROI observado" value={data.roiPercent === null ? '—' : `${data.roiPercent.toFixed(1)}%`} detail={data.betsWithOdds ? `${data.netUnits.toFixed(2)} unidades · ${data.betsWithOdds} com odd` : 'Aguardando resultados com odd'} />
            </dl>
            {data.settled === 0 && (
              <p className="max-w-3xl text-xs leading-5 text-court-textMuted">
                As previsões da pré-temporada permanecem identificadas separadamente no <Link className="text-court-accent underline underline-offset-4" href="/history?phase=preseason">histórico de pré-temporada</Link>. Elas não entram nesta avaliação da temporada regular.
              </p>
            )}
          </section>

          <section aria-labelledby="markets-title" className="space-y-3">
            <div>
              <h2 id="markets-title" className="text-lg font-semibold text-court-text">Resultados por mercado</h2>
              <p className="mt-1 text-sm text-court-textMuted">Erro médio compara a projeção com a estatística final. Brier avalia a qualidade das probabilidades; valores menores são melhores.</p>
            </div>
            <div className="overflow-x-auto border-y border-court-border">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-court-textMuted">
                    <th scope="col" className="py-3 pr-4 font-medium">Mercado</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Previsões</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Apuradas</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Acerto</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Erro médio</th>
                    <th scope="col" className="py-3 pl-3 text-right font-medium">Brier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-court-border">
                  {data.byMarket.map(row => (
                    <tr key={row.market}>
                      <th scope="row" className="py-3 pr-4 font-medium text-court-text">{MARKET_LABELS[row.market]}</th>
                      <td className="px-3 py-3 text-right tabular-nums text-court-textMuted">{row.totalForecasts}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-court-textMuted">{row.settled}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-court-textMuted">{percent(row.hitRate)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-court-textMuted">{row.meanAbsoluteError === null ? '—' : row.meanAbsoluteError.toFixed(1)}</td>
                      <td className="py-3 pl-3 text-right tabular-nums text-court-textMuted">{row.brierScore === null ? '—' : row.brierScore.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.byMarket.every(row => row.settled === 0) && (
                <p className="border-t border-court-border py-4 text-sm text-court-textMuted">A comparação por mercado será preenchida conforme os jogos forem apurados.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="settled-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="settled-title" className="text-lg font-semibold text-court-text">Palpites apurados</h2>
                <p className="mt-1 text-sm text-court-textMuted">Até 50 resultados mais recentes da temporada regular.</p>
              </div>
              <Link href="/history" className="text-sm font-medium text-court-accent underline-offset-4 hover:underline">Abrir histórico completo</Link>
            </div>
            {data.recentSettled.length ? (
              <div className="overflow-x-auto border-y border-court-border">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-court-textMuted">
                      <th scope="col" className="py-3 pr-4 font-medium">Jogo / jogador</th>
                      <th scope="col" className="px-3 py-3 font-medium">Mercado</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Palpite</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Projeção / real</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Chance</th>
                      <th scope="col" className="py-3 pl-3 text-right font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-court-border">
                    {data.recentSettled.map(forecast => (
                      <tr key={forecast.id}>
                        <th scope="row" className="py-3 pr-4 font-medium text-court-text">
                          <span className="block">{forecast.player}</span>
                          <span className="mt-1 block text-xs font-normal text-court-textMuted">{forecast.game || `Partida ${forecast.id.slice(0, 8)}`}</span>
                        </th>
                        <td className="px-3 py-3 text-court-textMuted">{MARKET_LABELS[forecast.market]}</td>
                        <td className="px-3 py-3 text-right text-court-textMuted">{forecast.selection === 'Over' ? 'Mais de' : 'Menos de'} {forecast.line}{forecast.americanOdds === null ? '' : ` · ${forecast.americanOdds > 0 ? '+' : ''}${forecast.americanOdds}`}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-court-textMuted">{forecast.projection.toFixed(1)} / {forecast.actualValue?.toFixed(1) ?? '—'}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-court-textMuted">{percent(forecast.predictedProbability)}</td>
                        <td className={`py-3 pl-3 text-right font-medium ${forecast.result === 'won' ? 'text-court-success' : forecast.result === 'lost' ? 'text-court-danger' : 'text-court-textMuted'}`}>{RESULT_LABELS[forecast.result]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="border-y border-court-border py-5 text-sm text-court-textMuted">Os palpites aparecerão aqui depois que os jogos da temporada regular forem apurados.</p>
            )}
          </section>

          <p className="text-xs leading-5 text-court-textMuted">Esta aba mede as previsões individuais do modelo. As apostas salvas e seus resultados financeiros ficam na aba “Meus bilhetes salvos”.</p>
        </>
      ) : null}

      {activeTab === 'tickets' && <SavedTicketPerformance />}
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 sm:px-4 lg:px-3">
      <dt className="text-xs text-court-textMuted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-court-text">{value}</dd>
      {detail && <p className="mt-1 text-[11px] leading-4 text-court-textMuted">{detail}</p>}
    </div>
  );
}

type PersonalTicket = {
  id: string;
  label: string;
  bookmaker: string;
  combinedDecimalOdds: number | null;
  stakeAmount: number;
  potentialReturn: number | null;
  actualReturn: number | null;
  createdAt: string;
  outcome: 'pending' | 'won' | 'lost' | 'push/void';
  outcomeSource: 'manual' | 'forecast';
  legs: Array<{ player: string; playerTeam?: string | null }>;
};

const TICKET_OUTCOME_LABELS: Record<PersonalTicket['outcome'], string> = {
  pending: 'Pendente',
  won: 'Ganhou',
  lost: 'Perdeu',
  'push/void': 'Devolvida / anulada',
};

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function ticketReturn(ticket: PersonalTicket): number | null {
  if (ticket.outcome === 'pending') return null;
  if (ticket.actualReturn !== null) return ticket.actualReturn;
  if (ticket.outcome === 'lost') return 0;
  if (ticket.outcome === 'push/void') return ticket.stakeAmount;
  if (ticket.potentialReturn !== null) return ticket.potentialReturn;
  return ticket.combinedDecimalOdds === null ? null : ticket.stakeAmount * ticket.combinedDecimalOdds;
}

function SavedTicketPerformance() {
  const [tickets, setTickets] = useState<PersonalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [playerFilter, setPlayerFilter] = useState('all');

  useEffect(() => {
    let active = true;
    fetch('/api/analysis/nba/tickets', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os bilhetes salvos.');
        if (active) setTickets(body.tickets as PersonalTicket[]);
      })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar os bilhetes.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="h-40 animate-pulse rounded-lg bg-court-card" aria-label="Carregando bilhetes salvos" />;
  if (error) return <p role="alert" className="border-y border-court-danger/40 py-4 text-sm text-court-danger">{error}</p>;
  if (!tickets.length) return <div className="border-y border-court-border py-8"><h2 className="font-semibold text-court-text">Nenhum bilhete salvo ainda</h2><p className="mt-2 text-sm text-court-textMuted">Quando salvar uma sugestão ou montar seu bilhete no dashboard, o resultado aparecerá aqui separado das métricas gerais.</p><Link href="/" className="mt-3 inline-block text-sm font-medium text-court-accent underline-offset-4 hover:underline">Ir para o dashboard NBA</Link></div>;

  const ticketTeams = Array.from(new Set(tickets.flatMap(ticket => ticket.legs.map(leg => leg.playerTeam).filter((team): team is string => !!team)))).sort((a, b) => a.localeCompare(b));
  const ticketPlayers = Array.from(new Set(tickets.flatMap(ticket => ticket.legs.filter(leg => teamFilter === 'all' || leg.playerTeam === teamFilter).map(leg => leg.player)))).sort((a, b) => a.localeCompare(b));
  const filteredTickets = tickets.filter(ticket => ticket.legs.some(leg => (teamFilter === 'all' || leg.playerTeam === teamFilter) && (playerFilter === 'all' || leg.player === playerFilter)));
  const totalStaked = filteredTickets.reduce((total, ticket) => total + ticket.stakeAmount, 0);
  const settled = filteredTickets.filter(ticket => ticket.outcome !== 'pending');
  const withKnownReturn = settled.filter(ticket => ticketReturn(ticket) !== null);
  const settledStake = withKnownReturn.reduce((total, ticket) => total + ticket.stakeAmount, 0);
  const returned = withKnownReturn.reduce((total, ticket) => total + (ticketReturn(ticket) ?? 0), 0);
  const profit = returned - settledStake;
  const wins = filteredTickets.filter(ticket => ticket.outcome === 'won').length;
  const losses = filteredTickets.filter(ticket => ticket.outcome === 'lost').length;
  const pending = filteredTickets.filter(ticket => ticket.outcome === 'pending').length;
  const unknownReturns = settled.length - withKnownReturn.length;

  return (
    <section className="space-y-5" aria-labelledby="saved-bet-performance-title">
      <div>
        <h2 id="saved-bet-performance-title" className="text-lg font-semibold text-court-text">Desempenho dos bilhetes salvos</h2>
        <p className="mt-1 text-sm text-court-textMuted">Somente bilhetes registrados como apostas pessoais entram nestes números. O retorno recebido informado por você prevalece sobre a estimativa.</p>
      </div>
      <div className="grid gap-3 rounded-xl border border-court-border p-4 sm:grid-cols-2" aria-label="Filtros dos bilhetes pessoais">
        <label className="text-xs font-medium text-court-textMuted">Time do jogador<select className="input mt-1 py-2 text-sm" value={teamFilter} onChange={event => { setTeamFilter(event.target.value); setPlayerFilter('all'); }}><option value="all">Todos os times</option>{ticketTeams.map(team => <option key={team} value={team}>{team}</option>)}</select></label>
        <label className="text-xs font-medium text-court-textMuted">Jogador<select className="input mt-1 py-2 text-sm" value={playerFilter} onChange={event => setPlayerFilter(event.target.value)}><option value="all">Todos os jogadores</option>{ticketPlayers.map(player => <option key={player} value={player}>{player}</option>)}</select></label>
      </div>
      {!ticketTeams.length && <p className="text-xs leading-5 text-court-textMuted">O time dos jogadores será salvo nos novos bilhetes. Bilhetes antigos não têm essa informação registrada.</p>}
      <dl className="grid grid-cols-2 divide-x divide-y divide-court-border border-y border-court-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        <Metric label="Bilhetes salvos" value={String(filteredTickets.length)} />
        <Metric label="Pendentes" value={String(pending)} />
        <Metric label="Ganhos / perdidos" value={`${wins} / ${losses}`} />
        <Metric label="Total apostado" value={currency(totalStaked)} />
        <Metric label="Retorno apurado" value={currency(returned)} detail={`${withKnownReturn.length} resultados com retorno calculável`} />
        <Metric label="Lucro / prejuízo" value={withKnownReturn.length ? currency(profit) : '—'} detail={settledStake ? `ROI ${((profit / settledStake) * 100).toFixed(1)}%` : 'Aguardando apurações'} />
      </dl>
      {unknownReturns > 0 && <p className="text-xs leading-5 text-court-textMuted">{unknownReturns} bilhete(s) apurado(s) sem odd combinada ou retorno real informado não entram no cálculo financeiro. Você pode completar os dados no <Link href="/history" className="text-court-accent underline underline-offset-4">Histórico</Link>.</p>}
      <div className="space-y-2">
        {filteredTickets.slice(0, 10).map(ticket => (
          <article key={ticket.id} className="flex flex-col gap-3 border-b border-court-border py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-court-text">{ticket.label}</p>
              <p className="mt-1 text-xs text-court-textMuted">{ticket.bookmaker} · odd {ticket.combinedDecimalOdds?.toFixed(2) ?? 'não estimada'} · apostado {currency(ticket.stakeAmount)} · {ticket.outcomeSource === 'manual' ? 'resultado da casa' : 'apuração do sistema'}</p>
            </div>
            <div className="flex items-center gap-3 sm:text-right">
              <span className={`rounded px-2 py-1 text-xs font-semibold ${ticket.outcome === 'won' ? 'bg-court-success/15 text-court-success' : ticket.outcome === 'lost' ? 'bg-court-danger/15 text-court-danger' : 'bg-court-warning/15 text-court-warning'}`}>{TICKET_OUTCOME_LABELS[ticket.outcome]}</span>
              <span className="text-xs text-court-textMuted">Retorno {ticketReturn(ticket) === null ? '—' : currency(ticketReturn(ticket)!)}</span>
            </div>
          </article>
        ))}
      </div>
      {filteredTickets.length > 10 && <p className="text-xs text-court-textMuted">Mostrando 10 bilhetes recentes de {filteredTickets.length}. <Link href="/history" className="text-court-accent underline-offset-4 hover:underline">Abrir todos no Histórico</Link></p>}
      <p className="text-xs leading-5 text-court-textMuted">O resultado geral do modelo continua na aba “Resultados gerais” e mede previsões individuais, mesmo quando elas não foram incluídas em uma aposta.</p>
    </section>
  );
}
