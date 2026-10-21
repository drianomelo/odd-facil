import { SeasonPlayerPick } from './season-player-picks';

export type SeasonSuggestedTicket = {
  id: 'single' | 'double' | 'exaggerated';
  title: string;
  picks: SeasonPlayerPick[];
};

function normalizePlayer(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function evidenceScore(pick: SeasonPlayerPick) {
  // Light smoothing keeps a 1/1 result from outranking a strong, larger sample by itself.
  const seasonRate = (pick.hits + 1) / (pick.sampleSize + 2);
  const personalTotal = pick.personalRecord.wins + pick.personalRecord.losses;
  const personalRate = (pick.personalRecord.wins + 1) / (personalTotal + 2);
  // The user's manually recorded outcomes contribute a small, capped market-level prior.
  const personalWeight = Math.min(0.2, personalTotal / 25 * 0.2);
  return seasonRate * (1 - personalWeight) + personalRate * personalWeight;
}

function rankPicks(picks: SeasonPlayerPick[]) {
  return [...picks].sort((a, b) => evidenceScore(b) - evidenceScore(a)
    || b.sampleSize - a.sampleSize
    || b.observedRate - a.observedRate
    || a.player.localeCompare(b.player, 'pt-BR'));
}

function uniquePlayers(picks: SeasonPlayerPick[], count: number) {
  const selected: SeasonPlayerPick[] = [];
  const seen = new Set<string>();
  for (const pick of rankPicks(picks)) {
    const player = normalizePlayer(pick.player);
    if (seen.has(player)) continue;
    seen.add(player);
    selected.push(pick);
    if (selected.length === count) break;
  }
  return selected;
}

function playerMarketKey(pick: SeasonPlayerPick) {
  return `${normalizePlayer(pick.player)}:${pick.market}`;
}

/** Builds combinations from already stored season-only signals. It never invents odds or probabilities. */
export function buildSeasonSuggestedTickets(picks: SeasonPlayerPick[]): SeasonSuggestedTicket[] {
  const ranked = rankPicks(picks);
  const tickets: SeasonSuggestedTicket[] = [];
  const usedPlayerMarkets = new Set<string>();
  if (ranked[0]) {
    tickets.push({ id: 'single', title: 'Sinal individual em destaque', picks: [ranked[0]] });
    usedPlayerMarkets.add(playerMarketKey(ranked[0]));
  }

  const double = uniquePlayers(ranked.filter(pick => !usedPlayerMarkets.has(playerMarketKey(pick))), 2);
  if (double.length === 2) {
    tickets.push({ id: 'double', title: 'Dupla de sinais', picks: double });
    double.forEach(pick => usedPlayerMarkets.add(playerMarketKey(pick)));
  }

  const exaggerated = uniquePlayers(ranked.filter(pick => !usedPlayerMarkets.has(playerMarketKey(pick))), 6);
  if (exaggerated.length === 6) tickets.push({ id: 'exaggerated', title: 'Múltipla exagerada · 6 sinais', picks: exaggerated });
  return tickets;
}
