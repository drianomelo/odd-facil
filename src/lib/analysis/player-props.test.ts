import { describe, expect, it } from 'vitest';
import { analyzePlayerProp, deduplicatePlayerPropCandidates, isSyntheticPickemBook, PlayerGameLog, PlayerPropCandidate, resolvePlayerOpponent, selectDailyPlayerPropShortlist } from './player-props';

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

  it('excludes this game and later games from the historical sample', () => {
    const logs = [
      ...makeLogs('Boston Celtics'),
      {
        commence_time: '2026-10-21T23:00:00Z',
        player_team: 'Boston Celtics',
        opponent: 'Miami Heat',
        status: 'final',
        stats: { points: 1000, minutes: 40 },
      },
    ];
    const candidate = analyzePlayerProp(input(logs));
    expect(candidate?.sampleSize).toBe(8);
    expect(candidate?.projection).toBeLessThan(100);
  });

  it('uses last-season data as a baseline while current-season sample is small', () => {
    const logs = [
      ...makeLogs('Boston Celtics'),
      ...[21, 22].map(day => ({
        commence_time: `2026-10-${day}T23:00:00Z`,
        player_team: 'Boston Celtics',
        opponent: 'Other Team',
        status: 'final',
        stats: { points: 40, minutes: 34 },
      })),
    ];
    const candidate = analyzePlayerProp({
      ...input(logs),
      commenceTime: '2026-10-25T23:00:00Z',
    });
    expect(candidate?.reasons.join(' ')).toContain('Temporada atual: 2 jogos; histórico anterior: 8 jogos');
    expect(candidate?.projection).toBeGreaterThan(20);
    expect(candidate?.projection).toBeLessThan(40);
  });
});

describe('deduplicatePlayerPropCandidates', () => {
  const candidate = (overrides: Partial<PlayerPropCandidate> = {}): PlayerPropCandidate => ({
    id: 'pick-1',
    gameId: 'game-1',
    game: 'Oklahoma City Thunder @ San Antonio Spurs',
    commenceTime: '2026-10-21T23:00:00Z',
    player: 'Julian Champagnie',
    market: 'player_points',
    line: 9.5,
    projection: 10,
    probabilityOver: 0.58,
    probabilityUnder: 0.42,
    quotes: [],
    edge: 0.08,
    expectedValue: 0.1,
    recommendationSide: 'Over',
    sampleSize: 15,
    shortlistEligible: true,
    last5Average: 10,
    last10Average: 10,
    last20Average: 10,
    teamVerified: true,
    confidence: 'moderada',
    reasons: [],
    limitations: [],
    ...overrides,
  });

  it('keeps only the strongest line for the same player, market, and game', () => {
    const weakerLine = candidate({ id: 'line-8-5', line: 8.5, edge: 0.03, expectedValue: 0.05 });
    const strongerLine = candidate({ id: 'line-9-5', line: 9.5, edge: 0.12, expectedValue: 0.08 });

    expect(deduplicatePlayerPropCandidates([weakerLine, strongerLine])).toEqual([strongerLine]);
  });

  it('keeps the same player in different markets and games', () => {
    const rebounds = candidate({ id: 'rebounds', market: 'player_rebounds' });
    const nextGame = candidate({ id: 'next-game', gameId: 'game-2' });

    expect(deduplicatePlayerPropCandidates([candidate(), rebounds, nextGame])).toHaveLength(3);
  });

  it('normalizes player names before checking duplicates', () => {
    const accented = candidate({ player: 'Julián Champagnie', id: 'accented', edge: 0.04 });
    const plain = candidate({ player: 'Julian Champagnie', id: 'plain', edge: 0.1 });

    expect(deduplicatePlayerPropCandidates([accented, plain])).toEqual([plain]);
  });

  it('keeps at most two strongest picks per game and spreads them across players', () => {
    const picks = selectDailyPlayerPropShortlist([
      candidate({ id: 'a-points', player: 'Player A', expectedValue: 0.12 }),
      candidate({ id: 'a-rebounds', player: 'Player A', market: 'player_rebounds', expectedValue: 0.11 }),
      candidate({ id: 'b-points', player: 'Player B', expectedValue: 0.1 }),
      candidate({ id: 'c-points', player: 'Player C', gameId: 'game-2' }),
    ]);
    expect(picks.map(pick => pick.id)).toEqual(['a-points', 'b-points', 'c-points']);
  });
});
