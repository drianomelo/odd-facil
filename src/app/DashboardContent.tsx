import { formatAppDate, isGameStarted } from "@/lib/utils/date";
import { Opportunity, Game, SourceStatus } from "@/types";
import { OpportunityCard } from "@/components/OpportunityCard";
import { GameCard } from "@/components/GameCard";
import { SourceStatusCard } from "@/components/SourceStatusCard";
import { StatsSummary } from "@/components/StatsSummary";
import { headers } from "next/headers";
import { propMarketLabel } from "@/lib/api/propline";
import {
  PlayerPropCandidate,
  PlayerPropMarket,
} from "@/lib/analysis/player-props";
import { PLAYER_PROP_MODEL_VERSION } from "@/lib/analysis/player-prop-storage";
import { buildSuggestedTickets } from "@/lib/analysis/bet-builder";
import { PlayerAnalysisBoard } from "@/components/PlayerAnalysisBoard";
import { SuggestedTickets } from "@/components/SuggestedTickets";
import { PlayerSpotlight } from "@/components/PlayerSpotlight";

interface DashboardData {
  last_update: string;
  next_update: string;
  games_today: Game[];
  opportunities: Opportunity[];
  credit_usage: { used: number; remaining: number; limit: number };
  sources_status: SourceStatus[];
  demo_mode: boolean;
  player_analysis: {
    configured: boolean;
    source: string;
    fetchedAt: string;
    analyzedPlayers: number;
    recommendations: PlayerPropCandidate[];
    message?: string;
    tracking?: { enabled: boolean; saved: number };
  };
  player_performance: {
    modelVersion: string;
    seasonPhase: string;
    totalForecasts: number;
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
    byMarket: Array<{
      market: PlayerPropCandidate["market"];
      totalForecasts: number;
      pending: number;
      settled: number;
      wins: number;
      losses: number;
      pushes: number;
      hitRate: number | null;
      meanAbsoluteError: number | null;
      brierScore: number | null;
    }>;
    message?: string;
  };
}

const STATIC_DASHBOARD_MODE = process.env.DASHBOARD_DATA_SOURCE !== "api";
const STATIC_NOW = "2026-10-16T12:00:00-03:00";
const STATIC_GAME_DAY = "2026-10-20T19:00:00-03:00";

function makeStaticPick(input: {
  id: string;
  gameId: string;
  game: string;
  player: string;
  market: PlayerPropMarket;
  line: number;
  projection: number;
  side: "Over" | "Under";
  last5: number;
  last10: number;
  last20: number;
}): PlayerPropCandidate {
  const [awayTeam, homeTeam] = input.game.split(" @ ");
  const bookmaker = "DraftKings";
  const bookmakerKey = "draftkings";
  const quotes = (["Over", "Under"] as const).map((side) => ({
    side,
    price: -110,
    bookmaker,
    bookmakerKey,
    updatedAt: STATIC_NOW,
  }));
  const isOver = input.side === "Over";

  return {
    ...input,
    team: awayTeam,
    awayTeam,
    homeTeam,
    commenceTime: STATIC_GAME_DAY,
    last5Average: input.last5,
    last10Average: input.last10,
    last20Average: input.last20,
    probabilityOver: isOver ? 0.59 : 0.41,
    probabilityUnder: isOver ? 0.41 : 0.59,
    marketProbabilityOver: 0.5,
    marketProbabilityUnder: 0.5,
    bestOver: quotes[0],
    bestUnder: quotes[1],
    quotes,
    edge: isOver ? 0.09 : -0.09,
    expectedValue: isOver ? 0.127 : -0.127,
    edgeUnder: isOver ? -0.09 : 0.09,
    expectedValueUnder: isOver ? -0.127 : 0.127,
    recommendationSide: input.side,
    sampleSize: 20,
    shortlistEligible: true,
    averageMinutes: 34,
    minutesTrend: 0.98,
    opponentAverage: input.projection - (isOver ? 1 : -1),
    opponent: input.game.split(" @ ")[0],
    teamVerified: true,
    confidence: "moderada",
    reasons: [
      "Exemplo estático para visualização da interface.",
      "Cotação fictícia usada apenas como demonstração.",
    ],
    limitations: ["Dados de demonstração; não representam uma previsão atual."],
  };
}

const STATIC_PICKS: PlayerPropCandidate[] = [
  makeStaticPick({
    id: "demo-shai-points",
    gameId: "demo-game-1",
    game: "Oklahoma City Thunder @ San Antonio Spurs",
    player: "Shai Gilgeous-Alexander",
    market: "player_points",
    line: 26.5,
    projection: 28.1,
    side: "Over",
    last5: 28.2,
    last10: 27.4,
    last20: 26.8,
  }),
  makeStaticPick({
    id: "demo-booker-points",
    gameId: "demo-game-2",
    game: "Phoenix Suns @ Los Angeles Lakers",
    player: "Devin Booker",
    market: "player_points",
    line: 26.5,
    projection: 28.3,
    side: "Over",
    last5: 29.1,
    last10: 27.7,
    last20: 27.1,
  }),
  makeStaticPick({
    id: "demo-wemby-rebounds",
    gameId: "demo-game-3",
    game: "San Antonio Spurs @ Oklahoma City Thunder",
    player: "Victor Wembanyama",
    market: "player_rebounds",
    line: 10.5,
    projection: 9.4,
    side: "Under",
    last5: 9.2,
    last10: 9.8,
    last20: 10.1,
  }),
  makeStaticPick({
    id: "demo-tatum-rebounds",
    gameId: "demo-game-4",
    game: "Boston Celtics @ New York Knicks",
    player: "Jayson Tatum",
    market: "player_rebounds",
    line: 7.5,
    projection: 8.1,
    side: "Over",
    last5: 8.4,
    last10: 7.9,
    last20: 7.8,
  }),
  makeStaticPick({
    id: "demo-haliburton-assists",
    gameId: "demo-game-5",
    game: "Indiana Pacers @ Milwaukee Bucks",
    player: "Tyrese Haliburton",
    market: "player_assists",
    line: 8.5,
    projection: 9.4,
    side: "Over",
    last5: 9.8,
    last10: 9.2,
    last20: 8.9,
  }),
  makeStaticPick({
    id: "demo-morant-assists",
    gameId: "demo-game-6",
    game: "Memphis Grizzlies @ Dallas Mavericks",
    player: "Ja Morant",
    market: "player_assists",
    line: 7.5,
    projection: 8.2,
    side: "Over",
    last5: 8.4,
    last10: 7.9,
    last20: 7.7,
  }),
  makeStaticPick({
    id: "demo-ant-threes",
    gameId: "demo-game-7",
    game: "Minnesota Timberwolves @ Denver Nuggets",
    player: "Anthony Edwards",
    market: "player_threes",
    line: 2.5,
    projection: 3.1,
    side: "Over",
    last5: 3.4,
    last10: 3.0,
    last20: 2.9,
  }),
  makeStaticPick({
    id: "demo-curry-threes",
    gameId: "demo-game-8",
    game: "Golden State Warriors @ Los Angeles Clippers",
    player: "Stephen Curry",
    market: "player_threes",
    line: 4.5,
    projection: 5.0,
    side: "Over",
    last5: 5.2,
    last10: 4.9,
    last20: 4.8,
  }),
  makeStaticPick({
    id: "demo-luka-pra",
    gameId: "demo-game-9",
    game: "Los Angeles Lakers @ Phoenix Suns",
    player: "Luka Dončić",
    market: "player_points_rebounds_assists",
    line: 44.5,
    projection: 46.2,
    side: "Over",
    last5: 47.0,
    last10: 45.8,
    last20: 45.2,
  }),
  makeStaticPick({
    id: "demo-jokic-pra",
    gameId: "demo-game-10",
    game: "Denver Nuggets @ Minnesota Timberwolves",
    player: "Nikola Jokić",
    market: "player_points_rebounds_assists",
    line: 52.5,
    projection: 54.0,
    side: "Over",
    last5: 55.1,
    last10: 53.8,
    last20: 53.2,
  }),
];

const STATIC_DASHBOARD_DATA: DashboardData = {
  last_update: STATIC_NOW,
  next_update: "2026-10-17T12:00:00-03:00",
  games_today: [],
  opportunities: [],
  credit_usage: { used: 0, remaining: 0, limit: 0 },
  sources_status: [
    {
      name: "The Odds API",
      status: "unconfigured",
      last_check: STATIC_NOW,
      message: "Pausada no modo visual estático",
    },
    {
      name: "Banco de Dados (Neon)",
      status: "unconfigured",
      last_check: STATIC_NOW,
      message: "Pausado no modo visual estático",
    },
    {
      name: "Props e estatísticas NBA (PropLine)",
      status: "unconfigured",
      last_check: STATIC_NOW,
      message: "Pausada no modo visual estático",
    },
  ],
  demo_mode: true,
  player_analysis: {
    configured: true,
    source: "dados-estaticos",
    fetchedAt: STATIC_NOW,
    analyzedPlayers: 10,
    recommendations: STATIC_PICKS,
    message:
      "Dados demonstrativos para ajustes visuais. Nenhuma API foi consultada.",
  },
  player_performance: {
    modelVersion: "demo-estatico",
    seasonPhase: "regular",
    totalForecasts: 0,
    pending: 0,
    settled: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    voids: 0,
    hitRate: null,
    brierScore: null,
    betsWithOdds: 0,
    netUnits: 0,
    roiPercent: null,
    byMarket: [],
  },
};

async function fetchDashboardData(): Promise<DashboardData> {
  const requestHeaders = headers();
  const host = requestHeaders.get("host");
  if (!host) throw new Error("Host da requisição não disponível");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.startsWith("localhost:") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  const today = formatAppDate(new Date(), "yyyy-MM-dd");
  const endDate = new Date(`${today}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const through = endDate.toISOString().slice(0, 10);

  const [opportunitiesRes, gamesRes, creditsRes, playerAnalysisRes] =
    await Promise.all([
      fetch(`${baseUrl}/api/opportunities?date=${today}&qualified=true`, {
        next: { revalidate: 60 },
      }),
      fetch(`${baseUrl}/api/games?from=${today}&to=${through}`, {
        cache: "no-store",
      }),
      fetch(`${baseUrl}/api/credits`, { next: { revalidate: 60 } }),
      fetch(
        `${baseUrl}/api/analysis/nba?from=${today}&to=${through}&model=${PLAYER_PROP_MODEL_VERSION}`,
        { next: { revalidate: 900 } },
      ),
    ]);
  // The analysis endpoint records forecasts before it responds. Load performance
  // afterward so the totals include the same forecast batch shown on the page.
  const performanceRes = await fetch(
    `${baseUrl}/api/analysis/nba/performance?model=${PLAYER_PROP_MODEL_VERSION}`,
    { cache: "no-store" },
  );

  const [
    opportunitiesData,
    gamesData,
    creditsData,
    playerAnalysis,
    playerPerformance,
  ] = await Promise.all([
    opportunitiesRes.json(),
    gamesRes.json(),
    creditsRes.json(),
    playerAnalysisRes.json(),
    performanceRes.json(),
  ]);

  const oddsApiConfigured = !!process.env.ODDS_API_KEY;
  const dbConfigured = !!process.env.DATABASE_URL;
  const propLineConfigured = !!process.env.PROPLINE_API_KEY;

  return {
    last_update: new Date().toISOString(),
    next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    games_today: gamesData.games || [],
    opportunities: opportunitiesData.opportunities || [],
    credit_usage: creditsData || { used: 0, remaining: 500, limit: 400 },
    sources_status: [
      {
        name: "The Odds API",
        status: oddsApiConfigured ? "ok" : "unconfigured",
        last_check: new Date().toISOString(),
        credits_remaining: creditsData?.remaining,
        message: oddsApiConfigured ? "Operacional" : "Configure ODDS_API_KEY",
      },
      {
        name: "Banco de Dados (Neon)",
        status: dbConfigured ? "ok" : "unconfigured",
        last_check: new Date().toISOString(),
        message: dbConfigured ? "Conectado" : "Configure DATABASE_URL",
      },
      {
        name: "Props e estatísticas NBA (PropLine)",
        status: propLineConfigured ? "ok" : "unconfigured",
        last_check: new Date().toISOString(),
        message: propLineConfigured
          ? "Odds de props e logs de jogadores disponíveis"
          : "Configure uma chave grátis em PROPLINE_API_KEY",
      },
    ],
    demo_mode: process.env.DEMO_MODE === "true",
    player_analysis: playerAnalysis,
    player_performance: playerPerformance,
  };
}

export async function DashboardContent() {
  const data = STATIC_DASHBOARD_MODE
    ? STATIC_DASHBOARD_DATA
    : await fetchDashboardData();
  const qualifiedOps = data.opportunities.filter((o) => o.qualified);
  const unqualifiedOps = data.opportunities.filter((o) => !o.qualified);
  const scheduledGames = data.games_today.filter(
    (g) => g.status === "scheduled" && !isGameStarted(g.commence_time),
  );
  const liveGames = data.games_today.filter((g) => g.status === "live");
  const finishedGames = data.games_today.filter((g) => g.status === "finished");
  const propMarkets: PlayerPropMarket[] = [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_points_rebounds_assists",
  ];
  const selectedExpectedValue = (pick: PlayerPropCandidate) =>
    pick.recommendationSide === "Under"
      ? (pick.expectedValueUnder ?? -1)
      : (pick.expectedValue ?? -1);
  const recommendationsByMarket = propMarkets
    .map((market) => {
      const allPicks = data.player_analysis.recommendations
        .filter((pick) => pick.market === market)
        .sort(
          (a, b) =>
            Number(b.shortlistEligible) - Number(a.shortlistEligible) ||
            selectedExpectedValue(b) - selectedExpectedValue(a) ||
            Math.max(b.edge ?? -1, b.edgeUnder ?? -1) -
              Math.max(a.edge ?? -1, a.edgeUnder ?? -1),
        );
      return { market, allPicks, picks: allPicks.slice(0, 2) };
    })
    .filter((group) => group.allPicks.length > 0);
  const suggestedTickets = buildSuggestedTickets(
    data.player_analysis.recommendations,
  );

  return (
    <div className="animate-in">
      <section
        aria-label="Painel inicial NBA"
        className="relative isolate w-full overflow-hidden bg-white text-white"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[#ed174b] z-10"
          style={{ clipPath: "polygon(45% 0%, 55% 90%, 100% 100%, 100% 0%)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[#006BB6]"
          style={{ clipPath: "polygon(0% 0%, 0% 100%, 100% 70%, 100% 0%)" }}
        />
        <div className="relative mx-auto grid min-h-[70svh] grid-cols-1 items-stretch lg:grid-cols-[minmax(270px,1fr)_minmax(260px,0.8fr)_minmax(280px,1fr)]">
          <aside className="relative z-10 order-3 flex items-center px-6 py-7 sm:px-10 lg:order-3 lg:px-12 lg:py-12">
            <div className="w-full">
              <SourceStatusCard
                sources={data.sources_status}
                creditUsage={data.credit_usage}
                staticMode={STATIC_DASHBOARD_MODE}
              />
            </div>
          </aside>

          <div className="relative order-1 min-h-[50vh] lg:order-2 lg:min-h-0">
            <PlayerSpotlight />
          </div>

          <div className="relative z-10 order-2 flex items-center px-6 py-7 sm:px-10 lg:order-1 lg:px-12 lg:py-12">
            <StatsSummary
              opportunities={qualifiedOps.length}
              playerPicks={recommendationsByMarket.reduce(
                (total, group) => total + group.picks.length,
                0,
              )}
              playerAnalysisConfigured={data.player_analysis.configured}
              games={scheduledGames.length}
              lastUpdate={data.last_update}
              nextUpdate={data.next_update}
              demoMode={data.demo_mode}
              staticMode={STATIC_DASHBOARD_MODE}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="player-analysis-heading"
          className="space-y-4"
        >
          <div>
            <h3
              id="player-analysis-heading"
              className="text-lg font-semibold text-[#005A9C]"
            >
              Radar de props de jogadores
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Projeções próprias a partir de logs e minutos. O radar organiza
              sinais para validação; ainda não são recomendações finais.
            </p>
          </div>
          {!data.player_analysis.configured ? (
            <div className="card border-[#58A9E3]/60 bg-[#EAF5FC]">
              <h4 className="font-semibold text-[#005A9C]">
                Fonte gratuita ainda não configurada
              </h4>
              <p className="mt-2 text-sm text-slate-600">
                {data.player_analysis.message}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Cadastre-se no plano gratuito da PropLine (sem cartão) e
                adicione <code>PROPLINE_API_KEY</code> ao arquivo{" "}
                <code>.env.local</code>. A chave fica somente no seu computador.
              </p>
            </div>
          ) : data.player_analysis.recommendations.length ? (
            <>
              <p className="text-xs text-amber-800">
                O modelo ainda não passou por backtest. “Candidato para
                validação” exige amostra maior, minutos estáveis e cotação
                pareada; o EV continua experimental. Confira escalações e
                desfalques.
              </p>
              <p className="text-xs text-slate-600">
                {STATIC_DASHBOARD_MODE
                  ? "Dados demonstrativos locais; previsões e resultados não são gravados."
                  : data.player_analysis.tracking?.enabled
                    ? `${data.player_analysis.tracking.saved} novas previsões foram registradas para comparar com os resultados.`
                    : "O armazenamento do histórico está indisponível; confira DATABASE_URL e a migração do banco."}
              </p>
              <SuggestedTickets
                tickets={suggestedTickets}
                saveEnabled={!STATIC_DASHBOARD_MODE}
              />
              <PlayerAnalysisBoard
                saveEnabled={!STATIC_DASHBOARD_MODE}
                groups={recommendationsByMarket.map(
                  ({ market, allPicks, picks }) => ({
                    market,
                    totalCount: allPicks.length,
                    eligibleCount: allPicks.filter(
                      (pick) => pick.shortlistEligible,
                    ).length,
                    picks,
                    performance: data.player_performance.byMarket.find(
                      (row) => row.market === market,
                    ),
                  }),
                )}
              />
              <p className="text-xs text-slate-600">
                Acompanhamento: {data.player_performance.totalForecasts}{" "}
                registradas · {data.player_performance.pending} pendentes ·{" "}
                {data.player_performance.settled} apuradas
                {data.player_performance.hitRate !== null
                  ? ` · acerto ${(data.player_performance.hitRate * 100).toFixed(1)}%`
                  : ""}
                {data.player_performance.brierScore !== null
                  ? ` · Brier ${data.player_performance.brierScore.toFixed(3)}`
                  : ""}
                {data.player_performance.roiPercent !== null
                  ? ` · ROI ${data.player_performance.roiPercent.toFixed(1)}% (${data.player_performance.betsWithOdds} cotações)`
                  : ""}
              </p>
              <p className="text-xs text-court-textMuted">
                Métricas abaixo acompanham a temporada regular do modelo{" "}
                {data.player_performance.modelVersion}; a pré-temporada fica
                separada no histórico.
              </p>
              {data.player_performance.settled > 0 && (
                <div className="overflow-x-auto rounded-xl border border-[#58A9E3]/50 bg-white">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-[#EAF5FC] text-slate-600">
                      <tr>
                        <th className="p-2">Mercado</th>
                        <th className="p-2">Apuradas</th>
                        <th className="p-2">W-L-P</th>
                        <th className="p-2">Acerto</th>
                        <th className="p-2">Erro médio</th>
                        <th className="p-2">Brier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.player_performance.byMarket
                        .filter((row) => row.settled > 0)
                        .map((row) => (
                          <tr
                            key={row.market}
                            className="border-t border-[#58A9E3]/30"
                          >
                            <td className="p-2">
                              {propMarketLabel(row.market)}
                            </td>
                            <td className="p-2">{row.settled}</td>
                            <td className="p-2">
                              {row.wins}-{row.losses}-{row.pushes}
                            </td>
                            <td className="p-2">
                              {row.hitRate === null
                                ? "—"
                                : `${(row.hitRate * 100).toFixed(1)}%`}
                            </td>
                            <td className="p-2">
                              {row.meanAbsoluteError === null
                                ? "—"
                                : row.meanAbsoluteError.toFixed(1)}
                            </td>
                            <td className="p-2">
                              {row.brierScore === null
                                ? "—"
                                : row.brierScore.toFixed(3)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="card border-[#58A9E3]/50 bg-[#EAF5FC] text-sm text-slate-600">
              {data.player_analysis.message ||
                "Os dados disponíveis ainda não sustentam uma recomendação com amostra suficiente."}
            </div>
          )}
        </section>

        {(qualifiedOps.length > 0 || unqualifiedOps.length > 0) && (
          <section
            aria-labelledby="opportunities-heading"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3
                id="opportunities-heading"
                className="text-lg font-semibold text-[#005A9C]"
              >
                Oportunidades do Dia ({qualifiedOps.length} qualificadas)
              </h3>
              {unqualifiedOps.length > 0 && (
                <span className="badge border border-amber-700/20 bg-amber-50 text-amber-800">
                  {unqualifiedOps.length} não qualificadas
                </span>
              )}
            </div>

            {qualifiedOps.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {qualifiedOps.map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </div>
            )}

            {qualifiedOps.length === 0 && (
              <div className="card border-[#58A9E3]/50 bg-[#F4FAFE] py-8 text-center">
                <svg
                  className="mx-auto mb-4 h-12 w-12 text-[#005A9C]/70"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <h4 className="mb-1 text-lg font-semibold text-[#005A9C]">
                  Nenhuma oportunidade qualificada hoje
                </h4>
                <p className="text-slate-600">
                  Os critérios atuais (EV ≥ 5%, completude ≥ 60%) não foram
                  atendidos. Aguarde mais dados ou consulte o radar experimental
                  de props dos jogadores.
                </p>
              </div>
            )}

            {unqualifiedOps.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer flex items-center justify-between rounded-xl border border-[#58A9E3]/40 bg-white p-4 transition-colors hover:border-[#005A9C]/50 hover:bg-[#F4FAFE]">
                  <span className="font-medium text-court-text">
                    Ver oportunidades não qualificadas ({unqualifiedOps.length})
                  </span>
                  <svg
                    className="w-5 h-5 text-court-textMuted transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="grid gap-4 border-t border-[#58A9E3]/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {unqualifiedOps.map((opp) => (
                    <OpportunityCard key={opp.id} opportunity={opp} />
                  ))}
                </div>
              </details>
            )}
          </section>
        )}

        <section aria-labelledby="games-heading" className="space-y-4">
          <h3
            id="games-heading"
            className="text-lg font-semibold text-[#005A9C]"
          >
            Jogos nos Próximos 7 Dias ({scheduledGames.length} agendados
            {liveGames.length > 0 ? `, ${liveGames.length} ao vivo` : ""})
          </h3>
          <p className="-mt-2 text-sm text-slate-600">
            Probabilidades de vencedor calculadas pela média das odds sem a
            margem das casas. São estimativas de mercado, não previsões
            estatísticas independentes.
          </p>

          {scheduledGames.length > 0 && (
            <div className="space-y-2">
              {scheduledGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}

          {liveGames.length > 0 && (
            <details>
              <summary className="cursor-pointer flex items-center justify-between rounded-xl border border-[#58A9E3]/40 bg-white p-4 transition-colors hover:border-[#005A9C]/50 hover:bg-[#F4FAFE]">
                <span className="font-medium text-court-text">
                  Jogos ao vivo ({liveGames.length})
                </span>
                <span className="badge badge-danger animate-pulse">
                  AO VIVO
                </span>
              </summary>
              <div className="space-y-2 border-t border-[#58A9E3]/30 p-4">
                {liveGames.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </details>
          )}

          {finishedGames.length > 0 && (
            <details>
              <summary className="cursor-pointer flex items-center justify-between rounded-xl border border-[#58A9E3]/40 bg-white p-4 transition-colors hover:border-[#005A9C]/50 hover:bg-[#F4FAFE]">
                <span className="font-medium text-court-text">
                  Finalizados ({finishedGames.length})
                </span>
              </summary>
              <div className="space-y-2 border-t border-[#58A9E3]/30 p-4">
                {finishedGames.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </details>
          )}

          {scheduledGames.length === 0 &&
            liveGames.length === 0 &&
            finishedGames.length === 0 && (
              <div className="card border-[#58A9E3]/50 bg-[#F4FAFE] py-8 text-center">
                <svg
                  className="mx-auto mb-4 h-12 w-12 text-[#005A9C]/70"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h4 className="mb-1 text-lg font-semibold text-[#005A9C]">
                  Nenhum jogo agendado para hoje
                </h4>
                <p className="text-slate-600">
                  Ainda não há jogos ou odds publicados para os próximos dias.
                </p>
              </div>
            )}
        </section>
      </div>
    </div>
  );
}
