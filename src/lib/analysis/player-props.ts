export type PlayerPropMarket =
  | 'player_points'
  | 'player_rebounds'
  | 'player_assists'
  | 'player_threes'
  | 'player_points_rebounds_assists';

export interface PlayerGameLog {
  event_id?: string;
  commence_time: string;
  player_team?: string | null;
  opponent?: string | null;
  status?: string;
  stats: Record<string, number | string | null | undefined>;
}

export interface PlayerPropQuote {
  side: 'Over' | 'Under';
  price: number;
  bookmaker: string;
  bookmakerKey?: string;
  updatedAt: string;
}

export interface PlayerPropCandidate {
  id: string;
  gameId: string;
  game: string;
  commenceTime: string;
  player: string;
  team?: string;
  homeTeam?: string;
  awayTeam?: string;
  market: PlayerPropMarket;
  line: number;
  projection: number;
  probabilityOver: number;
  probabilityUnder: number;
  marketProbabilityOver?: number;
  marketProbabilityUnder?: number;
  bestOver?: PlayerPropQuote;
  bestUnder?: PlayerPropQuote;
  quotes: PlayerPropQuote[];
  edge?: number;
  expectedValue?: number;
  edgeUnder?: number;
  expectedValueUnder?: number;
  recommendationSide?: 'Over' | 'Under';
  sampleSize: number;
  shortlistEligible: boolean;
  last5Average: number;
  last10Average: number;
  last20Average: number;
  averageMinutes?: number;
  minutesTrend?: number;
  opponentAverage?: number;
  opponent?: string;
  teamVerified: boolean;
  confidence: 'baixa' | 'moderada';
  reasons: string[];
  limitations: string[];
}

const STAT_FIELDS: Record<PlayerPropMarket, string[]> = {
  player_points: ['points'],
  player_rebounds: ['rebounds'],
  player_assists: ['assists'],
  player_threes: ['threes', 'three_pointers_made'],
  player_points_rebounds_assists: ['points_rebounds_assists', 'pra'],
};

export function getStat(log: PlayerGameLog, market: PlayerPropMarket): number | undefined {
  for (const field of STAT_FIELDS[market]) {
    const value = Number(log.stats[field]);
    if (Number.isFinite(value)) return value;
  }
  if (market === 'player_points_rebounds_assists') {
    const points = Number(log.stats.points);
    const rebounds = Number(log.stats.rebounds);
    const assists = Number(log.stats.assists);
    if ([points, rebounds, assists].every(Number.isFinite)) return points + rebounds + assists;
  }
  return undefined;
}

function getMinutes(log: PlayerGameLog): number | undefined {
  const value = Number(log.stats.minutes ?? log.stats.min);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function normalizeTeamName(team: string | null | undefined): string {
  return (team || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function resolvePlayerOpponent(
  playerTeam: string | null | undefined,
  homeTeam: string,
  awayTeam: string,
): string | undefined {
  const normalizedPlayerTeam = normalizeTeamName(playerTeam);
  if (!normalizedPlayerTeam) return undefined;
  if (normalizedPlayerTeam === normalizeTeamName(homeTeam)) return awayTeam;
  if (normalizedPlayerTeam === normalizeTeamName(awayTeam)) return homeTeam;
  return undefined;
}

export function isSyntheticPickemBook(bookmakerKey: string, bookmakerTitle: string): boolean {
  const key = bookmakerKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  const title = bookmakerTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const syntheticPickemKeys = new Set(['prizepicks', 'sleeper', 'dabble', 'parlayplay']);
  return syntheticPickemKeys.has(key)
    || key.includes('draftkingspick6')
    || title.includes('prizepicks')
    || title.includes('pick6')
    || title === 'sleeper'
    || title === 'dabble'
    || title === 'parlayplay';
}

function normalCdf(value: number, mean: number, standardDeviation: number): number {
  if (standardDeviation <= 0) return value < mean ? 0 : 1;
  const z = (value - mean) / (standardDeviation * Math.sqrt(2));
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const erf = 1 - (((((1.0614054 * t - 1.453152) * t) + 1.4214137) * t - 0.2844967) * t + 0.2548296) * t * Math.exp(-z * z);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function impliedProbability(americanOdds: number): number {
  if (americanOdds === 0) return 0.5;
  return americanOdds > 0
    ? 100 / (americanOdds + 100)
    : -americanOdds / (-americanOdds + 100);
}

function decimalOdds(americanOdds: number): number {
  return americanOdds > 0 ? 1 + americanOdds / 100 : 1 + 100 / -americanOdds;
}

function bestQuote(quotes: PlayerPropQuote[], side: PlayerPropQuote['side']): PlayerPropQuote | undefined {
  return quotes.filter(quote => quote.side === side)
    .reduce<PlayerPropQuote | undefined>((best, quote) => !best || quote.price > best.price ? quote : best, undefined);
}

export function analyzePlayerProp(input: {
  gameId: string;
  game: string;
  commenceTime: string;
  player: string;
  market: PlayerPropMarket;
  line: number;
  logs: PlayerGameLog[];
  quotes: PlayerPropQuote[];
  homeTeam: string;
  awayTeam: string;
}): PlayerPropCandidate | null {
  const logs = input.logs
    .filter(log => !log.status || log.status === 'final')
    .map(log => ({ log, value: getStat(log, input.market), minutes: getMinutes(log) }))
    .filter((row): row is typeof row & { value: number } => row.value !== undefined)
    .sort((a, b) => Date.parse(b.log.commence_time) - Date.parse(a.log.commence_time)
      || (a.log.commence_time < b.log.commence_time ? 1 : -1));
  if (logs.length < 5) return null;

  const last5 = logs.slice(0, 5);
  const last10 = logs.slice(0, 10);
  const last20 = logs.slice(0, 20);
  const raw5 = average(last5.map(row => row.value));
  const raw10 = average(last10.map(row => row.value));
  const raw20 = average(last20.map(row => row.value));
  const minutes = last20.map(row => row.minutes).filter((value): value is number => value !== undefined);
  const avgMinutes = average(minutes);
  const last5Minutes = average(last5.map(row => row.minutes).filter((value): value is number => value !== undefined));
  const minuteTrend = avgMinutes > 0 && last5Minutes > 0 ? last5Minutes / avgMinutes : undefined;

  const playerTeam = logs.find(row => row.log.player_team)?.log.player_team;
  const opponent = resolvePlayerOpponent(playerTeam, input.homeTeam, input.awayTeam);
  const teamVerified = opponent !== undefined;
  if (!teamVerified) return null;
  const opponentLogs = opponent
    ? last20.filter(row => normalizeTeamName(row.log.opponent) === normalizeTeamName(opponent))
    : [];
  const opponentAverage = opponentLogs.length >= 2
    ? average(opponentLogs.map(row => row.value))
    : undefined;

  const perMinuteProjection = minutes.length >= 5 && avgMinutes > 0
    ? average(last5.map(row => row.minutes && row.minutes > 0 ? row.value / row.minutes : row.value / avgMinutes))
      * (avgMinutes * 0.55 + last5Minutes * 0.45)
    : raw5 * 0.5 + raw10 * 0.3 + raw20 * 0.2;
  const projection = Math.max(0, perMinuteProjection * 0.65 + (raw5 * 0.5 + raw10 * 0.3 + raw20 * 0.2) * 0.35);
  const matchupAdjustment = opponentAverage === undefined
    ? 0
    : Math.max(-0.1, Math.min(0.1, (opponentAverage - raw20) / Math.max(raw20, 1))) * projection * 0.2;
  const adjustedProjection = projection + matchupAdjustment;

  const values = last20.map(row => row.value);
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + (value - raw20) ** 2, 0) / (values.length - 1)
    : 0;
  const standardDeviation = Math.max(Math.sqrt(variance), Math.sqrt(Math.max(raw20, 1)));
  const overBoundary = Number.isInteger(input.line) ? input.line + 0.5 : input.line;
  const probabilityOver = Math.max(0.01, Math.min(0.99, 1 - normalCdf(overBoundary, adjustedProjection, standardDeviation)));
  const probabilityUnder = 1 - probabilityOver;

  const overQuote = bestQuote(input.quotes, 'Over');
  const underQuote = bestQuote(input.quotes, 'Under');
  const fairOverByBook: number[] = [];
  const fairUnderByBook: number[] = [];
  for (const quote of input.quotes) {
    const paired = input.quotes.find(other => other.bookmaker === quote.bookmaker && other.side !== quote.side);
    if (!paired) continue;
    const over = quote.side === 'Over' ? impliedProbability(quote.price) : impliedProbability(paired.price);
    const under = quote.side === 'Under' ? impliedProbability(quote.price) : impliedProbability(paired.price);
    const total = over + under;
    if (total > 0) {
      fairOverByBook.push(over / total);
      fairUnderByBook.push(under / total);
    }
  }
  const marketProbabilityOver = fairOverByBook.length ? average(fairOverByBook) : undefined;
  const marketProbabilityUnder = fairUnderByBook.length ? average(fairUnderByBook) : undefined;
  const edge = overQuote && marketProbabilityOver !== undefined
    ? probabilityOver - marketProbabilityOver
    : undefined;
  const expectedValue = overQuote
    ? probabilityOver * decimalOdds(overQuote.price) - 1
    : undefined;
  const edgeUnder = underQuote && marketProbabilityUnder !== undefined
    ? probabilityUnder - marketProbabilityUnder
    : undefined;
  const expectedValueUnder = underQuote
    ? probabilityUnder * decimalOdds(underQuote.price) - 1
    : undefined;
  const recommendationSide = (expectedValueUnder ?? -Infinity) > (expectedValue ?? -Infinity) ? 'Under' : 'Over';

  const reasons = [
    `Projeção ${adjustedProjection.toFixed(1)} contra linha ${input.line}`,
    `Médias: L5 ${raw5.toFixed(1)}, L10 ${raw10.toFixed(1)}, L20 ${raw20.toFixed(1)}`,
  ];
  if (avgMinutes > 0) reasons.push(`Média de ${avgMinutes.toFixed(1)} minutos; tendência recente ${minuteTrend && minuteTrend >= 1 ? '+' : ''}${minuteTrend ? `${((minuteTrend - 1) * 100).toFixed(0)}%` : 'indisponível'}`);
  if (opponentAverage !== undefined) reasons.push(`${opponentAverage.toFixed(1)} de média nos ${opponentLogs.length} jogos recentes contra o adversário`);
  if (edge !== undefined) reasons.push(`Diferença de ${(edge * 100).toFixed(1)} p.p. sobre a probabilidade média sem margem do mercado`);

  const limitations = [
    'Projeção experimental baseada em logs recentes; ainda sem validação retrospectiva e calibração de probabilidades.',
    'Lesões, escalações e minutos esperados precisam ser confirmados antes do jogo.',
  ];
  if (!teamVerified) limitations.push('Não foi possível confirmar o time atual do jogador neste confronto; H2H e ajuste de adversário foram ignorados.');
  else if (opponentAverage === undefined) limitations.push('Amostra direta recente contra este adversário insuficiente; matchup não altera a projeção.');
  if (marketProbabilityOver === undefined) limitations.push('Sem cotações Over/Under pareadas para estimar consenso sem margem.');

  const confidence = logs.length >= 15 && minuteTrend !== undefined && Math.abs(minuteTrend - 1) < 0.15
    ? 'moderada'
    : 'baixa';
  const selectedExpectedValue = recommendationSide === 'Over' ? expectedValue : expectedValueUnder;
  const selectedMarketProbability = recommendationSide === 'Over' ? marketProbabilityOver : marketProbabilityUnder;
  // This is only a data-quality gate for the review shortlist. It does not mean
  // the model is calibrated or that the prop is a proven profitable bet.
  const shortlistEligible = teamVerified
    && confidence === 'moderada'
    && selectedExpectedValue !== undefined
    && selectedExpectedValue > 0
    && selectedMarketProbability !== undefined;

  return {
    id: `${input.gameId}:${input.player}:${input.market}:${input.line}`,
    gameId: input.gameId,
    game: input.game,
    commenceTime: input.commenceTime,
    player: input.player,
    team: playerTeam || undefined,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    market: input.market,
    line: input.line,
    projection: adjustedProjection,
    probabilityOver,
    probabilityUnder,
    marketProbabilityOver,
    marketProbabilityUnder,
    bestOver: overQuote,
    bestUnder: underQuote,
    quotes: input.quotes,
    edge,
    expectedValue,
    edgeUnder,
    expectedValueUnder,
    recommendationSide,
    sampleSize: last20.length,
    shortlistEligible,
    last5Average: raw5,
    last10Average: raw10,
    last20Average: raw20,
    averageMinutes: avgMinutes || undefined,
    minutesTrend: minuteTrend,
    opponentAverage,
    opponent,
    teamVerified,
    confidence,
    reasons,
    limitations,
  };
}
