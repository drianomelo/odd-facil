export type PlayerPropSelection = 'Over' | 'Under';
export type PlayerPropResult = 'won' | 'lost' | 'push' | 'void';

export function isFinalPlayerGame(status: unknown): boolean {
  if (status === undefined || status === null || status === '') return true;
  return typeof status === 'string' && status.trim().toLowerCase() === 'final';
}

export type GradeablePlayerPropForecast = {
  id: string;
  eventId: string;
  market: string;
  line: number;
  selection: PlayerPropSelection;
};

export type GradeablePlayerGameLog = {
  event_id?: string;
  status?: unknown;
  stats: Record<string, number | string | null | undefined>;
};

export type PlayerPropGradeUpdate = {
  id: string;
  actual: number | undefined;
  result: PlayerPropResult;
};

export function isTestPlayerPropForecast(modelVersion: string, details: unknown): boolean {
  if (modelVersion === 'test') return true;
  let parsed = details;
  if (typeof details === 'string') {
    try { parsed = JSON.parse(details); } catch { return false; }
  }
  return Boolean(parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).test === true);
}

const MARKET_STAT: Record<string, string> = {
  player_points: 'points',
  player_rebounds: 'rebounds',
  player_assists: 'assists',
  player_threes: 'threes',
  player_points_rebounds_assists: 'points_rebounds_assists',
};

export function getGradeablePlayerPropUpdates(
  forecasts: GradeablePlayerPropForecast[],
  logs: GradeablePlayerGameLog[],
): PlayerPropGradeUpdate[] {
  const logByEvent = new Map(logs.filter(log => log.event_id).map(log => [log.event_id as string, log]));
  const updates: PlayerPropGradeUpdate[] = [];

  for (const forecast of forecasts) {
    const log = logByEvent.get(forecast.eventId);
    if (!log || !isFinalPlayerGame(log.status)) continue;

    const statKey = MARKET_STAT[forecast.market];
    let rawActual = statKey ? log.stats[statKey] : undefined;
    if (forecast.market === 'player_points_rebounds_assists'
      && (rawActual === null || rawActual === undefined || rawActual === '')) {
      const components = [log.stats.points, log.stats.rebounds, log.stats.assists].map(Number);
      if (components.every(Number.isFinite)) rawActual = components.reduce((total, value) => total + value, 0);
    }
    const numericActual = rawActual === null || rawActual === undefined || rawActual === ''
      ? undefined
      : Number(rawActual);
    const actual = numericActual !== undefined && Number.isFinite(numericActual) ? numericActual : undefined;
    updates.push({
      id: forecast.id,
      actual,
      result: gradePlayerProp(forecast.selection, forecast.line, actual),
    });
  }

  return updates;
}


export function gradePlayerProp(
  selection: PlayerPropSelection,
  line: number,
  actual: number | undefined,
): PlayerPropResult {
  if (actual === undefined || !Number.isFinite(actual) || !Number.isFinite(line)) return 'void';
  if (actual === line) return 'push';
  const actualSide = actual > line ? 'Over' : 'Under';
  return actualSide === selection ? 'won' : 'lost';
}
