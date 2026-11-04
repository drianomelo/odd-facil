"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  RefreshCw,
  Search,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { NBA_TEAMS, TeamLogo, getNbaTeamInfo } from "@/components/TeamLogo";
import type {
  PlayerPropMarket,
  PlayerPropQuote,
} from "@/lib/analysis/player-props";
import { formatAppDate, formatAppDateTime } from "@/lib/utils/date";

type PlayerLog = {
  eventId: string;
  date: string;
  opponent: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
};

type SeasonPlayer = {
  playerId: string;
  player: string;
  team: string;
  games: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
  last5: {
    games: number;
    points: number;
    rebounds: number;
    assists: number;
    threes: number;
  };
  logs: PlayerLog[];
};

type Market = {
  id: PlayerPropMarket;
  label: string;
  short: string;
  stat: (log: PlayerLog) => number;
  average: (player: SeasonPlayer) => number;
};
type GameWindow = 5 | 10 | 20;
const GAME_WINDOWS: GameWindow[] = [5, 10, 20];
const HERO_PLAYERS = [
  { id: "203999", name: "Nikola Jokic" },
  { id: "1629029", name: "Luka Doncic" },
  { id: "1628983", name: "Shai Gilgeous-Alexander" },
  { id: "203507", name: "Giannis Antetokounmpo" },
  { id: "1641705", name: "Victor Wembanyama" },
  { id: "202331", name: "Paul George" },
];

const MARKETS: Market[] = [
  {
    id: "player_points",
    label: "Pontos",
    short: "PTS",
    stat: (log) => log.points,
    average: (player) => player.points,
  },
  {
    id: "player_rebounds",
    label: "Rebotes",
    short: "REB",
    stat: (log) => log.rebounds,
    average: (player) => player.rebounds,
  },
  {
    id: "player_assists",
    label: "Assistências",
    short: "AST",
    stat: (log) => log.assists,
    average: (player) => player.assists,
  },
  {
    id: "player_threes",
    label: "Cestas de 3",
    short: "3PM",
    stat: (log) => log.threes,
    average: (player) => player.threes,
  },
];

type MarketLine = {
  eventId: string;
  player: string;
  market: PlayerPropMarket;
  line: number;
  quotes: PlayerPropQuote[];
  game: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
};
type MarketLineResponse = {
  marketLines?: MarketLine[];
  message?: string;
  error?: string;
  configured?: boolean;
};
type SeasonResponse = {
  players?: SeasonPlayer[];
  season?: string;
  error?: string;
};
const MIN_AVERAGE_MINUTES = 20;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeTeam(value: string) {
  return normalize(getNbaTeamInfo(value)?.names[0] || value);
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function dateLabel(date: string) {
  return formatAppDate(date, "dd/MM");
}

function decimalPrice(price: number) {
  return price > 0 ? 1 + price / 100 : 1 + 100 / -price;
}

function bestOverQuote(marketLine: MarketLine) {
  return marketLine.quotes
    .filter((quote) => quote.side === "Over")
    .sort((a, b) => decimalPrice(b.price) - decimalPrice(a.price))[0];
}

function marketLineKey(marketLine: MarketLine) {
  return `${marketLine.eventId}:${marketLine.market}:${marketLine.line}`;
}

function getLineRates(player: SeasonPlayer, marketLine: MarketLine) {
  const marketOption = MARKETS.find(
    (option) => option.id === marketLine.market,
  );
  if (!marketOption) return [];
  return GAME_WINDOWS.map((window) => {
    const sample = player.logs.slice(0, window);
    const hits = sample.filter(
      (log) => marketOption.stat(log) > marketLine.line,
    ).length;
    return {
      window,
      hits,
      sampleSize: sample.length,
      percentage: sample.length
        ? Math.round((hits / sample.length) * 100)
        : null,
    };
  });
}

function formatRate(rate: ReturnType<typeof getLineRates>[number]) {
  return rate.percentage === null
    ? "—"
    : `${rate.percentage}% (${rate.hits}/${rate.sampleSize})`;
}

export function PlayerMarketExplorer() {
  const [players, setPlayers] = useState<SeasonPlayer[]>([]);
  const [season, setSeason] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [marketId, setMarketId] = useState<PlayerPropMarket>("player_points");
  const [gameWindow, setGameWindow] = useState<GameWindow>(10);
  const [line, setLine] = useState("");
  const [marketData, setMarketData] = useState<MarketLineResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketRefreshKey, setMarketRefreshKey] = useState(0);
  const [candidateId, setCandidateId] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/analysis/nba/season-base", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as SeasonResponse;
        if (!response.ok)
          throw new Error(
            body.error || "Não foi possível carregar os dados da temporada.",
          );
        return body;
      })
      .then((body) => {
        if (!active) return;
        setPlayers(
          (body.players || []).filter(
            (player) => player.minutes > MIN_AVERAGE_MINUTES,
          ),
        );
        setSeason(body.season || "");
      })
      .catch((error) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Falha ao carregar os dados.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (marketData) return;
    let active = true;
    setMarketLoading(true);
    setMarketError("");
    fetch("/api/analysis/nba/market-lines", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as MarketLineResponse;
        if (!response.ok)
          throw new Error(
            body.message || "As linhas de mercado não estão disponíveis agora.",
          );
        return body;
      })
      .then((body) => {
        if (active) setMarketData(body);
      })
      .catch((error) => {
        if (active)
          setMarketError(
            error instanceof Error
              ? error.message
              : "Falha ao consultar as linhas.",
          );
      })
      .finally(() => {
        if (active) setMarketLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedTeam, marketData, marketRefreshKey]);

  const teamCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of players)
      counts.set(
        normalizeTeam(player.team),
        (counts.get(normalizeTeam(player.team)) || 0) + 1,
      );
    return counts;
  }, [players]);

  const currentTeam = NBA_TEAMS.find(
    (team) =>
      team.names.some(
        (name) => normalize(name) === normalize(selectedTeam || ""),
      ) || normalize(team.abbreviation) === normalize(selectedTeam || ""),
  );
  const teamPlayers = useMemo(
    () =>
      players
        .filter(
          (player) =>
            !selectedTeam ||
            normalizeTeam(player.team) === normalizeTeam(selectedTeam),
        )
        .filter((player) =>
          normalize(player.player).includes(normalize(search)),
        )
        .sort(
          (a, b) =>
            b.minutes - a.minutes ||
            b.points - a.points ||
            a.player.localeCompare(b.player, "pt-BR"),
        ),
    [players, selectedTeam, search],
  );
  const selectedPlayer =
    players.find((player) => player.playerId === selectedPlayerId) || null;
  const market = MARKETS.find((item) => item.id === marketId) || MARKETS[0];
  const allMarketLines = marketData?.marketLines || [];
  const teamMarketLines = useMemo(
    () =>
      allMarketLines.filter((marketLine) => {
        const player = players.find(
          (item) => normalize(item.player) === normalize(marketLine.player),
        );
        if (
          !player ||
          !selectedTeam ||
          normalizeTeam(player.team) !== normalizeTeam(selectedTeam)
        )
          return false;
        return (
          normalizeTeam(player.team) === normalizeTeam(marketLine.homeTeam) ||
          normalizeTeam(player.team) === normalizeTeam(marketLine.awayTeam)
        );
      }),
    [allMarketLines, players, selectedTeam],
  );
  const teamPlayerLineRates = useMemo(() => {
    const byPlayer = new Map<
      string,
      Array<{
        marketLine: MarketLine;
        short: string;
        rates: ReturnType<typeof getLineRates>;
      }>
    >();
    for (const marketLine of teamMarketLines) {
      const player = players.find(
        (item) => normalize(item.player) === normalize(marketLine.player),
      );
      const marketOption = MARKETS.find(
        (option) => option.id === marketLine.market,
      );
      if (!player || !marketOption) continue;
      const rows = byPlayer.get(player.playerId) || [];
      const existingIndex = rows.findIndex(
        (row) => row.marketLine.market === marketLine.market,
      );
      const nextRow = {
        marketLine,
        short: marketOption.short,
        rates: getLineRates(player, marketLine),
      };
      if (existingIndex < 0) rows.push(nextRow);
      else if (marketLine.line > rows[existingIndex].marketLine.line)
        rows[existingIndex] = nextRow;
      byPlayer.set(player.playerId, rows);
    }
    byPlayer.forEach((rows) =>
      rows.sort((a, b) => a.short.localeCompare(b.short)),
    );
    return byPlayer;
  }, [teamMarketLines, players]);
  const perfectFiveLines = useMemo(() => {
    const qualified = allMarketLines.flatMap((marketLine) => {
      const player = players.find(
        (item) => normalize(item.player) === normalize(marketLine.player),
      );
      const marketOption = MARKETS.find(
        (item) => item.id === marketLine.market,
      );
      if (!player || !marketOption || player.logs.length < 5) return [];
      // Only compare a player's own team's current line and exactly five games
      // from the configured current season.
      if (
        normalizeTeam(player.team) !== normalizeTeam(marketLine.homeTeam) &&
        normalizeTeam(player.team) !== normalizeTeam(marketLine.awayTeam)
      )
        return [];
      const sample = player.logs.slice(0, 5);
      const values = sample.map(marketOption.stat);
      const hits = values.filter((value) => value > marketLine.line).length;
      if (sample.length !== 5 || hits !== 5) return [];
      const average =
        values.reduce((sum, value) => sum + value, 0) / sample.length;
      return [{ player, marketLine, hits, sample: sample.length, average }];
    });

    // PropLine can return slightly different main lines across books. Keep one
    // card per player and market, showing the highest line still cleared 5/5.
    const unique = new Map<string, (typeof qualified)[number]>();
    for (const item of qualified) {
      const key = `${item.player.playerId}:${item.marketLine.market}`;
      const current = unique.get(key);
      if (
        !current ||
        item.marketLine.line > current.marketLine.line ||
        (item.marketLine.line === current.marketLine.line &&
          Date.parse(item.marketLine.commenceTime) <
            Date.parse(current.marketLine.commenceTime))
      ) {
        unique.set(key, item);
      }
    }

    return Array.from(unique.values()).sort(
      (a, b) =>
        Date.parse(a.marketLine.commenceTime) -
          Date.parse(b.marketLine.commenceTime) ||
        a.player.player.localeCompare(b.player.player, "pt-BR") ||
        a.marketLine.market.localeCompare(b.marketLine.market),
    );
  }, [allMarketLines, players]);
  const teamHighlights = useMemo(() => {
    const compared = teamMarketLines
      .flatMap((marketLine) => {
        const player = players.find(
          (item) => normalize(item.player) === normalize(marketLine.player),
        );
        const marketOption = MARKETS.find(
          (item) => item.id === marketLine.market,
        );
        if (!player || !marketOption) return [];
        const sample = player.logs.slice(0, 10);
        if (sample.length < 3) return [];
        const values = sample.map(marketOption.stat);
        const hits = values.filter((value) => value > marketLine.line).length;
        const average =
          values.reduce((sum, value) => sum + value, 0) / values.length;
        return [
          {
            player,
            marketLine,
            hits,
            sample: values.length,
            average,
            hitRate: hits / values.length,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.hitRate - a.hitRate ||
          b.average - b.marketLine.line - (a.average - a.marketLine.line) ||
          b.player.games - a.player.games,
      );
    const seen = new Set<string>();
    return compared
      .filter((item) => {
        const key = normalize(item.player.player);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }, [teamMarketLines, players]);
  const playerMarketLines = selectedPlayer
    ? teamMarketLines
        .filter(
          (marketLine) =>
            normalize(marketLine.player) === normalize(selectedPlayer.player) &&
            marketLine.market === marketId,
        )
        .sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime))
    : [];
  const activeMarketLine =
    playerMarketLines.find((item) => marketLineKey(item) === candidateId) ||
    playerMarketLines[0];
  const lineNumber =
    line === "" ? (activeMarketLine?.line ?? null) : Number(line);
  // The API returns this season's games newest-first. Reverse the selected
  // window so the chart reads left-to-right from oldest to newest.
  const logs = selectedPlayer
    ? [...selectedPlayer.logs].slice(0, gameWindow).reverse()
    : [];
  const recentValues = selectedPlayer ? logs.map(market.stat) : [];
  const maxValue = Math.max(1, lineNumber ?? 0, ...recentValues) * 1.12;
  const hitCount =
    lineNumber === null
      ? null
      : recentValues.filter((value) => value > lineNumber).length;
  const hitPercentage =
    hitCount === null || !recentValues.length
      ? null
      : (hitCount / recentValues.length) * 100;

  function chooseTeam(name: string) {
    setSelectedTeam(name);
    setSelectedPlayerId(null);
    setSearch("");
    setMarketId("player_points");
    setLine("");
    setCandidateId("");
  }

  function choosePlayer(player: SeasonPlayer) {
    setSelectedPlayerId(player.playerId);
    setMarketId("player_points");
    setLine("");
    setCandidateId("");
  }

  function openPlayerAnalysis(
    player: SeasonPlayer,
    selectedMarket: PlayerPropMarket,
  ) {
    setSelectedTeam(player.team);
    setSelectedPlayerId(player.playerId);
    setSearch("");
    setMarketId(selectedMarket);
    setLine("");
    setCandidateId("");
  }

  function chooseMarket(nextMarket: PlayerPropMarket) {
    setMarketId(nextMarket);
    setLine("");
    setCandidateId("");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#07090B]">
      <div className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-7 lg:px-0">
        <section
          aria-labelledby="hero-players-title"
          className="relative left-1/2 mb-7 w-screen -translate-x-1/2 overflow-hidden border-b border-white/10"
        >
          <div className="mx-auto flex max-w-[1440px] items-center justify-between overflow-hidden px-4 pt-3 sm:px-7 lg:px-10">
            <div className="flex flex-col gap-3">
              {/* <div className="mb-2">
                <h1
                  id="hero-players-title"
                  className="text-3xl mb-3 font-bold tracking-tight text-white sm:text-[40px]"
                >
                  Destaques da NBA
                </h1>
                <p className="mt-1 text-[13px] w-3/4 text-white/50">
                  Escolha um time, explore seus jogadores e compare o desempenho
                  recente de cada atleta com as linhas dos mercados disponíveis
                  nesta temporada.
                </p>
              </div> */}

              <div className="flex flex-col gap-5 rounded-full text-base tracking-widest text-white">
                <span className="inline-flex items-center gap-3 font-semibold">
                  <span className="w-10 h-10 -mt-1 shadow-[0_0_0_4px_rgba(0,208,132,0.12)] border-2 border-[#00D084] rounded-full bg-[#07090B] flex items-center justify-center animate-pulse">
                    <UsersRound
                      aria-hidden="true"
                      className="w-[17px] h-[17px] text-[#00D084]"
                    />
                  </span>
                  {players.length} Atletas analisados
                </span>
                <span className="inline-flex items-center gap-3 font-semibold">
                  <span className="w-10 h-10 -mt-1 shadow-[0_0_0_4px_rgba(200,16,46,0.12)] border-2 border-[#C8102E] rounded-full bg-[#07090B] flex items-center justify-center animate-pulse">
                    <CalendarDays
                      aria-hidden="true"
                      className="w-[17px] h-[17px] text-[#C8102E]"
                    />
                  </span>
                  {season || "Temporada atual"}
                </span>
              </div>
            </div>

            <div
              className="flex flex-row-reverse -mb-5"
              aria-label="Imagens de jogadores da NBA"
            >
              {HERO_PLAYERS.map((player, index) => (
                <div
                  key={player.id}
                  className={`relative shrink-0 ${index ? "-mr-40" : ""}`}
                  style={{ zIndex: index + 1 }}
                >
                  <img
                    src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`}
                    alt={player.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <nav aria-label="Etapas da análise" className="mb-7 w-full py-2">
          <div className="relative grid w-full grid-cols-3">
            <div
              aria-hidden="true"
              className="absolute left-[16.6667%] right-[16.6667%] top-[23px] h-0.5 bg-white/20"
            >
              <div
                className="h-full bg-[#00519F] transition-[width] duration-300"
                style={{
                  width: selectedPlayer ? "100%" : selectedTeam ? "50%" : "0%",
                }}
              />
            </div>

            <button
              type="button"
              aria-current={!selectedTeam ? "step" : undefined}
              onClick={() => {
                setSelectedTeam(null);
                setSelectedPlayerId(null);
              }}
              className="group relative z-10 flex min-w-0 flex-col items-center gap-2 rounded-md text-xs font-semibold text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00519F] focus-visible:ring-offset-4 focus-visible:ring-offset-[#07090B] sm:text-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#00519F] bg-[#07090B] text-[#00519F] shadow-[0_0_0_4px_rgba(0,81,159,0.12)]">
                <UsersRound aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="max-w-full truncate">Times</span>
            </button>

            <button
              type="button"
              disabled={!selectedTeam}
              aria-current={
                selectedTeam && !selectedPlayer ? "step" : undefined
              }
              onClick={() => setSelectedPlayerId(null)}
              className={`group relative z-10 flex min-w-0 flex-col items-center gap-2 rounded-md text-xs font-semibold transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00519F] focus-visible:ring-offset-4 focus-visible:ring-offset-[#07090B] disabled:cursor-default disabled:text-white/35 sm:text-sm ${selectedTeam ? "text-white" : "text-white/55"}`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-[#07090B] transition-colors ${selectedTeam ? "border-[#00519F] shadow-[0_0_0_4px_rgba(0,81,159,0.12)]" : "border-white/20"}`}
              >
                {selectedTeam ? (
                  <TeamLogo team={selectedTeam} size="sm" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                )}
              </span>
              <span className="max-w-full truncate">
                {currentTeam?.abbreviation || "Jogadores"}
              </span>
            </button>

            <span
              aria-current={selectedPlayer ? "step" : undefined}
              className={`relative z-10 flex min-w-0 flex-col items-center gap-2 text-xs font-semibold sm:text-sm ${selectedPlayer ? "text-white" : "text-white/35"}`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-[#07090B] transition-colors ${selectedPlayer ? "border-[#00519F] shadow-[0_0_0_4px_rgba(0,81,159,0.12)]" : "border-white/20"}`}
              >
                {selectedPlayer ? (
                  <PlayerAvatar name={selectedPlayer.player} size="sm" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                )}
              </span>
              <span className="max-w-full truncate px-1">
                {selectedPlayer?.player || "Mercados"}
              </span>
            </span>
          </div>
        </nav>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-[#111416] p-8 text-sm text-white/60">
            Carregando times e estatísticas da temporada…
          </div>
        )}
        {!loading && loadError && !selectedTeam && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3"
          >
            <p className="text-sm font-semibold text-amber-200">
              A lista dos jogadores está temporariamente indisponível.
            </p>
            <p className="mt-1 text-xs text-amber-100/75">
              {loadError} Os times continuam visíveis; tente atualizar a página
              para carregar as estatísticas.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs font-bold text-amber-200 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !selectedTeam && (
          <section aria-labelledby="teams-title">
            <section aria-labelledby="perfect-lines-title" className="mb-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="perfect-lines-title"
                    className="text-xl font-bold text-white sm:text-2xl"
                  >
                    Linhas superadas em 100% dos últimos 5 jogos
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-white/55">
                    Todos os times · atletas acima de 20 minutos por jogo ·
                    linhas de Mais de comparadas com cinco jogos desta
                    temporada.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {marketLoading && (
                    <span className="text-xs text-white/45">
                      Buscando linhas atuais…
                    </span>
                  )}
                  {(marketData || marketError) && (
                    <button
                      type="button"
                      disabled={marketLoading}
                      onClick={() => {
                        setMarketData(null);
                        setMarketRefreshKey((key) => key + 1);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8CCBEE] disabled:opacity-50"
                    >
                      <RefreshCw
                        size={14}
                        className={marketLoading ? "animate-spin" : ""}
                      />
                      Atualizar
                    </button>
                  )}
                </div>
              </div>
              {marketError && (
                <p
                  role="status"
                  className="mb-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100"
                >
                  Não consegui carregar as linhas atuais. {marketError}
                </p>
              )}
              {perfectFiveLines.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {perfectFiveLines.map((item) => {
                    const quote = bestOverQuote(item.marketLine);
                    const marketOption = MARKETS.find(
                      (option) => option.id === item.marketLine.market,
                    )!;
                    const team = NBA_TEAMS.find(
                      (candidate) =>
                        candidate.names.some(
                          (name) =>
                            normalizeTeam(name) ===
                            normalizeTeam(item.player.team),
                        ) ||
                        normalizeTeam(candidate.abbreviation) ===
                          normalizeTeam(item.player.team),
                    );
                    const opponent =
                      normalizeTeam(item.marketLine.homeTeam) ===
                      normalizeTeam(item.player.team)
                        ? item.marketLine.awayTeam
                        : item.marketLine.homeTeam;
                    return (
                      <button
                        key={marketLineKey(item.marketLine)}
                        type="button"
                        onClick={() =>
                          openPlayerAnalysis(
                            item.player,
                            item.marketLine.market,
                          )
                        }
                        className="group rounded-2xl border border-[#00D084]/25 bg-[#0C1512] p-4 text-left transition hover:border-[#00D084]/60 hover:bg-[#101B17] hover:shadow-[0_8px_24px_rgba(0,208,132,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D084]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <PlayerAvatar name={item.player.player} size="md" />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-white group-hover:text-[#8FF0C5]">
                                {item.player.player}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
                                <TeamLogo team={item.player.team} size="xs" />
                                {team?.abbreviation || item.player.team}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#00D084]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#00D084]">
                            5/5 · 100%
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
                          <p className="text-sm font-semibold text-white">
                            {marketOption.label} · Mais de{" "}
                            <span className="text-[#00D084]">
                              {item.marketLine.line}
                            </span>
                          </p>
                          <span className="text-xs font-bold text-white/70">
                            {quote
                              ? `${quote.price > 0 ? "+" : ""}${quote.price}`
                              : "Odd indisponível"}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          {getLineRates(item.player, item.marketLine).map(
                            (rate) => (
                              <div
                                key={rate.window}
                                className="rounded-lg bg-black/20 px-2 py-1.5 text-center"
                                title={`L${rate.window}: ${rate.hits} de ${rate.sampleSize} jogos`}
                              >
                                <p className="text-[9px] font-bold text-white/40">
                                  L{rate.window}
                                </p>
                                <p className="mt-0.5 text-[11px] font-extrabold tabular-nums text-[#00D084]">
                                  {rate.percentage === null
                                    ? "—"
                                    : `${rate.percentage}%`}
                                </p>
                                <p className="text-[8px] tabular-nums text-white/40">
                                  {rate.hits}/{rate.sampleSize}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                        <p className="mt-2 text-xs text-white/50">
                          Média nesses jogos: {formatNumber(item.average)} ·{" "}
                          {item.marketLine.game}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/40">
                          <TeamLogo team={opponent} size="xs" />
                          Próximo adversário · {team?.abbreviation ||
                            "NBA"} vs{" "}
                          {getNbaTeamInfo(opponent)?.abbreviation || opponent}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                !marketLoading && (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-[#111416] px-4 py-6 text-sm text-white/55">
                    {marketData?.message ||
                      (marketError
                        ? "Tente atualizar para consultar novamente."
                        : `Ainda não há linhas de mercado com 5 acertos em 5 jogos registrados na temporada ${season}.`)}
                  </div>
                )
              )}
            </section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 id="teams-title" className="text-xl font-bold text-white">
                  Escolha um time
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  Os números dos jogadores aparecem quando já há jogos da
                  temporada registrados.
                </p>
              </div>
              <span className="hidden text-xs font-semibold uppercase tracking-wider text-white/40 sm:block">
                30 times NBA
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {NBA_TEAMS.map((team) => {
                const count =
                  teamCounts.get(normalizeTeam(team.names[0])) ||
                  teamCounts.get(normalizeTeam(team.abbreviation)) ||
                  0;
                return (
                  <button
                    key={team.abbreviation}
                    type="button"
                    onClick={() => chooseTeam(team.names[0])}
                    className="group flex min-h-[124px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#111416] px-3 py-4 text-center transition hover:-translate-y-0.5 hover:border-[#00519F] hover:bg-[#151A1E] hover:shadow-[0_8px_22px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00519F]"
                  >
                    <TeamLogo team={team.names[0]} size="md" />
                    <span className="mt-2 text-sm font-bold text-white group-hover:text-[#8CCBEE]">
                      {team.abbreviation}
                    </span>
                    <span className="mt-0.5 text-xs text-white/45">
                      {count ? `${count} elegíveis` : "Sem atleta >20 min"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {!loading && selectedTeam && !selectedPlayer && (
          <section aria-labelledby="roster-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => chooseTeam("")}
                  aria-label="Voltar aos times"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#111416] text-white/60 hover:text-white"
                >
                  <ArrowLeft size={18} />
                </button>
                <TeamLogo team={selectedTeam} size="hero" />
                <div>
                  <h2
                    id="roster-title"
                    className="text-2xl font-bold text-white"
                  >
                    {currentTeam?.names[0] || selectedTeam}
                  </h2>
                  <p className="text-sm text-white/55">
                    {teamPlayers.length} jogadores com jogos registrados
                  </p>
                </div>
              </div>
              <label className="relative block w-full sm:max-w-xs">
                <span className="sr-only">Buscar jogador</span>
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar jogador"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#111416] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#00519F] focus:ring-2 focus:ring-[#00519F]/25"
                />
              </label>
            </div>
            <section aria-labelledby="team-market-highlights" className="mb-7">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3
                    id="team-market-highlights"
                    className="text-lg font-bold text-white"
                  >
                    Em destaque nas linhas atuais
                  </h3>
                  <p className="mt-1 text-xs text-white/55">
                    Comparação descritiva com os jogos recentes; não é uma
                    recomendação automática.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {marketLoading && (
                    <span className="text-xs text-white/45">
                      Carregando linhas de mercado…
                    </span>
                  )}
                  {(marketData || marketError) && (
                    <button
                      type="button"
                      disabled={marketLoading}
                      onClick={() => {
                        setMarketData(null);
                        setMarketRefreshKey((key) => key + 1);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8CCBEE] disabled:opacity-50"
                    >
                      <RefreshCw
                        size={14}
                        className={marketLoading ? "animate-spin" : ""}
                      />
                      Atualizar linhas
                    </button>
                  )}
                </div>
              </div>
              {marketError && (
                <p
                  role="status"
                  className="mb-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100"
                >
                  Não consegui carregar as linhas atuais. {marketError}
                </p>
              )}
              {teamHighlights.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {teamHighlights.map((item) => {
                    const quote = bestOverQuote(item.marketLine);
                    const marketOption = MARKETS.find(
                      (option) => option.id === item.marketLine.market,
                    )!;
                    return (
                      <button
                        key={marketLineKey(item.marketLine)}
                        type="button"
                        onClick={() => choosePlayer(item.player)}
                        className="group rounded-xl border border-white/10 bg-[#111416] p-4 text-left transition hover:border-[#00519F] hover:bg-[#151A1E] hover:shadow-[0_6px_18px_rgba(0,0,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00519F]"
                      >
                        <div className="flex items-center gap-3">
                          <PlayerAvatar name={item.player.player} size="md" />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-white group-hover:text-[#8CCBEE]">
                              {item.player.player}
                            </p>
                            <p className="mt-0.5 text-xs text-white/60">
                              {marketOption.label} · Mais de{" "}
                              {item.marketLine.line}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-end justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                              Últimos {item.sample} jogos
                            </p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-[#8CCBEE]">
                              {item.hits}/{item.sample} acima
                            </p>
                          </div>
                          <span className="text-right text-xs font-semibold text-white/60">
                            {quote
                              ? `${quote.price > 0 ? "+" : ""}${quote.price}`
                              : "Odd indisponível"}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          {getLineRates(item.player, item.marketLine).map(
                            (rate) => (
                              <div
                                key={rate.window}
                                className="rounded-lg bg-black/20 px-2 py-1.5 text-center"
                                title={`L${rate.window}: ${rate.hits} de ${rate.sampleSize} jogos`}
                              >
                                <p className="text-[9px] font-bold text-white/40">
                                  L{rate.window}
                                </p>
                                <p className="mt-0.5 text-[11px] font-extrabold tabular-nums text-[#00D084]">
                                  {rate.percentage === null
                                    ? "—"
                                    : `${rate.percentage}%`}
                                </p>
                                <p className="text-[8px] tabular-nums text-white/40">
                                  {rate.hits}/{rate.sampleSize}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                        <p className="mt-2 text-[11px] text-white/45">
                          Média recente {formatNumber(item.average)} ·{" "}
                          {item.marketLine.game}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                !marketLoading && (
                  <p className="rounded-xl border border-dashed border-white/15 bg-[#111416] px-4 py-5 text-sm text-white/55">
                    {marketData?.message ||
                      (marketError
                        ? "Tente atualizar o time para carregar as linhas."
                        : "Ainda não há linhas de props disponíveis para este time nos próximos jogos.")}
                  </p>
                )
              )}
            </section>
            {loadError ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm text-amber-100"
              >
                {loadError} Atualize a página quando a conexão com a base
                voltar.
              </div>
            ) : teamPlayers.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {teamPlayers.map((player) => (
                  <button
                    key={player.playerId}
                    type="button"
                    onClick={() => choosePlayer(player)}
                    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-[#111416] p-4 text-left transition hover:border-[#00519F] hover:bg-[#151A1E] hover:shadow-[0_8px_22px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00519F]"
                  >
                    <PlayerAvatar name={player.player} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-white group-hover:text-[#8CCBEE]">
                        {player.player}
                      </span>
                      <span className="mt-0.5 block text-xs text-white/45">
                        {player.games} jogos · {formatNumber(player.minutes)}{" "}
                        min/jogo
                      </span>
                      <span className="mt-2 flex gap-2 text-[11px] font-semibold text-white/60">
                        <span>PTS {formatNumber(player.points)}</span>
                        <span>REB {formatNumber(player.rebounds)}</span>
                        <span>AST {formatNumber(player.assists)}</span>
                      </span>
                      {teamPlayerLineRates.get(player.playerId)?.length ? (
                        <span className="mt-3 block border-t border-white/10 pt-2.5">
                          <span className="mb-1.5 grid grid-cols-[minmax(70px,1fr)_repeat(3,minmax(0,auto))] gap-x-2 text-[8px] font-bold uppercase tracking-wide text-white/35">
                            <span>Linha atual</span>
                            <span>L5</span>
                            <span>L10</span>
                            <span>L20</span>
                          </span>
                          {teamPlayerLineRates
                            .get(player.playerId)!
                            .map((row) => (
                              <span
                                key={row.marketLine.market}
                                className="grid grid-cols-[minmax(70px,1fr)_repeat(3,minmax(0,auto))] gap-x-2 py-0.5 text-[9px] tabular-nums"
                              >
                                <span className="truncate pr-1 font-semibold text-white/60">
                                  {row.short} +{row.marketLine.line}
                                </span>
                                {row.rates.map((rate) => (
                                  <span
                                    key={rate.window}
                                    className="text-right font-bold text-[#8CCBEE]"
                                    title={`L${rate.window}: ${rate.hits} acertos em ${rate.sampleSize} jogos`}
                                  >
                                    {formatRate(rate)}
                                  </span>
                                ))}
                              </span>
                            ))}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight
                      size={17}
                      className="shrink-0 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-[#8CCBEE]"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-[#111416] px-6 py-12 text-center">
                <TeamLogo team={selectedTeam} size="hero" />
                <h3 className="mt-3 text-lg font-bold text-white">
                  Nenhum atleta elegível neste time
                </h3>
                <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-white/55">
                  A análise só lista jogadores com média superior a 20 minutos
                  por jogo nesta temporada.
                </p>
              </div>
            )}
          </section>
        )}

        {!loading && !loadError && selectedPlayer && (
          <section
            aria-label={`Análise de ${selectedPlayer.player}`}
            className="grid gap-4 rounded-3xl border border-white/5 bg-[#0D1012] p-3 sm:p-4 xl:grid-cols-[280px_minmax(0,1fr)]"
          >
            <aside className="rounded-2xl border border-white/8 bg-[#111416] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TeamLogo team={selectedTeam || undefined} size="sm" />
                  <h2 className="font-bold text-white">Elenco</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlayerId(null);
                    setLine("");
                  }}
                  className="text-xs font-semibold text-[#00D084] hover:underline"
                >
                  Ver time
                </button>
              </div>
              <label className="relative mt-4 block">
                <span className="sr-only">Filtrar jogadores</span>
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar"
                  className="h-10 w-full rounded-lg border border-white/10 bg-[#090B0D] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#00D084]"
                />
              </label>
              <div className="mt-3 max-h-[55vh] space-y-1 overflow-y-auto pr-1">
                {teamPlayers.map((player) => (
                  <button
                    key={player.playerId}
                    type="button"
                    onClick={() => choosePlayer(player)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left ${player.playerId === selectedPlayer.playerId ? "bg-[#062A1C] text-[#00D084]" : "text-white/75 hover:bg-white/5"}`}
                  >
                    <PlayerAvatar name={player.player} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {player.player}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {player.games}J
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="min-w-0 space-y-4">
              <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-[#111416] p-5 sm:p-6">
                <div className="flex min-w-0 items-center gap-4">
                  <PlayerAvatar name={selectedPlayer.player} size="lg" />
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold text-white sm:text-3xl">
                      {selectedPlayer.player}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-white/55">
                      <TeamLogo team={selectedTeam || undefined} size="xs" />
                      {currentTeam?.names[0] || selectedTeam} ·{" "}
                      {selectedPlayer.games} jogos na temporada
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTeam(null);
                    setSelectedPlayerId(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#00D084] hover:bg-white/5"
                >
                  <ArrowLeft size={16} /> Trocar time
                </button>
              </header>

              <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#111416]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-4 sm:px-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Mercados e desempenho
                    </h3>
                    <p className="mt-0.5 text-xs text-white/45">
                      L{gameWindow} · {logs.length}{" "}
                      {logs.length === 1 ? "jogo" : "jogos"} registrados nesta
                      temporada
                    </p>
                  </div>
                  <div
                    className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#090B0D] p-1"
                    role="tablist"
                    aria-label="Mercados de jogador"
                  >
                    {MARKETS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={marketId === item.id}
                        onClick={() => chooseMarket(item.id)}
                        className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${marketId === item.id ? "bg-[#202629] text-[#00D084] shadow-sm" : "text-white/55 hover:text-white"}`}
                      >
                        {item.short}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 sm:p-5">
                  <div className="rounded-2xl bg-[#090B0D] p-4 text-white sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <PlayerAvatar name={selectedPlayer.player} size="lg" />
                        <div className="min-w-0">
                          <h4 className="truncate text-xl font-bold text-white sm:text-2xl">
                            {selectedPlayer.player}
                          </h4>
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/70">
                            <TeamLogo
                              team={selectedTeam || undefined}
                              size="xs"
                            />
                            {currentTeam?.abbreviation || selectedTeam}
                          </p>
                          {activeMarketLine && (
                            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#062A1C] px-3 py-1 text-xs font-bold text-[#00D084]">
                              Mais de {activeMarketLine.line}{" "}
                              {market.label.toLowerCase()}{" "}
                              <span className="text-white/40">↔</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-white/65">
                        {activeMarketLine ? (
                          <>
                            <p>
                              {selectedTeam &&
                                (normalizeTeam(activeMarketLine.homeTeam) ===
                                normalizeTeam(selectedTeam)
                                  ? "Casa"
                                  : "Fora")}{" "}
                              vs{" "}
                              {normalizeTeam(activeMarketLine.homeTeam) ===
                              normalizeTeam(selectedTeam || "")
                                ? getNbaTeamInfo(activeMarketLine.awayTeam)
                                    ?.abbreviation || activeMarketLine.awayTeam
                                : getNbaTeamInfo(activeMarketLine.homeTeam)
                                    ?.abbreviation || activeMarketLine.homeTeam}
                            </p>
                            <p className="mt-1">
                              {formatAppDateTime(activeMarketLine.commenceTime)}
                            </p>
                          </>
                        ) : (
                          <p>Linhas atuais indisponíveis</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        {
                          label: "MÉDIA TEMPORADA",
                          value: formatNumber(market.average(selectedPlayer)),
                          detail: market.short,
                        },
                        {
                          label: "ACIMA DA LINHA",
                          value:
                            hitCount === null
                              ? "—"
                              : `${Math.round(hitPercentage || 0)}%`,
                          detail:
                            hitCount === null
                              ? "Informe uma linha"
                              : `${hitCount} de ${recentValues.length} jogos`,
                        },
                        {
                          label: "AMOSTRA",
                          value: `${selectedPlayer.games}`,
                          detail: `jogos nesta temporada`,
                        },
                        {
                          label: "MATCHUP",
                          value: activeMarketLine
                            ? selectedTeam &&
                              normalizeTeam(activeMarketLine.homeTeam) ===
                                normalizeTeam(selectedTeam)
                              ? "CASA"
                              : "FORA"
                            : "—",
                          detail: activeMarketLine
                            ? normalizeTeam(activeMarketLine.homeTeam) ===
                              normalizeTeam(selectedTeam || "")
                              ? getNbaTeamInfo(activeMarketLine.awayTeam)
                                  ?.abbreviation || activeMarketLine.awayTeam
                              : getNbaTeamInfo(activeMarketLine.homeTeam)
                                  ?.abbreviation || activeMarketLine.homeTeam
                            : "Sem partida disponível",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl bg-[#15181B] px-3 py-3 text-center sm:px-4"
                        >
                          <p className="text-[9px] font-bold tracking-[0.14em] text-white/50 sm:text-[10px]">
                            {item.label}
                          </p>
                          <p className="mt-1 text-xl font-extrabold tabular-nums text-[#00D084] sm:text-2xl">
                            {item.value}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-white/55">
                            {item.detail}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                          Desempenho por partida
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {market.label} · L{gameWindow} · temporada {season}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-white/70">
                        Linha Mais de{" "}
                        <input
                          aria-label={`Linha Mais de para ${market.label}`}
                          type="number"
                          min="0"
                          step="0.5"
                          value={
                            line === "" ? (activeMarketLine?.line ?? "") : line
                          }
                          onChange={(event) => setLine(event.target.value)}
                          placeholder="—"
                          className="h-9 w-20 rounded-lg border border-white/15 bg-[#15181B] px-2 text-center font-bold text-white outline-none focus:border-[#00D084]"
                        />
                      </label>
                    </div>

                    {logs.length ? (
                      <div className="mt-4 overflow-x-auto pb-2">
                        <div className="min-w-[620px] rounded-xl bg-[#101315] px-3 pb-3 pt-5 sm:px-4">
                          <div className="relative h-[190px] border-b border-l border-white/15">
                            <span className="absolute -left-1 bottom-0 -translate-x-full pr-2 text-[10px] text-white/35">
                              0
                            </span>
                            {lineNumber !== null && (
                              <div
                                className="absolute left-0 right-0 z-10 border-t border-white/80"
                                style={{
                                  bottom: `${Math.min(92, Math.max(2, (lineNumber / maxValue) * 88))}%`,
                                }}
                              >
                                <span className="absolute -top-6 left-1 rounded bg-[#101315] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {formatNumber(lineNumber)}
                                </span>
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-end justify-around gap-2 px-2">
                              {logs.map((log, index) => {
                                const value = market.stat(log);
                                const above =
                                  lineNumber !== null && value > lineNumber;
                                const opponent =
                                  getNbaTeamInfo(log.opponent)?.abbreviation ||
                                  log.opponent;
                                return (
                                  <div
                                    key={`${log.eventId}-${index}`}
                                    className="relative z-[1] flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                                  >
                                    <span className="mb-1 text-[10px] font-bold tabular-nums text-white">
                                      {value}
                                    </span>
                                    <div
                                      title={`${value} ${market.label.toLowerCase()} vs ${log.opponent}`}
                                      className={`w-full max-w-10 transition-[height] ${lineNumber === null ? "bg-[#00C978]" : above ? "bg-[#00C978]" : "bg-[#386857]"}`}
                                      style={{
                                        height: `${Math.max(2, (value / maxValue) * 76)}%`,
                                      }}
                                    />
                                    <span className="absolute -bottom-6 text-[9px] font-medium text-white/55">
                                      {dateLabel(log.date)}
                                    </span>
                                    <span className="absolute -bottom-[3.1rem] flex flex-col items-center gap-0.5">
                                      <TeamLogo team={log.opponent} size="xs" />
                                      <span className="text-[8px] font-bold text-white/45">
                                        {opponent}
                                      </span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="mt-[4.2rem] flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-white/35">
                            <span>Mais antigo</span>
                            <span>Mais recente</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl border border-dashed border-white/15 bg-[#101315] p-6 text-sm text-white/65">
                        Ainda não há partidas registradas nesta temporada para
                        este jogador.
                      </p>
                    )}

                    <div className="mt-5 border-t border-white/10 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                        Filtros do gráfico
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {MARKETS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => chooseMarket(item.id)}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${marketId === item.id ? "bg-[#202629] text-white ring-1 ring-white/20" : "bg-[#15181B] text-white/60 hover:text-white"}`}
                          >
                            <BarChart3 size={12} className="mr-1.5 inline" />
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-white/40">
                          Últimos jogos
                        </span>
                        {GAME_WINDOWS.map((windowSize) => {
                          const available = Math.min(
                            windowSize,
                            selectedPlayer.logs.length,
                          );
                          const shortened =
                            selectedPlayer.logs.length < windowSize;
                          return (
                            <button
                              key={windowSize}
                              type="button"
                              aria-pressed={gameWindow === windowSize}
                              title={`Mostrar até os últimos ${windowSize} jogos desta temporada (${available} disponíveis)`}
                              onClick={() => setGameWindow(windowSize)}
                              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${gameWindow === windowSize ? "bg-[#00519F] text-white" : "bg-[#15181B] text-white/60 hover:text-white"}`}
                            >
                              L{windowSize}
                              {shortened ? ` · ${available}` : ""}
                            </button>
                          );
                        })}
                        <span className="ml-1 rounded-lg bg-[#15181B] px-3 py-2 text-xs text-white/55">
                          Temporada {season} · {logs.length}{" "}
                          {logs.length === 1 ? "jogo" : "jogos"} exibidos
                        </span>
                      </div>
                    </div>
                    <p className="mt-4 text-[10px] leading-5 text-white/40">
                      A linha serve como referência visual. O gráfico mostra
                      resultados reais dos jogos desta temporada, sem estimar
                      resultados futuros.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/8 bg-[#111416] p-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 size={17} className="text-[#00D084]" />
                        <h4 className="font-bold text-white">
                          Opção de mercado
                        </h4>
                      </div>
                      {marketLoading ? (
                        <p className="mt-3 text-sm text-white/55">
                          Buscando linhas de mercado atuais…
                        </p>
                      ) : activeMarketLine ? (
                        <>
                          {playerMarketLines.length > 1 && (
                            <label className="mt-3 block text-xs font-semibold text-white/55">
                              Partida e linha
                              <select
                                value={marketLineKey(activeMarketLine)}
                                onChange={(event) => {
                                  setCandidateId(event.target.value);
                                  setLine("");
                                }}
                                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#090B0D] px-2 text-sm text-white"
                              >
                                {playerMarketLines.map((item) => (
                                  <option
                                    key={marketLineKey(item)}
                                    value={marketLineKey(item)}
                                  >
                                    {item.game} ·{" "}
                                    {formatAppDateTime(item.commenceTime)} ·{" "}
                                    {item.line}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <p className="mt-3 text-sm text-white/65">
                            Mais de{" "}
                            <strong className="text-white">
                              {activeMarketLine.line}
                            </strong>{" "}
                            {market.label.toLowerCase()}
                          </p>
                          <p className="mt-1 text-xs text-white/40">
                            {activeMarketLine.game} ·{" "}
                            {formatAppDateTime(activeMarketLine.commenceTime)}
                          </p>
                          {(() => {
                            const quote = bestOverQuote(activeMarketLine);
                            return (
                              <div className="mt-4 rounded-lg bg-[#062A1C] p-3">
                                <p className="text-[10px] text-[#00D084]/75">
                                  Cotação atual · Mais de
                                </p>
                                <p className="mt-1 font-bold text-[#00D084]">
                                  {quote
                                    ? `${quote.price > 0 ? "+" : ""}${quote.price} · ${quote.bookmaker}`
                                    : "Indisponível"}
                                </p>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg bg-[#090B0D] p-3">
                          <p className="text-sm font-semibold text-white">
                            Sem linha atual para este mercado
                          </p>
                          <p className="mt-1 text-xs leading-5 text-white/50">
                            Informe uma linha acima para comparar com o
                            desempenho observado. Não exibiremos uma cotação
                            inventada.
                          </p>
                        </div>
                      )}
                      {marketError && (
                        <p
                          role="status"
                          className="mt-3 text-xs leading-5 text-amber-300"
                        >
                          {marketError} O gráfico com os dados dos jogos
                          continua disponível.
                        </p>
                      )}
                      {!marketLoading &&
                        !marketError &&
                        marketData?.message &&
                        !activeMarketLine && (
                          <p className="mt-3 text-xs leading-5 text-white/50">
                            {marketData.message}
                          </p>
                        )}
                    </div>
                    <div className="rounded-xl border border-white/8 bg-[#111416] p-4">
                      <div className="flex items-center gap-2 font-bold text-[#00D084]">
                        <TrendingUp size={16} /> Leitura rápida
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/60">
                        Nos últimos {recentValues.length} jogos desta temporada,{" "}
                        {market.label.toLowerCase()} ficaram acima da linha em{" "}
                        {hitCount === null ? "—" : `${hitCount} ocasiões`}.
                        Média da temporada:{" "}
                        {formatNumber(market.average(selectedPlayer))}.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
