import { NextResponse } from 'next/server';
import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { playerGameStats, playerPropTicketLegs, playerPropTickets } from '@/lib/db/schema';
import { BETBY_PLAYER_PROP_MARKETS } from '@/lib/analysis/player-props';

export const dynamic = 'force-dynamic';

const MARKETS = BETBY_PLAYER_PROP_MARKETS;

function currentSeason(start: string) {
  const year = Number(start.slice(0, 4));
  return `${year}-${String(year + 1).slice(-2)}`;
}

export async function GET() {
  try {
    const seasonStart = process.env.NBA_REGULAR_SEASON_START || '2026-10-20';
    const season = currentSeason(seasonStart);
    const allGameRows = await db.select().from(playerGameStats)
      .where(eq(playerGameStats.season, season));
    const playedRows = allGameRows.filter(row => row.played)
      .sort((a, b) => b.game_date.getTime() - a.game_date.getTime());

    const byPlayer = new Map<string, typeof playedRows>();
    for (const row of playedRows) {
      const existing = byPlayer.get(row.player_id) || [];
      existing.push(row);
      byPlayer.set(row.player_id, existing);
    }
    const players = Array.from(byPlayer.entries()).map(([playerId, games]) => {
      const average = (key: 'points' | 'rebounds' | 'assists' | 'threes' | 'minutes', sample: typeof games) =>
        sample.reduce((sum, game) => sum + Number(game[key]), 0) / Math.max(sample.length, 1);
      const latest = games[0];
      const recent = games.slice(0, 5);
      return {
        playerId,
        player: latest.player_name,
        team: latest.team,
        games: games.length,
        minutes: average('minutes', games),
        points: average('points', games),
        rebounds: average('rebounds', games),
        assists: average('assists', games),
        threes: average('threes', games),
        pra: average('points', games) + average('rebounds', games) + average('assists', games),
        last5: {
          games: recent.length,
          points: average('points', recent),
          rebounds: average('rebounds', recent),
          assists: average('assists', recent),
          threes: average('threes', recent),
          pra: average('points', recent) + average('rebounds', recent) + average('assists', recent),
        },
      };
    }).sort((a, b) => b.games - a.games || b.points - a.points || a.player.localeCompare(b.player, 'pt-BR'));

    const manualPicks = await db.select({
      market: playerPropTicketLegs.market,
      result: playerPropTicketLegs.result,
      commenceTime: playerPropTicketLegs.commence_time,
    }).from(playerPropTicketLegs)
      .innerJoin(playerPropTickets, eq(playerPropTicketLegs.ticket_id, playerPropTickets.id))
      .where(and(
        eq(playerPropTickets.source, 'manual'),
        gte(playerPropTicketLegs.commence_time, new Date(`${seasonStart}T00:00:00.000Z`)),
      ));

    const picksByMarket = MARKETS.map(market => {
      const picks = manualPicks.filter(pick => pick.market === market);
      const wins = picks.filter(pick => pick.result === 'won').length;
      const losses = picks.filter(pick => pick.result === 'lost').length;
      const pushes = picks.filter(pick => pick.result === 'push').length;
      const voids = picks.filter(pick => pick.result === 'void').length;
      const pending = picks.filter(pick => !pick.result).length;
      const decided = wins + losses;
      return { market, total: picks.length, wins, losses, pushes, voids, pending, accuracy: decided ? wins / decided : null };
    });

    return NextResponse.json({
      season,
      gameCount: new Set(allGameRows.map(row => row.event_id)).size,
      teamsCount: new Set(allGameRows.map(row => row.team)).size,
      playerAppearances: playedRows.length,
      playerCount: players.length,
      manualPicks: manualPicks.length,
      picksByMarket,
      players,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API/analysis/nba/season-base] Load failed:', error);
    return NextResponse.json({ error: 'Não foi possível montar a base da temporada.' }, { status: 500 });
  }
}
