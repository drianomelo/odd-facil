import { NextResponse } from 'next/server';
import { and, asc, eq, gt, gte, lt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { games, playerGameStats, teams } from '@/lib/db/schema';
import { getPlayerPropAnalysisWindow } from '@/lib/utils/date';
import { oddsApiClient } from '@/lib/api/odds-api';

export const dynamic = 'force-dynamic';

function seasonFromStart(start: string): string {
  const year = Number(start.slice(0, 4));
  return `${year}-${String(year + 1).slice(-2)}`;
}

export async function GET() {
  try {
    const seasonStart = process.env.NBA_REGULAR_SEASON_START || '2026-10-20';
    const season = seasonFromStart(seasonStart);
    const home = alias(teams, 'ticket_options_home');
    const away = alias(teams, 'ticket_options_away');
    const window = getPlayerPropAnalysisWindow();
    const [rows, scheduled, seasonRows] = await Promise.all([db.select({
      eventId: playerGameStats.event_id,
      gameDate: playerGameStats.game_date,
      playerId: playerGameStats.player_id,
      player: playerGameStats.player_name,
      team: playerGameStats.team,
      opponent: playerGameStats.opponent,
      played: playerGameStats.played,
    }).from(playerGameStats)
      .where(eq(playerGameStats.season, season))
      .orderBy(asc(playerGameStats.game_date), asc(playerGameStats.player_name)),
    db.select({
      eventId: games.external_id,
      gameDate: games.commence_time,
      homeTeam: home.name,
      awayTeam: away.name,
    }).from(games)
      .innerJoin(home, eq(games.home_team_id, home.id))
      .innerJoin(away, eq(games.away_team_id, away.id))
      .where(and(
        eq(games.league_id, 'NBA'),
        eq(games.status, 'scheduled'),
        gt(games.commence_time, new Date()),
        gte(games.commence_time, window.from),
        lt(games.commence_time, window.to),
      )).orderBy(asc(games.commence_time)),
    db.select({
      playerId: playerGameStats.player_id,
      player: playerGameStats.player_name,
      team: playerGameStats.team,
      played: playerGameStats.played,
      gameDate: playerGameStats.game_date,
    }).from(playerGameStats).where(eq(playerGameStats.season, season)).orderBy(asc(playerGameStats.game_date)),
    ]);
    const scheduledById = new Map(scheduled.map(game => [game.eventId, game]));
    try {
      const liveSchedule = await oddsApiClient.getNbaSchedule(window.from, window.to);
      for (const game of liveSchedule) {
        const eventId = game.id.replace(/^nba-/, '');
        if (!scheduledById.has(eventId)) scheduledById.set(eventId, {
          eventId,
          gameDate: new Date(game.commence_time),
          homeTeam: game.home_team.name,
          awayTeam: game.away_team.name,
        });
      }
    } catch (error) {
      console.warn('[API/analysis/nba/ticket-input-options] Live schedule unavailable:', error);
    }

    const byEvent = new Map<string, {
      eventId: string;
      gameDate: Date;
      teams: Set<string>;
      players: Map<string, { id: string; name: string; team: string; played: boolean }>;
    }>();
    for (const row of rows) {
      let game = byEvent.get(row.eventId);
      if (!game) {
        game = { eventId: row.eventId, gameDate: row.gameDate, teams: new Set(), players: new Map() };
        byEvent.set(row.eventId, game);
      }
      game.teams.add(row.team);
      game.teams.add(row.opponent);
      game.players.set(`${row.playerId}:${row.team}`, { id: row.playerId, name: row.player, team: row.team, played: row.played });
    }

    const historicalGames = Array.from(byEvent.values()).sort((a, b) => b.gameDate.getTime() - a.gameDate.getTime()).map(game => {
      const [firstTeam, secondTeam] = Array.from(game.teams);
      const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', year: 'numeric' }).format(game.gameDate);
      return {
        eventId: game.eventId,
        gameDate: game.gameDate.toISOString(),
        label: `${date} · ${firstTeam || 'Time'} x ${secondTeam || 'Adversário'} · Jogo finalizado`,
        isUpcoming: false,
        players: Array.from(game.players.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      };
    });

    const normalizeTeam = (value: string) => {
      const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalized === 'losangelesclippers' ? 'laclippers' : normalized;
    };
    const upcomingGames = Array.from(scheduledById.values()).map(game => {
      const teamKeys = new Set([normalizeTeam(game.homeTeam), normalizeTeam(game.awayTeam)]);
      const latestByPlayer = new Map<string, { id: string; name: string; team: string; played: boolean; gameDate: Date }>();
      for (const row of seasonRows) {
        if (!row.played || row.gameDate >= game.gameDate || !teamKeys.has(normalizeTeam(row.team))) continue;
        const key = `${row.playerId}:${normalizeTeam(row.team)}`;
        const previous = latestByPlayer.get(key);
        if (!previous || row.gameDate > previous.gameDate) {
          latestByPlayer.set(key, { id: row.playerId, name: row.player, team: row.team, played: true, gameDate: row.gameDate });
        }
      }
      const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', year: 'numeric' }).format(game.gameDate);
      return {
        eventId: game.eventId,
        gameDate: game.gameDate.toISOString(),
        label: `${date} · ${game.awayTeam} x ${game.homeTeam} · Próximo jogo`,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        isUpcoming: true,
        players: Array.from(latestByPlayer.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          .map(({ id, name, team, played }) => ({ id, name, team, played })),
      };
    });

    return NextResponse.json({ season, games: upcomingGames.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()) });
  } catch (error) {
    console.error('[API/analysis/nba/ticket-input-options] Load failed:', error);
    return NextResponse.json({ error: 'Não foi possível carregar jogos e jogadores da temporada.' }, { status: 500 });
  }
}
