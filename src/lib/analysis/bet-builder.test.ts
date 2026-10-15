import { describe, expect, it } from 'vitest';
import { buildSuggestedTickets } from './bet-builder';
import { PlayerPropCandidate } from './player-props';

function candidate(overrides: Partial<PlayerPropCandidate> = {}): PlayerPropCandidate {
  const bestOver = overrides.bestOver ?? { side: 'Over', price: -110, bookmaker: 'Book A', updatedAt: '2026-10-20T12:00:00Z' };
  const bestUnder = overrides.bestUnder ?? { side: 'Under', price: -110, bookmaker: 'Book A', updatedAt: '2026-10-20T12:00:00Z' };
  return {
    id: 'event-1:Player A:player_points:20.5',
    gameId: 'event-1',
    game: 'Team A @ Team B',
    commenceTime: '2026-10-21T00:00:00.000Z',
    player: 'Player A',
    market: 'player_points',
    line: 20.5,
    projection: 24,
    probabilityOver: 0.62,
    probabilityUnder: 0.38,
    marketProbabilityOver: 0.54,
    marketProbabilityUnder: 0.46,
    bestOver,
    bestUnder,
    quotes: overrides.quotes ?? [bestOver, bestUnder],
    expectedValue: 0.18,
    expectedValueUnder: -0.25,
    recommendationSide: 'Over',
    sampleSize: 20,
    shortlistEligible: true,
    last5Average: 24,
    last10Average: 23,
    last20Average: 22,
    confidence: 'moderada',
    reasons: [],
    limitations: [],
    teamVerified: true,
    ...overrides,
  };
}

describe('buildSuggestedTickets', () => {
  it('builds single and independent two-game ticket without inventing joint probability', () => {
    const second = candidate({
      id: 'event-2:Player B:player_rebounds:8.5',
      gameId: 'event-2',
      game: 'Team C @ Team D',
      player: 'Player B',
      market: 'player_rebounds',
      bestOver: { side: 'Over', price: 120, bookmaker: 'Book B', updatedAt: '2026-10-20T12:00:00Z' },
      quotes: [
        { side: 'Over', price: 120, bookmaker: 'Book A', bookmakerKey: 'book-a', updatedAt: '2026-10-20T12:00:00Z' },
        { side: 'Over', price: 130, bookmaker: 'Book B', bookmakerKey: 'book-b', updatedAt: '2026-10-20T12:00:00Z' },
      ],
      expectedValue: 0.12,
    });

    const tickets = buildSuggestedTickets([candidate(), second]);
    expect(tickets).toHaveLength(2);
    expect(tickets[0].estimatedProbability).toBe(0.62);
    expect(tickets[1].combinedDecimalOdds).toBeCloseTo((1 + 100 / 110) * 2.2);
    expect(tickets[1].bookmaker).toBe('Book A');
    expect(tickets[1].selections.map(leg => leg.quote.bookmaker)).toEqual(['Book A', 'Book A']);
    expect(tickets[1].estimatedProbability).toBeNull();
    expect(tickets[1].warning).toContain('correlacionadas');
  });

  it('does not suggest bets without quality gate, positive EV, or a quote', () => {
    const tickets = buildSuggestedTickets([
      candidate({ shortlistEligible: false }),
      candidate({ id: 'no-quote', gameId: 'event-2', player: 'Player B', bestOver: undefined }),
      candidate({ id: 'negative-ev', gameId: 'event-3', player: 'Player C', expectedValue: -0.1 }),
    ]);
    expect(tickets).toEqual([]);
  });

  it('requires a different game and player for the two-selection ticket', () => {
    const sameGame = candidate({ id: 'same-game-player-b', player: 'Player B', gameId: 'event-1' });
    expect(buildSuggestedTickets([candidate(), sameGame])).toHaveLength(1);
  });

  it('does not show a multiple when the legs do not share a sportsbook', () => {
    const second = candidate({
      id: 'event-2:Player B:player_assists:5.5', gameId: 'event-2', player: 'Player B',
      bestOver: { side: 'Over', price: 120, bookmaker: 'Book B', updatedAt: '2026-10-20T12:00:00Z' },
      quotes: [{ side: 'Over', price: 120, bookmaker: 'Book B', updatedAt: '2026-10-20T12:00:00Z' }],
    });
    const tickets = buildSuggestedTickets([candidate(), second]);
    expect(tickets.map(ticket => ticket.id)).toEqual(['single']);
  });

  it('adds an exaggerated six-pick ticket only when six different players qualify', () => {
    const six = Array.from({ length: 6 }, (_, index) => candidate({
      id: `event-${index + 1}:Player ${index + 1}`,
      gameId: `event-${index + 1}`,
      player: `Player ${index + 1}`,
      expectedValue: 0.2 - index * 0.01,
    }));
    const tickets = buildSuggestedTickets(six);
    const exaggerated = tickets.find(ticket => ticket.id === 'exaggerated');
    expect(exaggerated?.selections).toHaveLength(6);
    expect(exaggerated?.estimatedProbability).toBeNull();
    expect(exaggerated?.warning).toContain('alto risco');
  });

  it('does not create an exaggerated ticket with fewer than six qualified players', () => {
    const four = Array.from({ length: 4 }, (_, index) => candidate({
      id: `event-${index + 1}:Player ${index + 1}`,
      gameId: `event-${index + 1}`,
      player: `Player ${index + 1}`,
    }));
    expect(buildSuggestedTickets(four).some(ticket => ticket.id === 'exaggerated')).toBe(false);
  });
});
