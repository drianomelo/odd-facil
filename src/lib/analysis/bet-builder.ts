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

function getEdge(candidate: PlayerPropCandidate): number | undefined {
  return candidate.recommendationSide === 'Under' ? candidate.edgeUnder : candidate.edge;
}

function compareEntries(a: EligibleEntry, b: EligibleEntry): number {
  const edgeA = getEdge(a.candidate) ?? -Infinity;
  const edgeB = getEdge(b.candidate) ?? -Infinity;
  return edgeB - edgeA
    || b.expectedValue - a.expectedValue
    || getProbability(b.candidate) - getProbability(a.candidate)
    || b.candidate.sampleSize - a.candidate.sampleSize;
}

function selectionKey(candidate: PlayerPropCandidate): string {
  return [
    candidate.gameId,
    candidate.player.trim().toLowerCase(),
    candidate.market,
    candidate.line,
    candidate.recommendationSide || 'Over',
  ].join(':');
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

function bestAvailableQuote(entry: EligibleEntry): PlayerPropQuote {
  return quotesFor(entry).reduce((best, quote) =>
    toDecimalOdds(quote.price) > toDecimalOdds(best.price) ? quote : best, entry.quote);
}

function ticketBookmaker(quotes: PlayerPropQuote[]): string {
  const books = new Map(quotes.map(quote => [bookId(quote), quote.bookmaker]));
  return books.size === 1 ? Array.from(books.values())[0] : 'Casas variadas';
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
    bookmaker: ticketBookmaker(quotes),
    warning,
  };
}

/** Each leg uses its best available quote; mixed-book combined odds are an estimate across books. */
export function buildSuggestedTickets(candidates: PlayerPropCandidate[]): SuggestedTicket[] {
  const eligible = candidates
    .map(candidate => ({ candidate, quote: getQuote(candidate), expectedValue: getExpectedValue(candidate) }))
    .filter((entry): entry is EligibleEntry => entry.candidate.shortlistEligible
      && entry.quote !== undefined && entry.expectedValue !== undefined && Number.isFinite(entry.expectedValue)
      && entry.expectedValue > 0 && Number.isFinite(entry.quote.price) && entry.quote.price !== 0)
    // Rank the strength of the signal first; odds affect the quote we attach,
    // not which prediction is considered the best one.
    .sort(compareEntries);

  const tickets: SuggestedTicket[] = [];
  const usedSelections = new Set<string>();
  const top = eligible[0];
  if (top) {
    const quote = bestAvailableQuote(top);
    tickets.push(makeTicket('single', 'Simples', [top], [quote], toDecimalOdds(quote.price), getProbability(top.candidate)));
    usedSelections.add(selectionKey(top.candidate));
  }

  const pairPool = eligible.filter(entry => !usedSelections.has(selectionKey(entry.candidate))).slice(0, 80);
  const pair = pairPool.length
    ? [pairPool[0], pairPool.find(entry => entry.candidate.player.toLowerCase() !== pairPool[0].candidate.player.toLowerCase())]
        .filter((entry): entry is EligibleEntry => !!entry)
    : [];
  const pairQuotes = pair.map(bestAvailableQuote);
  const pairDecimal = pairQuotes.reduce((total, quote) => total * toDecimalOdds(quote.price), 1);
  const bestPair = pair.length === 2 ? { entries: pair, quotes: pairQuotes, decimal: pairDecimal } : null;
  if (bestPair) {
    tickets.push(makeTicket('double', 'Múltipla com 2 seleções', bestPair.entries, bestPair.quotes,
      bestPair.decimal, null,
      'Selecionada pela força dos palpites, não pela maior odd. A chance conjunta não é estimada porque as seleções podem ser correlacionadas; a odd combina preços individuais e pode diferir da cotação da múltipla na casa.'));
    bestPair.entries.forEach(entry => usedSelections.add(selectionKey(entry.candidate)));
  }

  const unique = eligible.filter(item => !usedSelections.has(selectionKey(item.candidate)))
    .filter((entry, index, all) => all.findIndex(other =>
      other.candidate.player.toLowerCase() === entry.candidate.player.toLowerCase(),
    ) === index).slice(0, 6);
  if (unique.length === 6) {
    const quotes = unique.map(bestAvailableQuote);
    const decimal = quotes.reduce((total, quote) => total * toDecimalOdds(quote.price), 1);
    tickets.push(makeTicket('exaggerated', 'Exagerada · 6 palpites', unique, quotes, decimal, null,
      'Alto risco. São os seis palpites mais bem ranqueados que sobraram. Chance conjunta não estimada; a odd combina as melhores cotações individuais e pode diferir da cotação da múltipla na casa.'));
  }

  return tickets;
}
