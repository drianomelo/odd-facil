import { NextRequest, NextResponse } from 'next/server';
import { getDailyPlayerAnalysis } from '@/lib/api/propline';
import { storeUpcomingPlayerPropForecasts } from '@/lib/analysis/player-prop-storage';

export const revalidate = 900;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromText = searchParams.get('from');
  const toText = searchParams.get('to');
  const from = fromText && !Number.isNaN(Date.parse(fromText)) ? new Date(fromText) : new Date();
  const to = toText && !Number.isNaN(Date.parse(toText))
    ? new Date(`${toText}T23:59:59.999Z`)
    : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const analysis = await getDailyPlayerAnalysis(from, to);
    let tracking = { enabled: false, saved: 0 };
    try {
      tracking = await storeUpcomingPlayerPropForecasts(analysis.recommendations);
    } catch (error) {
      console.error('[API/analysis/nba] Forecast storage failed:', error);
      tracking = { enabled: false, saved: 0 };
    }
    return NextResponse.json({ ...analysis, tracking });
  } catch (error) {
    console.error('[API/analysis/nba] Error:', error);
    return NextResponse.json({
      configured: Boolean(process.env.PROPLINE_API_KEY),
      source: 'PropLine · plano grátis',
      fetchedAt: new Date().toISOString(),
      analyzedPlayers: 0,
      recommendations: [],
      message: error instanceof Error ? error.message : 'Falha ao carregar os dados de jogadores.',
    }, { status: 502 });
  }
}
