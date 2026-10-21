import { describe, expect, it } from 'vitest';
import { getGradeablePlayerPropUpdates, gradePlayerProp, isFinalPlayerGame, isTestPlayerPropForecast } from './player-prop-grading';

describe('gradePlayerProp', () => {
  it('wins Over when the stat finishes above the saved line', () => {
    expect(gradePlayerProp('Over', 24.5, 25)).toBe('won');
  });

  it('wins Under when the stat finishes below the saved line', () => {
    expect(gradePlayerProp('Under', 24.5, 24)).toBe('won');
  });

  it('marks an exact line as a push', () => {
    expect(gradePlayerProp('Over', 25, 25)).toBe('push');
    expect(gradePlayerProp('Under', 25, 25)).toBe('push');
  });

  it('marks unavailable or invalid stats as void', () => {
    expect(gradePlayerProp('Over', 24.5, undefined)).toBe('void');
    expect(gradePlayerProp('Over', 24.5, Number.NaN)).toBe('void');
  });
});

describe('isFinalPlayerGame', () => {
  it('accepts final logs and feeds that omit a status field', () => {
    expect(isFinalPlayerGame('final')).toBe(true);
    expect(isFinalPlayerGame(' Final ')).toBe(true);
    expect(isFinalPlayerGame(undefined)).toBe(true);
    expect(isFinalPlayerGame(null)).toBe(true);
    expect(isFinalPlayerGame('')).toBe(true);
  });

  it('does not grade games that are not final', () => {
    expect(isFinalPlayerGame('scheduled')).toBe(false);
    expect(isFinalPlayerGame('in_progress')).toBe(false);
    expect(isFinalPlayerGame('live')).toBe(false);
  });
});

describe('isTestPlayerPropForecast', () => {
  it('recognizes test fixtures so the cron can never grade them', () => {
    expect(isTestPlayerPropForecast('test', {})).toBe(true);
    expect(isTestPlayerPropForecast('player-props-v0.5.0', { test: true })).toBe(true);
    expect(isTestPlayerPropForecast('player-props-v0.5.0', '{"test":true}')).toBe(true);
    expect(isTestPlayerPropForecast('player-props-v0.5.0', { test: false })).toBe(false);
  });
});


describe('getGradeablePlayerPropUpdates', () => {
  const forecasts = [
    { id: 'over', eventId: 'game-1', market: 'player_points', line: 24.5, selection: 'Over' as const },
    { id: 'under', eventId: 'game-1', market: 'player_rebounds', line: 8.5, selection: 'Under' as const },
    { id: 'push', eventId: 'game-1', market: 'player_assists', line: 5, selection: 'Over' as const },
    { id: 'scheduled', eventId: 'game-2', market: 'player_points', line: 10, selection: 'Over' as const },
    { id: 'missing-stat', eventId: 'game-1', market: 'player_threes', line: 2.5, selection: 'Over' as const },
    { id: 'missing-event', eventId: 'game-3', market: 'player_points', line: 10, selection: 'Over' as const },
  ];

  it('grades only final logs matched to the same event and maps every NBA market correctly', () => {
    const updates = getGradeablePlayerPropUpdates(forecasts, [
      {
        event_id: 'game-1',
        status: 'final',
        stats: { points: '25', rebounds: 8, assists: 5, threes: null },
      },
      { event_id: 'game-2', status: 'in_progress', stats: { points: 99 } },
    ]);

    expect(updates).toEqual([
      { id: 'over', actual: 25, result: 'won' },
      { id: 'under', actual: 8, result: 'won' },
      { id: 'push', actual: 5, result: 'push' },
      { id: 'missing-stat', actual: undefined, result: 'void' },
    ]);
  });

  it('grades combined PRA from the feed stat field', () => {
    expect(getGradeablePlayerPropUpdates([
      { id: 'pra', eventId: 'game-1', market: 'player_points_rebounds_assists', line: 35.5, selection: 'Over' },
    ], [{ event_id: 'game-1', status: 'final', stats: { points_rebounds_assists: 36 } }]))
      .toEqual([{ id: 'pra', actual: 36, result: 'won' }]);
  });

  it('does not create updates for non-final games or events without matching logs', () => {
    expect(getGradeablePlayerPropUpdates(forecasts.slice(3, 5), [
      { event_id: 'game-2', status: 'scheduled', stats: { points: 50 } },
    ])).toEqual([]);
  });
});
