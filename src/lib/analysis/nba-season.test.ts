import { describe, expect, it } from 'vitest';
import { getNbaSeasonPhase } from './nba-season';

describe('getNbaSeasonPhase', () => {
  it('marks games before the configured first regular season game as preseason', () => {
    expect(getNbaSeasonPhase('2026-10-16T00:30:00Z')).toBe('preseason');
  });

  it('uses the NBA local game date around UTC midnight', () => {
    expect(getNbaSeasonPhase('2026-10-21T01:30:00Z')).toBe('regular');
  });
});
