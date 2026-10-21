import { NextRequest } from 'next/server';
import { getPlayerGameLogs } from '@/lib/api/propline';
import { runPlayerPropGrading } from '@/lib/api/grade-player-props-cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Grading must read the latest final box score, independently of the longer
  // cache used by the live analysis screen.
  return runPlayerPropGrading(request, (player, limit) => getPlayerGameLogs(player, limit, 0));
}
