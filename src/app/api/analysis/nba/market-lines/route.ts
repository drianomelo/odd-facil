import { NextResponse } from 'next/server';
import { getCurrentPlayerPropMarkets } from '@/lib/api/propline';

export const revalidate = 900;

export async function GET() {
  try {
    const marketLines = await getCurrentPlayerPropMarkets();
    return NextResponse.json({
      configured: Boolean(process.env.PROPLINE_API_KEY),
      marketLines,
      fetchedAt: new Date().toISOString(),
      message: marketLines.length ? undefined : process.env.PROPLINE_API_KEY
        ? 'A fonte ainda não retornou linhas de props para os próximos jogos.'
        : 'Configure PROPLINE_API_KEY para carregar as linhas atuais dos mercados.',
    });
  } catch (error) {
    console.error('[API/analysis/nba/market-lines] Load failed:', error);
    return NextResponse.json({
      configured: Boolean(process.env.PROPLINE_API_KEY),
      marketLines: [],
      error: error instanceof Error ? error.message : 'Não foi possível carregar linhas atuais.',
    }, { status: 502 });
  }
}
