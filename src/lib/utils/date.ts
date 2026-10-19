// @ts-ignore
import { formatInTimeZone, toZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { format, parseISO, isBefore, differenceInHours } from 'date-fns';

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Bahia';

export function toAppTimeZone(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(d, APP_TIMEZONE);
}

export function fromAppTimeZone(date: Date): Date {
  return zonedTimeToUtc(date, APP_TIMEZONE);
}

/** Upcoming player props for today and tomorrow, plus games through 06:00 the following day. */
export function getPlayerPropAnalysisWindow(now = new Date()): { from: Date; to: Date } {
  const today = formatInTimeZone(now, APP_TIMEZONE, 'yyyy-MM-dd');
  const finalDayDate = new Date(`${today}T00:00:00.000Z`);
  finalDayDate.setUTCDate(finalDayDate.getUTCDate() + 2);
  const finalDay = finalDayDate.toISOString().slice(0, 10);
  return {
    from: now,
    to: fromAppTimeZone(new Date(`${finalDay}T06:00:00`)),
  };
}

export function formatAppDate(date: Date | string, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, APP_TIMEZONE, pattern);
}

export function formatAppTime(date: Date | string, pattern = 'HH:mm'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, APP_TIMEZONE, pattern);
}

export function formatAppDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, APP_TIMEZONE, 'dd/MM/yyyy HH:mm');
}

export function getFreshness(collectedAt: string, maxAgeHours: number): 'current' | 'stale' | 'unavailable' {
  const collected = parseISO(collectedAt);
  const now = new Date();
  const ageHours = differenceInHours(now, collected);
  
  if (ageHours <= maxAgeHours) return 'current';
  if (ageHours <= maxAgeHours * 2) return 'stale';
  return 'unavailable';
}

export function isGameStarted(commenceTime: string): boolean {
  const commence = parseISO(commenceTime);
  return isBefore(commence, new Date());
}

export function getNextCronTime(cronSchedule: string): Date {
  // Simple parser for "0 11 * * *" format (minute hour day month weekday)
  const [minute, hour] = cronSchedule.split(' ').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);
  
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  
  return next;
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'agora mesmo';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;
  return formatAppDateTime(d);
}
