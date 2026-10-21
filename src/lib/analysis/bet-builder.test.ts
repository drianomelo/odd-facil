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
  it('builds disjoint single and double tickets without inventing joint probability', () => {
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

    const third = candidate({
      id: 'event-3:Player C:player_assists:5.5', gameId: 'event-3', player: 'Player C', market: 'player_assists',
    });
    const tickets = buildSuggestedTickets([candidate(), second, third]);
    expect(tickets).toHaveLength(2);
    expect(tickets[0].estimatedProbability).toBe(0.62);
    expect(tickets[1].combinedDecimalOdds).toBeCloseTo((1 + 100 / 110) * 2.3);
    expect(tickets[1].bookmaker).toBe('Casas variadas');
    expect(tickets[1].selections.map(leg => leg.quote.bookmaker)).toEqual(['Book A', 'Book B']);
    expect(tickets[1].estimatedProbability).toBeNull();
    expect(tickets[1].warning).toContain('correlacionadas');
    const selectedIds = tickets.flatMap(ticket => ticket.selections.map(leg => leg.id));
    expect(selectedIds[0]).toBe('event-1:Player A:player_points:20.5');
    expect(new Set(selectedIds.slice(1))).toEqual(new Set([
      'event-2:Player B:player_rebounds:8.5',
      'event-3:Player C:player_assists:5.5',
    ]));
    expect(new Set(selectedIds).size).toBe(selectedIds.length);
  });

  it('does not suggest bets without quality gate, positive EV, or a quote', () => {
    const tickets = buildSuggestedTickets([
      candidate({ shortlistEligible: false }),
      candidate({ id: 'no-quote', gameId: 'event-2', player: 'Player B', bestOver: undefined }),
      candidate({ id: 'negative-ev', gameId: 'event-3', player: 'Player C', expectedValue: -0.1 }),
    ]);
    expect(tickets).toEqual([]);
  });

  it('ranks the strongest market edge ahead of a larger EV or a larger payout', () => {
    const strongestEdge = candidate({ id: 'edge-pick', player: 'Edge Pick', gameId: 'edge-game', edge: 0.18, expectedValue: 0.12 });
    const highEv = candidate({ id: 'ev-pick', player: 'EV Pick', gameId: 'ev-game', edge: 0.05, expectedValue: 0.4 });
    const steady = candidate({ id: 'steady-pick', player: 'Steady Pick', gameId: 'steady-game', edge: 0.1, expectedValue: 0.15 });
    const tickets = buildSuggestedTickets([highEv, steady, strongestEdge]);
    expect(tickets[0].selections[0].id).toBe('edge-pick');
    expect(tickets[1].selections.map(leg => leg.id)).toEqual(['steady-pick', 'ev-pick']);
  });

  it('allows a player in different tickets for different markets but never repeats the same player market', () => {
    const props = [
      candidate({ id: 'anthony-pra-main', player: 'Anthony Edwards', market: 'player_points_rebounds_assists', line: 34.5, edge: 0.3, expectedValue: 0.3 }),
      candidate({ id: 'anthony-pra-alt', player: 'Anthony Edwards', market: 'player_points_rebounds_assists', line: 37.5, edge: 0.29, expectedValue: 0.29 }),
      candidate({ id: 'anthony-points', player: 'Anthony Edwards', market: 'player_points', line: 24.5, edge: 0.28, expectedValue: 0.28 }),
      candidate({ id: 'jalen-rebounds', player: 'Jalen Suggs', market: 'player_rebounds', edge: 0.2, expectedValue: 0.2 }),
      candidate({ id: 'anthony-assists', player: 'Anthony Edwards', market: 'player_assists', edge: 0.18, expectedValue: 0.18 }),
      ...Array.from({ length: 6 }, (_, index) => candidate({
        id: `other-${index}`,
        player: `Other Player ${index}`,
        gameId: `other-game-${index}`,
        edge: 0.17 - index * 0.01,
        expectedValue: 0.17 - index * 0.01,
      })),
    ];
    const tickets = buildSuggestedTickets(props);
    expect(tickets.map(ticket => ticket.id)).toEqual(['single', 'double', 'exaggerated']);
    const anthonyLegs = tickets.flatMap(ticket => ticket.selections).filter(leg => leg.player === 'Anthony Edwards');
    expect(anthonyLegs.map(leg => leg.market).sort()).toEqual(['player_assists', 'player_points', 'player_points_rebounds_assists']);
    const playerMarkets = tickets.flatMap(ticket => ticket.selections.map(leg => `${leg.player.toLowerCase()}:${leg.market}`));
    expect(new Set(playerMarkets).size).toBe(playerMarkets.length);
    expect(tickets.every(ticket => new Set(ticket.selections.map(leg => leg.player.toLowerCase())).size === ticket.selections.length)).toBe(true);
  });

  it('allows two different players from the same game in a multiple', () => {
    const sameGame = candidate({ id: 'same-game-player-b', player: 'Player B', gameId: 'event-1' });
    const sameGameThird = candidate({ id: 'same-game-player-c', player: 'Player C', gameId: 'event-1', bestOver: { side: 'Over', price: 130, bookmaker: 'Book B', updatedAt: '2026-10-20T12:00:00Z' }, quotes: [{ side: 'Over', price: 130, bookmaker: 'Book B', updatedAt: '2026-10-20T12:00:00Z' }] });
    const tickets = buildSuggestedTickets([candidate(), sameGame, sameGameThird]);
    expect(tickets.map(ticket => ticket.id)).toEqual(['single', 'double']);
    expect(tickets[1].selections.every(leg => leg.gameId === 'event-1')).toBe(true);
  });

  it('builds a multiple from the best quote at each sportsbook even when no book is shared', () => {
    const second = candidate({
      id: 'event-2:Player B:player_assists:5.5', gameId: 'event-2', player: 'Player B',
      bestOver: { side: 'Over', price: 120, bookmaker: 'Book B', updatedAt: '2026-10-20T12:00:00Z' },
      quotes: [{ side: 'Over', price: 120, bookmaker: 'Book B', updatedAt: '2026-10-20T12:00:00Z' }],
    });
    const third = candidate({ id: 'event-3:Player C:player_rebounds:8.5', gameId: 'event-3', player: 'Player C' });
    const tickets = buildSuggestedTickets([candidate(), second, third]);
    expect(tickets.map(ticket => ticket.id)).toEqual(['single', 'double']);
    const double = tickets.find(ticket => ticket.id === 'double')!;
    expect(double.selections.map(leg => leg.quote.bookmaker)).toEqual(['Book B', 'Book A']);
    expect(double.bookmaker).toBe('Casas variadas');
    expect(double.combinedDecimalOdds).toBeCloseTo((1 + 100 / 110) * 2.2);
  });

  it('adds an exaggerated six-pick ticket only when six different players qualify', () => {
    const six = Array.from({ length: 9 }, (_, index) => candidate({
      id: `event-${index + 1}:Player ${index + 1}`,
      gameId: 'same-event',
      player: `Player ${index + 1}`,
      expectedValue: 0.2 - index * 0.01,
    }));
    const tickets = buildSuggestedTickets(six);
    const exaggerated = tickets.find(ticket => ticket.id === 'exaggerated');
    expect(exaggerated?.selections).toHaveLength(6);
    expect(exaggerated?.estimatedProbability).toBeNull();
    expect(exaggerated?.warning?.toLowerCase()).toContain('alto risco');
    expect(new Set(exaggerated?.selections.map(leg => leg.gameId)).size).toBe(1);
    const ticketSelectionIds = tickets.flatMap(ticket => ticket.selections.map(leg => leg.id));
    expect(new Set(ticketSelectionIds).size).toBe(ticketSelectionIds.length);
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
