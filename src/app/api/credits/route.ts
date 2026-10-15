import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creditUsage } from '@/lib/db/schema';
import { desc, gte, sql } from 'drizzle-orm';

export async function GET() {
  const limit = parseInt(process.env.MONTHLY_CREDIT_LIMIT || '400', 10);
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  try {
    const [totals, latest] = await Promise.all([
      db.select({ used: sql<number>`coalesce(sum(${creditUsage.credits_used}), 0)` })
        .from(creditUsage)
        .where(gte(creditUsage.date, startOfMonth)),
      db.select({ remaining: creditUsage.remaining })
        .from(creditUsage)
        .orderBy(desc(creditUsage.date))
        .limit(1),
    ]);

    const used = Number(totals[0]?.used || 0);
    return NextResponse.json({ used, remaining: latest[0]?.remaining ?? Math.max(limit - used, 0), limit });
  } catch (error) {
    console.error('[API/credits] Error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar os créditos' }, { status: 500 });
  }
}
