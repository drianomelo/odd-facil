export type SeasonPickMarket =
  | 'player_points'
  | 'player_rebounds'
  | 'player_assists'
  | 'player_threes'
  | 'player_points_rebounds_assists';

export interface SeasonPlayerGame {
  event_id: string;
  game_date: Date;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  played: boolean;
  minutes?: number | string;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
}

export interface SeasonScheduleGame {
  id: string;
  commenceTime: Date;
  homeTeam: string;
  awayTeam: string;
}

export interface SeasonPlayerPick {
  id: string;
  gameId: string;
  game: string;
  commenceTime: string;
  playerId: string;
  player: string;
  team: string;
  market: SeasonPickMarket;
  line: number;
  side: 'Over' | 'Under';
  seasonAverage: number;
  last5Average: number;
  hits: number;
  sampleSize: number;
  observedRate: number;
  personalRecord: { wins: number; losses: number; total: number };
}

const STAT_BY_MARKET: Record<SeasonPickMarket, (game: SeasonPlayerGame) => number> = {
  player_points: game => Number(game.points),
  player_rebounds: game => Number(game.rebounds),
  player_assists: game => Number(game.assists),
  player_threes: game => Number(game.threes),
  player_points_rebounds_assists: game => Number(game.points) + Number(game.rebounds) + Number(game.assists),
};

const MARKETS = Object.keys(STAT_BY_MARKET) as SeasonPickMarket[];
const ROTATION_SAMPLE_SIZE = 10;
const MIN_ROTATION_AVERAGE_MINUTES = 10;
const MAX_ROTATION_PLAYERS_PER_TEAM = 8;

function normalize(value: string) {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === 'losangelesclippers' ? 'laclippers' : normalized;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

/** Builds transparent, season-only signals. The hit rate is observed frequency, not a calibrated probability. */
export function buildSeasonPlayerPicks(input: {
  games: SeasonScheduleGame[];
  logs: SeasonPlayerGame[];
  personalByMarket: Record<SeasonPickMarket, { wins: number; losses: number; total: number }>;
  markets?: SeasonPickMarket[];
  maxPerGame?: number;
  minSampleSize?: number;
  now?: Date;
}): SeasonPlayerPick[] {
  const candidates: SeasonPlayerPick[] = [];
  const markets = input.markets?.length ? input.markets : MARKETS;
  const now = input.now || new Date();
  const logsByPlayer = new Map<string, SeasonPlayerGame[]>();
  for (const log of input.logs) {
    if (!log.played) continue;
    const rows = logsByPlayer.get(log.player_id) || [];
    rows.push(log);
    logsByPlayer.set(log.player_id, rows);
  }

  for (const fixture of input.games) {
    const fixtureTime = fixture.commenceTime.getTime();
    if (!Number.isFinite(fixtureTime) || fixtureTime <= now.getTime()) continue;
    const homeKey = normalize(fixture.homeTeam);
    const awayKey = normalize(fixture.awayTeam);
    const eligible = Array.from(logsByPlayer.entries()).flatMap(([playerId, rows]) => {
      const prior = rows.filter(row => row.game_date.getTime() < fixtureTime)
        .sort((a, b) => b.game_date.getTime() - a.game_date.getTime());
      const latest = prior[0];
      const teamKey = latest ? normalize(latest.team) : '';
      return latest && (teamKey === homeKey || teamKey === awayKey)
        ? [{ playerId, rows: prior, latest, teamKey }]
        : [];
    });

    // Betby lists at most eight players per team. Keep only the established
    // rotation: recent average minutes must be at least 10, then take each
    // team's eight highest minute averages for this matchup.
    const rotationByTeam = new Map<string, typeof eligible>();
    for (const player of eligible) {
      const sample = player.rows.slice(0, ROTATION_SAMPLE_SIZE);
      const averageMinutes = mean(sample.map(row => Number(row.minutes) || 0));
      if (averageMinutes < MIN_ROTATION_AVERAGE_MINUTES) continue;
      const teamPlayers = rotationByTeam.get(player.teamKey) || [];
      teamPlayers.push(player);
      rotationByTeam.set(player.teamKey, teamPlayers);
    }
    const rotationPlayerIds = new Set(Array.from(rotationByTeam.values()).flatMap(teamPlayers =>
      teamPlayers
        .sort((a, b) => mean(b.rows.slice(0, ROTATION_SAMPLE_SIZE).map(row => Number(row.minutes) || 0))
          - mean(a.rows.slice(0, ROTATION_SAMPLE_SIZE).map(row => Number(row.minutes) || 0)))
        .slice(0, MAX_ROTATION_PLAYERS_PER_TEAM)
        .map(player => player.playerId)));

    for (const player of eligible) {
      if (!rotationPlayerIds.has(player.playerId)) continue;
      for (const market of markets) {
        const valueFor = STAT_BY_MARKET[market];
        const values = player.rows.map(valueFor).filter(Number.isFinite);
        // One appearance cannot establish a trend against earlier games.
        if (values.length < (input.minSampleSize ?? 2)) continue;
        const seasonAverage = mean(values);
        const line = Math.floor(seasonAverage) + 0.5;
        const overHits = values.filter(value => value > line).length;
        // Suggest only Over when recent form is rising and the season sample
        // supports the line. Do not turn a falling trend into an Under pick.
        const recent = values.slice(0, 5);
        const older = values.length > recent.length ? values.slice(recent.length) : values.slice(1);
        if (!older.length) continue;
        const recentAverage = mean(recent);
        const olderAverage = mean(older);
        if (recentAverage <= olderAverage || overHits / values.length < 0.5) continue;
        const side = 'Over';
        const hits = overHits;
        const personalRecord = input.personalByMarket[market] || { wins: 0, losses: 0, total: 0 };
        candidates.push({
          id: `${fixture.id}:${player.playerId}:${market}`,
          gameId: fixture.id,
          game: `${fixture.awayTeam} @ ${fixture.homeTeam}`,
          commenceTime: fixture.commenceTime.toISOString(),
          playerId: player.playerId,
          player: player.latest.player_name,
          team: player.latest.team,
          market,
          line,
          side,
          seasonAverage,
          last5Average: recentAverage,
          hits,
          sampleSize: values.length,
          observedRate: hits / values.length,
          personalRecord: { ...personalRecord },
        });
      }
    }
  }

  const maxPerGame = input.maxPerGame ?? markets.length;
  candidates.sort((a, b) => b.observedRate - a.observedRate
    || b.sampleSize - a.sampleSize
    || Math.abs(a.seasonAverage - a.line) - Math.abs(b.seasonAverage - b.line)
    || a.player.localeCompare(b.player, 'pt-BR'));

  const counts = new Map<string, number>();
  const marketsByGame = new Map<string, Set<SeasonPickMarket>>();
  return candidates.filter(pick => {
    const count = counts.get(pick.gameId) || 0;
    const markets = marketsByGame.get(pick.gameId) || new Set<SeasonPickMarket>();
    if (count >= maxPerGame || markets.has(pick.market)) return false;
    counts.set(pick.gameId, count + 1);
    markets.add(pick.market);
    marketsByGame.set(pick.gameId, markets);
    return true;
  });
}
