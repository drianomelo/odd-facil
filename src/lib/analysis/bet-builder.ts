import { PlayerPropCandidate, PlayerPropQuote } from '@/lib/analysis/player-props';

export type BetSelection = {
  id: string;
  gameId: string;
  game: string;
  commenceTime: string;
  player: string;
  team?: string;
  homeTeam?: string;
  awayTeam?: string;
  market: PlayerPropCandidate['market'];
  line: number;
  side: 'Over' | 'Under';
  probability: number;
  quote: PlayerPropQuote;
  confidence: PlayerPropCandidate['confidence'];
  sampleSize: number;
  reasons: string[];
};

export type SuggestedTicket = {
  id: 'single' | 'double' | 'exaggerated';
  label: string;
  selections: BetSelection[];
  combinedDecimalOdds: number;
  combinedAmericanOdds: number;
  estimatedProbability: number | null;
  bookmaker: string;
  warning?: string;
};

type EligibleEntry = { candidate: PlayerPropCandidate; quote: PlayerPropQuote; expectedValue: number };

function bookId(quote: PlayerPropQuote): string {
  return (quote.bookmakerKey || quote.bookmaker).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getQuote(candidate: PlayerPropCandidate): PlayerPropQuote | undefined {
  return candidate.recommendationSide === 'Under' ? candidate.bestUnder : candidate.bestOver;
}

function quotesFor(entry: EligibleEntry): PlayerPropQuote[] {
  const side = entry.candidate.recommendationSide || 'Over';
  const quotes = (entry.candidate.quotes || []).filter(quote => quote.side === side);
  if (quotes.length) return quotes;
  return entry.quote.side === side ? [entry.quote] : [];
}

function getProbability(candidate: PlayerPropCandidate): number {
  return candidate.recommendationSide === 'Under' ? candidate.probabilityUnder : candidate.probabilityOver;
}

function getExpectedValue(candidate: PlayerPropCandidate): number | undefined {
  return candidate.recommendationSide === 'Under' ? candidate.expectedValueUnder : candidate.expectedValue;
}

function toDecimalOdds(americanOdds: number): number {
  return americanOdds > 0 ? 1 + americanOdds / 100 : 1 + 100 / Math.abs(americanOdds);
}

function toAmericanOdds(decimalOdds: number): number {
  if (decimalOdds >= 2) return Math.round((decimalOdds - 1) * 100);
  return -Math.round(100 / (decimalOdds - 1));
}

function selection(candidate: PlayerPropCandidate, quote: PlayerPropQuote): BetSelection {
  return {
    id: candidate.id,
    gameId: candidate.gameId,
    game: candidate.game,
    commenceTime: candidate.commenceTime,
    player: candidate.player,
    team: candidate.team,
    homeTeam: candidate.homeTeam,
    awayTeam: candidate.awayTeam,
    market: candidate.market,
    line: candidate.line,
    side: candidate.recommendationSide || 'Over',
    probability: getProbability(candidate),
    quote,
    confidence: candidate.confidence,
    sampleSize: candidate.sampleSize,
    reasons: candidate.reasons,
  };
}

function bestSharedBook(entries: EligibleEntry[]): { bookmaker: string; quotes: PlayerPropQuote[]; decimal: number } | null {
  if (!entries.length) return null;
  const choices = new Map<string, PlayerPropQuote[]>();
  for (const quote of quotesFor(entries[0])) choices.set(bookId(quote), [quote]);
  for (const entry of entries.slice(1)) {
    const available = new Map(quotesFor(entry).map(quote => [bookId(quote), quote]));
    for (const [key, quotes] of Array.from(choices.entries())) {
      const quote = available.get(key);
      if (!quote) choices.delete(key);
      else quotes.push(quote);
    }
  }
  let best: { bookmaker: string; quotes: PlayerPropQuote[]; decimal: number } | null = null;
  for (const quotes of Array.from(choices.values())) {
    if (quotes.length !== entries.length) continue;
    const decimal = quotes.reduce((total, quote) => total * toDecimalOdds(quote.price), 1);
    if (!best || decimal > best.decimal) best = { bookmaker: quotes[0].bookmaker, quotes, decimal };
  }
  return best;
}

function makeTicket(
  id: SuggestedTicket['id'], label: string, entries: EligibleEntry[], quotes: PlayerPropQuote[], decimal: number,
  estimatedProbability: number | null, warning?: string,
): SuggestedTicket {
  return {
    id,
    label,
    selections: entries.map((entry, index) => selection(entry.candidate, quotes[index])),
    combinedDecimalOdds: decimal,
    combinedAmericanOdds: entries.length === 1 ? quotes[0].price : toAmericanOdds(decimal),
    estimatedProbability,
    bookmaker: quotes[0].bookmaker,
    warning,
  };
}

/** Suggestions use one sportsbook for every leg so the displayed combined price is attainable there. */
export function buildSuggestedTickets(candidates: PlayerPropCandidate[]): SuggestedTicket[] {
  const eligible = candidates
    .map(candidate => ({ candidate, quote: getQuote(candidate), expectedValue: getExpectedValue(candidate) }))
    .filter((entry): entry is EligibleEntry => entry.candidate.shortlistEligible
      && entry.quote !== undefined && entry.expectedValue !== undefined && Number.isFinite(entry.expectedValue)
      && entry.expectedValue > 0 && Number.isFinite(entry.quote.price) && entry.quote.price !== 0)
    .sort((a, b) => b.expectedValue - a.expectedValue || b.candidate.sampleSize - a.candidate.sampleSize);

  const tickets: SuggestedTicket[] = [];
  const top = eligible[0];
  if (top) {
    const quote = quotesFor(top).reduce<PlayerPropQuote | undefined>((best, current) =>
      !best || toDecimalOdds(current.price) > toDecimalOdds(best.price) ? current : best, undefined) || top.quote;
    tickets.push(makeTicket('single', 'Simples', [top], [quote], toDecimalOdds(quote.price), getProbability(top.candidate)));
  }

  let bestPair: { entries: EligibleEntry[]; shared: NonNullable<ReturnType<typeof bestSharedBook>> } | null = null;
  const pairPool = eligible.slice(0, 80);
  for (let i = 0; i < pairPool.length; i += 1) {
    for (let j = i + 1; j < pairPool.length; j += 1) {
      const pair = [pairPool[i], pairPool[j]];
      if (pair[0].candidate.gameId === pair[1].candidate.gameId || pair[0].candidate.player === pair[1].candidate.player) continue;
      const shared = bestSharedBook(pair);
      if (shared && (!bestPair || shared.decimal > bestPair.shared.decimal)) bestPair = { entries: pair, shared };
    }
  }
  if (bestPair) tickets.push(makeTicket('double', 'Múltipla com 2 seleções', bestPair.entries, bestPair.shared.quotes,
    bestPair.shared.decimal, null,
    'A chance conjunta não é estimada: as seleções podem ser correlacionadas. As duas cotações são da mesma casa.'));

  const byBook = new Map<string, EligibleEntry[]>();
  for (const entry of eligible) {
    for (const quote of quotesFor(entry)) {
      const key = bookId(quote);
      const entries = byBook.get(key) || [];
      if (!entries.some(other => other.candidate.player === entry.candidate.player)) entries.push(entry);
      byBook.set(key, entries);
    }
  }
  let bestExaggerated: { entries: EligibleEntry[]; shared: NonNullable<ReturnType<typeof bestSharedBook>> } | null = null;
  for (const entries of Array.from(byBook.values())) {
    const unique = entries.filter((entry, index, all) => all.findIndex(other =>
      other.candidate.player === entry.candidate.player || other.candidate.gameId === entry.candidate.gameId,
    ) === index).slice(0, 6);
    if (unique.length < 6) continue;
    const shared = bestSharedBook(unique);
    if (shared && (!bestExaggerated || shared.decimal > bestExaggerated.shared.decimal)) bestExaggerated = { entries: unique, shared };
  }
  if (bestExaggerated) tickets.push(makeTicket('exaggerated', 'Exagerada · 6 palpites', bestExaggerated.entries,
    bestExaggerated.shared.quotes, bestExaggerated.shared.decimal, null,
    'Bilhete de alto risco. A chance conjunta não é estimada e as seleções podem ser correlacionadas. As seis cotações são da mesma casa.'));

  return tickets;
}
