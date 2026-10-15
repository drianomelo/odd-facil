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

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/analysis/nba/performance', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar o desempenho.');
      setData(body as Performance);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar os resultados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="space-y-7" aria-labelledby="performance-title">
      <div className="flex flex-col gap-3 border-b border-court-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="performance-title" className="text-2xl font-bold text-court-text sm:text-3xl">Desempenho do modelo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-court-textMuted">
            Acompanhe as previsões da temporada regular depois dos jogos. Os números abaixo medem o histórico registrado; ainda não comprovam rentabilidade futura.
          </p>
        </div>
        <Link href="/history?phase=regular" className="text-sm font-medium text-court-accent underline-offset-4 hover:underline">Ver previsões registradas</Link>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-court-danger/40 py-4 text-sm text-court-text">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="font-medium text-court-accent underline underline-offset-4">Tentar novamente</button>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-4" aria-label="Carregando desempenho">
          <div className="h-24 animate-pulse rounded-lg bg-court-card" />
          <div className="h-56 animate-pulse rounded-lg bg-court-card" />
        </div>
      ) : data ? (
        <>
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

          <p className="text-xs leading-5 text-court-textMuted">
            Esta página avalia cada previsão individual com sua linha e cotação registradas. O resultado dos bilhetes combinados e de cada perna fica no Histórico.
          </p>
        </>
      ) : null}
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
