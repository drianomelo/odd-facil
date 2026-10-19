import { describe, expect, it } from 'vitest';
import { analyzePlayerProp, isSyntheticPickemBook, PlayerGameLog, resolvePlayerOpponent } from './player-props';

describe('resolvePlayerOpponent', () => {
  it('uses the player team to select the actual opponent independent of home or away', () => {
    expect(resolvePlayerOpponent('Boston Celtics', 'Boston Celtics', 'Miami Heat')).toBe('Miami Heat');
    expect(resolvePlayerOpponent('Miami Heat', 'Boston Celtics', 'Miami Heat')).toBe('Boston Celtics');
  });

  it('does not guess when the player team is missing or unrelated to the event', () => {
    expect(resolvePlayerOpponent(null, 'Boston Celtics', 'Miami Heat')).toBeUndefined();
    expect(resolvePlayerOpponent('Los Angeles Lakers', 'Boston Celtics', 'Miami Heat')).toBeUndefined();
  });

  it('recognizes synthetic pick-em prices that must not be treated as sportsbook odds', () => {
    expect(isSyntheticPickemBook('prizepicks', 'PrizePicks')).toBe(true);
    expect(isSyntheticPickemBook('draftkings_pick6', 'DraftKings Pick6')).toBe(true);
    expect(isSyntheticPickemBook('dabble', 'Dabble')).toBe(true);
    expect(isSyntheticPickemBook('sleeper', 'Sleeper')).toBe(true);
    expect(isSyntheticPickemBook('parlayplay', 'ParlayPlay')).toBe(true);
    expect(isSyntheticPickemBook('draftkings', 'DraftKings')).toBe(false);
  });
});

describe('analyzePlayerProp matchup validation', () => {
  const makeLogs = (playerTeam?: string): PlayerGameLog[] => Array.from({ length: 8 }, (_, index) => ({
    commence_time: new Date(Date.UTC(2026, 9, 1 + index)).toISOString(),
    player_team: playerTeam,
    opponent: index < 2 ? 'Miami Heat' : 'Other Team',
    status: 'final',
    stats: { points: index < 2 ? 30 : 20, minutes: 34 },
  }));
  const input = (logs: PlayerGameLog[]) => ({
    gameId: 'game-1',
    game: 'Miami Heat @ Boston Celtics',
    commenceTime: '2026-10-20T23:00:00Z',
    player: 'Example Player',
    market: 'player_points' as const,
    line: 25.5,
    logs,
    quotes: [],
    homeTeam: 'Boston Celtics',
    awayTeam: 'Miami Heat',
  });

  it('uses only verified H2H logs against the opponent selected from player team', () => {
    const candidate = analyzePlayerProp(input(makeLogs('Boston Celtics')));
    expect(candidate?.team).toBe('Boston Celtics');
    expect(candidate?.homeTeam).toBe('Boston Celtics');
    expect(candidate?.awayTeam).toBe('Miami Heat');
    expect(candidate?.opponent).toBe('Miami Heat');
    expect(candidate?.teamVerified).toBe(true);
    expect(candidate?.opponentAverage).toBe(30);
  });

  it('adds free market role and teammate injury context to the analysis', () => {
    const candidate = analyzePlayerProp({
      ...input(makeLogs('Boston Celtics')),
      teammatePointsLines: [
        { player: 'Example Player', line: 25.5 },
        { player: 'Scoring Teammate', line: 30.5 },
        { player: 'Another Teammate', line: 18.5 },
      ],
      injuryReportAvailable: true,
      injuryReportPlayers: [{
        playerName: 'Scoring Teammate',
        team: 'Boston Celtics',
        status: 'Questionable',
        statusCode: 'questionable',
      }],
    });

    expect(candidate?.contextNotes).toEqual(expect.arrayContaining([
      expect.stringContaining('2º entre 3 jogadores'),
      expect.stringContaining('Scoring Teammate (Questionable)'),
    ]));
  });

  it('drops a player prop entirely when the player team cannot be verified for the event', () => {
    const candidate = analyzePlayerProp(input(makeLogs()));
    expect(candidate).toBeNull();
  });

  it('drops props when the latest player team is outside the scheduled matchup', () => {
    const candidate = analyzePlayerProp(input(makeLogs('Philadelphia 76ers')));
    expect(candidate).toBeNull();
  });
});
