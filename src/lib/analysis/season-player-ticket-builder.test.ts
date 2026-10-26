import { describe, expect, it } from 'vitest';
import { SeasonPlayerPick } from './season-player-picks';
import { buildSeasonSuggestedTickets } from './season-player-ticket-builder';

function pick(player: string, hits: number, sampleSize: number, market: SeasonPlayerPick['market'] = 'player_points'): SeasonPlayerPick {
  return {
    id: player, gameId: 'game', game: 'Away @ Home', commenceTime: '2026-10-22T00:00:00Z', playerId: player,
    player, team: 'Home', market, line: 10.5, side: 'Over', seasonAverage: 12,
    last5Average: 12, hits, sampleSize, observedRate: hits / sampleSize,
    personalRecord: { wins: 1, losses: 0, total: 1 },
  };
}

describe('buildSeasonSuggestedTickets', () => {
  it('builds only combinations supported by available signals', () => {
    expect(buildSeasonSuggestedTickets([pick('A', 1, 1)])).toHaveLength(1);
    expect(buildSeasonSuggestedTickets([pick('A', 1, 1), pick('B', 1, 1)])).toHaveLength(1);
    expect(buildSeasonSuggestedTickets(['A', 'B', 'C'].map(name => pick(name, 2, 3))).map(ticket => ticket.id)).toEqual(['single', 'double']);
  });

  it('builds the exaggerated bundle only with six different players', () => {
    const twoPerPlayer = [pick('A', 3, 4), pick('A', 2, 3), ...['B', 'C', 'D', 'E'].map(name => pick(name, 2, 3))];
    expect(buildSeasonSuggestedTickets(twoPerPlayer).some(ticket => ticket.id === 'exaggerated')).toBe(false);
    const sixPlayersAfterSingleAndDouble = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map(name => pick(name, 2, 3));
    const exaggerated = buildSeasonSuggestedTickets(sixPlayersAfterSingleAndDouble).find(ticket => ticket.id === 'exaggerated');
    expect(exaggerated?.picks).toHaveLength(6);
    expect(new Set(exaggerated?.picks.map(row => row.player)).size).toBe(6);
    expect(new Set(exaggerated?.picks.map(row => row.gameId)).size).toBe(1);
  });

  it('ranks sample-supported evidence above a perfect one-game signal', () => {
    const tickets = buildSeasonSuggestedTickets([pick('One Game', 1, 1), pick('Larger Sample', 7, 10)]);
    expect(tickets[0].picks[0].player).toBe('Larger Sample');
  });

  it('uses the user-recorded results for the same market as a limited ranking adjustment', () => {
    const points = { ...pick('Points', 5, 10), personalRecord: { wins: 0, losses: 10, total: 10 } };
    const rebounds = { ...pick('Rebounds', 5, 10, 'player_rebounds'), personalRecord: { wins: 10, losses: 0, total: 10 } };
    const tickets = buildSeasonSuggestedTickets([points, rebounds]);
    expect(tickets[0].picks[0].player).toBe('Rebounds');
  });

  it('does not repeat the same player and market across tickets, but allows another market for that player', () => {
    const rows = [pick('A', 4, 5), pick('A', 3, 5, 'player_rebounds'), ...['B', 'C'].map(name => pick(name, 3, 5))];
    const tickets = buildSeasonSuggestedTickets(rows);
    const keys = tickets.flatMap(ticket => ticket.picks.map(row => `${row.player}:${row.market}`));
    expect(new Set(keys).size).toBe(keys.length);
    expect(tickets.find(ticket => ticket.id === 'double')?.picks.some(row => row.player === 'A')).toBe(true);
  });

  it('does not include Under signals in suggested tickets', () => {
    const tickets = buildSeasonSuggestedTickets([
      { ...pick('Under', 9, 10), side: 'Under' },
      pick('Over', 6, 10),
    ]);
    expect(tickets).toHaveLength(1);
    expect(tickets[0].picks.map(row => row.player)).toEqual(['Over']);
  });
});
