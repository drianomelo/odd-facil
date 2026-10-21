import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { seasonPlayerPicks } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const MODEL_VERSION = 'season-average-v2';

export async function GET(request: NextRequest) {
  try {
    const seasonStart = process.env.NBA_REGULAR_SEASON_START || '2026-10-20';
    const year = Number(seasonStart.slice(0, 4));
    const season = `${year}-${String(year + 1).slice(-2)}`;
    const [rows, archivedCount] = await Promise.all([
      db.select().from(seasonPlayerPicks).where(and(
        eq(seasonPlayerPicks.season, season),
        eq(seasonPlayerPicks.model_version, MODEL_VERSION),
      )).orderBy(desc(seasonPlayerPicks.commence_time), desc(seasonPlayerPicks.recorded_at)),
      db.select({ total: count() }).from(seasonPlayerPicks).where(and(
        eq(seasonPlayerPicks.season, season),
        ne(seasonPlayerPicks.model_version, MODEL_VERSION),
      )),
    ]);
    const params = request.nextUrl.searchParams;
    const market = params.get('market');
    const result = params.get('result') || 'all';
    const from = params.get('from');
    const to = params.get('to');
    const filtered = rows.filter(row =>
      (!market || row.market === market) &&
      (result === 'all' || (result === 'pending' ? !row.result : row.result === result)) &&
      (!from || row.commence_time.toISOString().slice(0, 10) >= from) &&
      (!to || row.commence_time.toISOString().slice(0, 10) <= to)
    );
    const counts = (items: typeof rows) => ({
      total: items.length,
      pending: items.filter(row => !row.result).length,
      won: items.filter(row => row.result === 'won').length,
      lost: items.filter(row => row.result === 'lost').length,
      push: items.filter(row => row.result === 'push').length,
      void: items.filter(row => row.result === 'void').length,
    });
    const summary = counts(filtered);
    const markets = Array.from(new Set(rows.map(row => row.market))).sort().map(key => ({ market: key, ...counts(rows.filter(row => row.market === key)) }));
    return NextResponse.json({ season, summary, markets, picks: filtered, archivedCount: Number(archivedCount[0]?.total || 0) });
  } catch (error) {
    console.error('Falha ao carregar histórico de sinais da temporada:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os sinais da temporada.' }, { status: 500 });
  }
}
