import {
  analyzePlayerProp,
  PlayerGameLog,
  PlayerPropCandidate,
  PlayerPropMarket,
  PlayerPropQuote,
  PlayerInjuryReportEntry,
  isSyntheticPickemBook,
  resolvePlayerOpponent,
} from '@/lib/analysis/player-props';

const BASE_URL = 'https://api.prop-line.com/v1/sports/basketball_nba';
const MARKETS: PlayerPropMarket[] = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_points_rebounds_assists',
];

type JsonRecord = Record<string, any>;

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object') as JsonRecord[];
  if (value && typeof value === 'object') {
    const data = (value as JsonRecord).data;
    if (Array.isArray(data)) return data.filter(item => item && typeof item === 'object') as JsonRecord[];
    const events = (value as JsonRecord).events;
    if (Array.isArray(events)) return events.filter(item => item && typeof item === 'object') as JsonRecord[];
  }
  return [];
}

async function getJson(path: string, revalidate: number): Promise<{ body: unknown; response: Response }> {
  const apiKey = process.env.PROPLINE_API_KEY;
  if (!apiKey) throw new Error('Configure PROPLINE_API_KEY com uma chave grátis da PropLine para ativar a análise de jogadores.');
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    next: { revalidate },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PropLine respondeu ${response.status}: ${detail.slice(0, 240)}`);
  }
  return { body: await response.json(), response };
}

function AmericanToDecimal(price: number): number {
  return price > 0 ? 1 + price / 100 : 1 + 100 / -price;
}

function makeOddsPath(): string {
  const params = new URLSearchParams({ markets: MARKETS.join(',') });
  return `/odds?${params.toString()}`;
}

export async function getPlayerGameLogs(player: string, limit = 20): Promise<PlayerGameLog[]> {
  // Keep this query order stable after refreshing the cached player-team fields.
  const statTypes = 'assists,minutes,points,points_rebounds_assists,rebounds,threes';
  const path = `/players/${encodeURIComponent(player)}/games?limit=${limit}&stat_type=${statTypes}`;
  const { body } = await getJson(path, 21600);
  const bodyRecord = body as JsonRecord;
  return records(bodyRecord?.games || bodyRecord).map(log => ({
    event_id: String(log.event_id || ''),
    commence_time: String(log.commence_time || ''),
    player_team: log.player_team || null,
    opponent: log.opponent || null,
    status: log.status,
    stats: (log.stats || {}) as Record<string, number | string | null | undefined>,
  }));
}

async function getNbaInjuryReport(): Promise<{ available: boolean; players: PlayerInjuryReportEntry[] }> {
  try {
    const { body } = await getJson('/injuries', 600);
    const bodyRecord = body as JsonRecord;
    return {
      available: true,
      players: records(bodyRecord?.players || bodyRecord).map(row => ({
        playerName: String(row.player_name || row.name || ''),
        team: row.team ? String(row.team) : row.team_abbr ? String(row.team_abbr) : undefined,
        status: String(row.status || row.status_code || 'status indisponível'),
        statusCode: String(row.status_code || row.status || 'other').toLowerCase(),
        injuryType: row.injury_type ? String(row.injury_type) : undefined,
        bodyPart: row.body_part ? String(row.body_part) : undefined,
        detail: row.detail ? String(row.detail) : undefined,
        expectedReturn: row.expected_return ? String(row.expected_return) : undefined,
        statusSince: row.status_since ? String(row.status_since) : undefined,
      })).filter(row => row.playerName),
    };
  } catch (error) {
    console.warn('[PropLine] NBA injury report unavailable:', error instanceof Error ? error.message : error);
    return { available: false, players: [] };
  }
}

function normalizeContextKey(value: string | null | undefined): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function candidatesFromEvents(events: JsonRecord[], from: Date, to: Date) {
  const byKey = new Map<string, {
    event: JsonRecord;
    player: string;
    market: PlayerPropMarket;
    line: number;
    quotes: PlayerPropQuote[];
  }>();

  for (const event of events) {
    const start = Date.parse(event.commence_time);
    if (!Number.isFinite(start) || start < from.getTime() || start > to.getTime()) continue;
    for (const bookmaker of event.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        if (!MARKETS.includes(market.key as PlayerPropMarket)) continue;
        if (market.line_type && market.line_type !== 'main') continue;
        const marketKey = market.key as PlayerPropMarket;
        const groupedOutcomes = new Map<string, JsonRecord[]>();
        for (const outcome of market.outcomes || []) {
          const player = String(outcome.description || '').trim().replace(/\s+\([A-Z]{2,3}\)$/, '');
          const point = Number(outcome.point);
          const side = String(outcome.name || '');
          const price = Number(outcome.price);
          if (!player || !Number.isFinite(point) || !['Over', 'Under'].includes(side) || !Number.isFinite(price)) continue;
          const key = `${player.toLowerCase()}|${point}`;
          const entries = groupedOutcomes.get(key) || [];
          entries.push({ ...outcome, _player: player, _point: point });
          groupedOutcomes.set(key, entries);
        }
        for (const outcomes of Array.from(groupedOutcomes.values())) {
          const bookmakerKey = String(bookmaker.key || '');
          const bookmakerTitle = String(bookmaker.title || bookmakerKey || 'Casa');
          if (isSyntheticPickemBook(bookmakerKey, bookmakerTitle)) continue;
          const player = String(outcomes[0]._player);
          const line = Number(outcomes[0]._point);
          const pairKey = `${event.id}:${player.toLowerCase()}:${marketKey}:${line}`;
          const entry = byKey.get(pairKey) || { event, player, market: marketKey, line, quotes: [] };
          for (const outcome of outcomes) {
            entry.quotes.push({
              side: outcome.name as PlayerPropQuote['side'],
              price: Number(outcome.price),
              bookmaker: bookmakerTitle,
              bookmakerKey,
              updatedAt: String(market.last_update || ''),
            });
          }
          byKey.set(pairKey, entry);
        }
      }
    }
  }

  return Array.from(byKey.values()).map(entry => ({
    ...entry,
    quotes: entry.quotes.filter(quote => entry.quotes.some(other => other.bookmaker === quote.bookmaker && other.side !== quote.side)),
  })).filter(entry => entry.quotes.length > 0);
}

export async function getCurrentPlayerPropMarkets(): Promise<Array<{
  eventId: string;
  player: string;
  market: PlayerPropMarket;
  line: number;
  quotes: PlayerPropQuote[];
}>> {
  if (!process.env.PROPLINE_API_KEY) return [];
  const { body } = await getJson(makeOddsPath(), 900);
  return candidatesFromEvents(records(body), new Date(0), new Date(8_640_000_000_000_000))
    .map(candidate => ({
      eventId: String(candidate.event.id),
      player: candidate.player,
      market: candidate.market,
      line: candidate.line,
      quotes: candidate.quotes,
    }));
}

export async function getDailyPlayerAnalysis(from: Date, to: Date): Promise<{
  configured: boolean;
  source: string;
  fetchedAt: string;
  quotaRemaining?: number;
  analyzedPlayers: number;
  recommendations: PlayerPropCandidate[];
  message?: string;
}> {
  if (!process.env.PROPLINE_API_KEY) {
    return {
      configured: false,
      source: 'PropLine · plano grátis',
      fetchedAt: new Date().toISOString(),
      analyzedPlayers: 0,
      recommendations: [],
      message: 'Adicione uma chave grátis da PropLine em PROPLINE_API_KEY para carregar props e históricos de jogadores.',
    };
  }

  const [{ body, response }, injuryReport] = await Promise.all([
    getJson(makeOddsPath(), 900),
    getNbaInjuryReport(),
  ]);
  const eventCandidates = candidatesFromEvents(records(body), from, to);
  const candidatesByPlayer = new Map<string, typeof eventCandidates>();
  for (const candidate of eventCandidates) {
    const list = candidatesByPlayer.get(candidate.player) || [];
    list.push(candidate);
    candidatesByPlayer.set(candidate.player, list);
  }

  // Bound the daily free-tier usage: one odds pull and at most 32 player log pulls.
  const players = Array.from(candidatesByPlayer.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 32);
  const histories = new Map<string, PlayerGameLog[]>();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(8, players.length) }, async () => {
    while (cursor < players.length) {
      const index = cursor++;
      const [player] = players[index];
      try {
        histories.set(player, await getPlayerGameLogs(player));
      } catch {
        histories.set(player, []);
      }
    }
  });
  await Promise.all(workers);

  // Use the player-points lines already present in today's odds response to
  // show how the market prices each player relative to covered teammates.
  const pointLinesByTeam = new Map<string, Map<string, { player: string; lines: number[] }>>();
  for (const [player, props] of players) {
    const playerTeam = histories.get(player)?.find(log => log.player_team)?.player_team;
    if (!playerTeam) continue;
    for (const prop of props) {
      if (prop.market !== 'player_points') continue;
      const home = String(prop.event.home_team || '');
      const away = String(prop.event.away_team || '');
      if (!resolvePlayerOpponent(playerTeam, home, away)) continue;
      const eventTeamKey = `${String(prop.event.id)}:${normalizeContextKey(playerTeam)}`;
      const teamPlayers = pointLinesByTeam.get(eventTeamKey)
        || new Map<string, { player: string; lines: number[] }>();
      const playerKey = normalizeContextKey(player);
      const row = teamPlayers.get(playerKey) || { player, lines: [] };
      row.lines.push(prop.line);
      teamPlayers.set(playerKey, row);
      pointLinesByTeam.set(eventTeamKey, teamPlayers);
    }
  }
  const teammatePointsLines = new Map<string, Array<{ player: string; line: number }>>();
  for (const [teamKey, rows] of Array.from(pointLinesByTeam.entries())) {
    teammatePointsLines.set(teamKey, Array.from(rows.values()).map(row => ({
      player: row.player,
      line: median(row.lines),
    })));
  }

  const recommendations: PlayerPropCandidate[] = [];
  for (const [player, props] of players) {
    const logs = histories.get(player) || [];
    for (const prop of props) {
      const home = String(prop.event.home_team || '');
      const away = String(prop.event.away_team || '');
      const currentPlayerTeam = logs.find(log => log.player_team)?.player_team;
      // Never analyze a player prop attached to an event for another team or
      // with no current roster evidence in the free game-log feed.
      if (!resolvePlayerOpponent(currentPlayerTeam, home, away)) continue;
      const analyzed = analyzePlayerProp({
        gameId: String(prop.event.id),
        game: `${away} @ ${home}`,
        commenceTime: String(prop.event.commence_time),
        player: prop.player,
        market: prop.market,
        line: prop.line,
        logs,
        quotes: prop.quotes,
        homeTeam: home,
        awayTeam: away,
        teammatePointsLines: teammatePointsLines.get(`${String(prop.event.id)}:${normalizeContextKey(currentPlayerTeam)}`) || [],
        injuryReportPlayers: injuryReport.players,
        injuryReportAvailable: injuryReport.available,
      });
      if (analyzed) recommendations.push(analyzed);
    }
  }

  const selectedValue = (pick: PlayerPropCandidate) => pick.recommendationSide === 'Under'
    ? pick.expectedValueUnder ?? -1
    : pick.expectedValue ?? -1;
  recommendations.sort((a, b) => Number(b.shortlistEligible) - Number(a.shortlistEligible)
    || selectedValue(b) - selectedValue(a)
    || Math.max(b.edge ?? -1, b.edgeUnder ?? -1) - Math.max(a.edge ?? -1, a.edgeUnder ?? -1));
  return {
    configured: true,
    source: 'PropLine · plano grátis',
    fetchedAt: new Date().toISOString(),
    quotaRemaining: Number(response.headers.get('X-Daily-Remaining') || NaN) || undefined,
    analyzedPlayers: players.length,
    recommendations,
    message: recommendations.length ? undefined : 'Ainda não há props e históricos suficientes para estimar opções com a amostra mínima.',
  };
}

export function propMarketLabel(market: PlayerPropMarket): string {
  return {
    player_points: 'Pontos',
    player_rebounds: 'Rebotes',
    player_assists: 'Assistências',
    player_threes: 'Cestas de 3',
    player_points_rebounds_assists: 'Pontos + rebotes + assistências',
  }[market];
}

export function decimalPrice(price: number): number {
  return AmericanToDecimal(price);
}
