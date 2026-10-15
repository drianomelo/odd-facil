import { NextRequest } from 'next/server';
import { getPlayerGameLogs } from '@/lib/api/propline';
import { runPlayerPropGrading } from '@/lib/api/grade-player-props-cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return runPlayerPropGrading(request, getPlayerGameLogs);
}
