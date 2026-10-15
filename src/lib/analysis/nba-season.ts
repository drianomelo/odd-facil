export type NbaSeasonPhase = 'preseason' | 'regular';

export const NBA_REGULAR_SEASON_START = process.env.NBA_REGULAR_SEASON_START || '2026-10-20';

export function getNbaSeasonPhase(commenceTime: Date | string): NbaSeasonPhase {
  const date = commenceTime instanceof Date ? commenceTime : new Date(commenceTime);
  if (Number.isNaN(date.getTime())) return 'preseason';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const easternGameDate = `${values.year}-${values.month}-${values.day}`;
  return easternGameDate < NBA_REGULAR_SEASON_START ? 'preseason' : 'regular';
}
