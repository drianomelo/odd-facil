import { describe, expect, it } from 'vitest';
import { buildSeasonPlayerPicks, SeasonPickMarket } from './season-player-picks';

const personalByMarket = Object.fromEntries(([
  'player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists',
] as SeasonPickMarket[]).map(market => [market, { wins: 1, losses: 1, total: 2 }])) as Record<SeasonPickMarket, { wins: number; losses: number; total: number }>;

const row = (overrides: Record<string, unknown> = {}) => ({
  event_id: 'past-1',
  game_date: new Date('2026-10-20T23:00:00Z'),
  player_id: 'player-1',
  player_name: 'Player One',
  team: 'Boston Celtics',
  opponent: 'New York Knicks',
  played: true,
  minutes: 25,
  points: 20,
  rebounds: 5,
  assists: 4,
  threes: 2,
  ...overrides,
});

describe('buildSeasonPlayerPicks', () => {
  it('uses only current season logs before the fixture and annotates actual season frequency', () => {
    const picks = buildSeasonPlayerPicks({
      games: [{ id: 'future', commenceTime: new Date('2026-10-22T23:00:00Z'), homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks' }],
      logs: [
        row(),
        row({ event_id: 'past-2', game_date: new Date('2026-10-21T23:00:00Z'), points: 22, rebounds: 6, assists: 5, threes: 3 }),
        row({ event_id: 'too-late', game_date: new Date('2026-10-23T00:00:00Z'), points: 99 }),
      ],
      personalByMarket,
      now: new Date('2026-10-21T00:00:00Z'),
    });

    const points = picks.find(pick => pick.market === 'player_points');
    expect(points).toMatchObject({
      player: 'Player One',
      line: 21.5,
      side: 'Over',
      seasonAverage: 21,
      hits: 1,
      sampleSize: 2,
      observedRate: 0.5,
      personalRecord: { wins: 1, losses: 1, total: 2 },
    });
  });

  it('omits teams without current-season appearances and spreads the game picks across markets', () => {
    const picks = buildSeasonPlayerPicks({
      games: [
        { id: 'with-base', commenceTime: new Date('2026-10-22T23:00:00Z'), homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks' },
        { id: 'without-base', commenceTime: new Date('2026-10-22T23:00:00Z'), homeTeam: 'Utah Jazz', awayTeam: 'Portland Trail Blazers' },
      ],
      logs: [row(), row({ event_id: 'past-2', game_date: new Date('2026-10-21T23:00:00Z'), points: 22, rebounds: 6, assists: 5, threes: 3 })],
      personalByMarket,
      now: new Date('2026-10-21T00:00:00Z'),
    });

    expect(picks).toHaveLength(5);
    expect(picks.every(pick => pick.gameId === 'with-base')).toBe(true);
    expect(new Set(picks.map(pick => pick.market)).size).toBe(5);
    expect(new Set(picks.map(pick => pick.playerId))).toEqual(new Set(['player-1']));
    expect(picks.every(pick => pick.side === 'Over')).toBe(true);
  });

  it('omits falling trends and weak Over frequencies instead of suggesting Under', () => {
    const game = { id: 'future', commenceTime: new Date('2026-10-25T23:00:00Z'), homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks' };
    const base = [
      row({ points: 10 }),
      row({ event_id: 'past-2', game_date: new Date('2026-10-21T23:00:00Z'), points: 8 }),
    ];
    const falling = buildSeasonPlayerPicks({ games: [game], logs: base, personalByMarket, markets: ['player_points'], now: new Date('2026-10-24T00:00:00Z') });
    expect(falling).toEqual([]);

    const weak = buildSeasonPlayerPicks({
      games: [game],
      logs: [
        row({ points: 8 }),
        row({ event_id: 'past-2', game_date: new Date('2026-10-21T23:00:00Z'), points: 9 }),
        row({ event_id: 'past-3', game_date: new Date('2026-10-22T23:00:00Z'), points: 10 }),
      ],
      personalByMarket,
      markets: ['player_points'],
      now: new Date('2026-10-24T00:00:00Z'),
    });
    expect(weak).toEqual([]);
  });

  it('does not create picks for a player without an appearance or for a started fixture', () => {
    const upcoming = { id: 'upcoming', commenceTime: new Date('2026-10-22T23:00:00Z'), homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks' };
    const noAppearance = buildSeasonPlayerPicks({ games: [upcoming], logs: [row({ played: false })], personalByMarket, now: new Date('2026-10-21T00:00:00Z') });
    const started = buildSeasonPlayerPicks({ games: [upcoming], logs: [row()], personalByMarket, now: new Date('2026-10-23T00:00:00Z') });
    expect(noAppearance).toEqual([]);
    expect(started).toEqual([]);
    const singleAppearance = buildSeasonPlayerPicks({ games: [upcoming], logs: [row()], personalByMarket, now: new Date('2026-10-21T00:00:00Z') });
    expect(singleAppearance).toEqual([]);
  });
});
