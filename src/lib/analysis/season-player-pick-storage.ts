import 'server-only';
import { and, count, eq, gte, inArray, lt } from 'drizzle-orm';
import { Game } from '@/types';
import { db } from '@/lib/db';
import { playerGameStats, playerPropTicketLegs, playerPropTickets, seasonPlayerPicks } from '@/lib/db/schema';
import { buildSeasonPlayerPicks, SeasonPickMarket } from './season-player-picks';
import { BETBY_PLAYER_PROP_MARKETS } from './player-props';

export const SEASON_PLAYER_PICK_MODEL_VERSION = 'season-average-v4-betby-rotation';
const MARKETS: SeasonPickMarket[] = [
  ...BETBY_PLAYER_PROP_MARKETS,
];

function seasonFor(start: string) {
  const year = Number(start.slice(0, 4));
  return `${year}-${String(year + 1).slice(-2)}`;
}

function normalizeTeam(value: string) {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === 'losangelesclippers' ? 'laclippers' : normalized;
}

export async function getAndStoreSeasonPlayerPicks(input: {
  games: Game[];
  from: Date;
  to: Date;
}) {
  const fixtures = input.games.filter(game => game.status === 'scheduled')
    .flatMap(game => {
      const commenceTime = new Date(game.commence_time);
      if (!Number.isFinite(commenceTime.getTime()) || commenceTime < input.from || commenceTime >= input.to) return [];
      return [{
        id: game.id,
        commenceTime,
        homeTeam: game.home_team.name,
        awayTeam: game.away_team.name,
      }];
    });
  const seasonStart = process.env.NBA_REGULAR_SEASON_START || '2026-10-20';
  const season = seasonFor(seasonStart);
  const eventIds = fixtures.map(fixture => fixture.id);

  const [logs, manualRows] = await Promise.all([
    db.select().from(playerGameStats).where(and(
      eq(playerGameStats.season, season),
      gte(playerGameStats.game_date, new Date(`${seasonStart}T00:00:00.000Z`)),
      lt(playerGameStats.game_date, input.to),
    )),
    db.select({ market: playerPropTicketLegs.market, result: playerPropTicketLegs.result })
      .from(playerPropTicketLegs)
      .innerJoin(playerPropTickets, eq(playerPropTicketLegs.ticket_id, playerPropTickets.id))
      .where(and(
        eq(playerPropTickets.source, 'manual'),
        gte(playerPropTicketLegs.commence_time, new Date(`${seasonStart}T00:00:00.000Z`)),
      )),
  ]);

  const personalByMarket = Object.fromEntries(MARKETS.map(market => {
    const rows = manualRows.filter(row => row.market === market);
    const wins = rows.filter(row => row.result === 'won').length;
    const losses = rows.filter(row => row.result === 'lost').length;
    return [market, { wins, losses, total: wins + losses }];
  })) as Record<SeasonPickMarket, { wins: number; losses: number; total: number }>;

  const picks = buildSeasonPlayerPicks({ games: fixtures, logs, personalByMarket, markets: MARKETS });
  const fixtureById = new Map(fixtures.map(fixture => [fixture.id, fixture]));
  const rows = picks.flatMap(pick => {
    const fixture = fixtureById.get(pick.gameId);
    if (!fixture) return [];
    const opponentTeam = normalizeTeam(pick.team) === normalizeTeam(fixture.homeTeam) ? fixture.awayTeam : fixture.homeTeam;
    return [{
      season,
      event_id: pick.gameId,
      player_id: pick.playerId,
      player_name: pick.player,
      player_team: pick.team,
      opponent_team: opponentTeam,
      game: pick.game,
      market: pick.market,
      line: pick.line.toFixed(1),
      selection: pick.side,
      projection: pick.seasonAverage.toFixed(2),
      sample_size: pick.sampleSize,
      observed_hits: pick.hits,
      observed_rate: pick.observedRate.toFixed(4),
      model_version: SEASON_PLAYER_PICK_MODEL_VERSION,
      commence_time: new Date(pick.commenceTime),
      details: {
        last5Average: pick.last5Average,
        game: pick.game,
        personalRecord: pick.personalRecord,
      },
    }];
  });

  const inserted = rows.length
    ? await db.insert(seasonPlayerPicks).values(rows).onConflictDoNothing().returning({ id: seasonPlayerPicks.id })
    : [];
  const tracked = eventIds.length
    ? await db.select({ total: count() }).from(seasonPlayerPicks).where(and(
        eq(seasonPlayerPicks.model_version, SEASON_PLAYER_PICK_MODEL_VERSION),
        inArray(seasonPlayerPicks.event_id, eventIds),
      ))
    : [{ total: 0 }];

  return {
    season,
    picks,
    gamesInWindow: fixtures.length,
    gamesWithEligibleTeams: new Set(picks.map(pick => pick.gameId)).size,
    eligiblePlayers: new Set(picks.map(pick => pick.playerId)).size,
    excludedScheduledGames: fixtures.length - new Set(picks.map(pick => pick.gameId)).size,
    savedNow: inserted.length,
    trackedCount: Number(tracked[0]?.total || 0),
    note: 'A direção compara a média dos últimos 5 jogos com a amostra anterior para evitar o viés de “Menos de” causado pela média em estatísticas assimétricas. Sinais limitados aos 8 jogadores com maior média de minutos recentes por time e a pelo menos 10 minutos por jogo; mercados limitados a Pontos, Rebotes, Assistências e Cestas de 3. São sinais estatísticos, não odds ou linhas da Betby.',
  };
}
