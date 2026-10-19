import { describe, expect, it } from 'vitest';
import { getPlayerPropAnalysisWindow } from './date';

describe('getPlayerPropAnalysisWindow', () => {
  it('keeps the full tomorrow and includes games through 06:00 two calendar days later in Bahia', () => {
    const now = new Date('2026-10-19T15:00:00.000Z');
    const window = getPlayerPropAnalysisWindow(now);

    expect(window.from).toEqual(now);
    expect(window.to.toISOString()).toBe('2026-10-21T09:00:00.000Z');
  });
});
