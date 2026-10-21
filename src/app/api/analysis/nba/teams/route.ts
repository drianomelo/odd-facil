import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { playerPropForecasts, playerPropTicketLegs, playerPropTickets } from '@/lib/db/schema';
import { PLAYER_PROP_MODEL_VERSION } from '@/lib/analysis/player-prop-storage';
import { NBA_REGULAR_SEASON_START } from '@/lib/analysis/nba-season';
import { getNbaSeasonPhase } from '@/lib/analysis/nba-season';
import { getTicketOutcome } from '@/lib/analysis/ticket-result';
import { NBA_PREDICTIONS_ENABLED } from '@/lib/analysis/prediction-controls';

export const dynamic = 'force-dynamic';

type OutcomeCounts = { total: number; settled: number; wins: number; losses: number; pushes: number; voids: number; pending: number };

function emptyCounts(): OutcomeCounts {
  return { total: 0, settled: 0, wins: 0, losses: 0, pushes: 0, voids: 0, pending: 0 };
}

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const NBA_TEAM_NAMES = [
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
  'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons',
  'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers', 'LA Clippers',
  'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks',
  'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
  'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns',
  'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors',
  'Utah Jazz', 'Washington Wizards',
];

const TEAM_ALIASES: Record<string, string> = {
  losangelesclippers: 'LA Clippers',
  lac: 'LA Clippers',
  sixers: 'Philadelphia 76ers',
  phi: 'Philadelphia 76ers',
  atl: 'Atlanta Hawks', bos: 'Boston Celtics', bkn: 'Brooklyn Nets', cha: 'Charlotte Hornets',
  chi: 'Chicago Bulls', cle: 'Cleveland Cavaliers', dal: 'Dallas Mavericks', den: 'Denver Nuggets',
  det: 'Detroit Pistons', gsw: 'Golden State Warriors', hou: 'Houston Rockets', ind: 'Indiana Pacers',
  lal: 'Los Angeles Lakers', mem: 'Memphis Grizzlies', mia: 'Miami Heat', mil: 'Milwaukee Bucks',
  min: 'Minnesota Timberwolves', nop: 'New Orleans Pelicans', nyk: 'New York Knicks',
  okc: 'Oklahoma City Thunder', orl: 'Orlando Magic', phx: 'Phoenix Suns', por: 'Portland Trail Blazers',
  sac: 'Sacramento Kings', sas: 'San Antonio Spurs', tor: 'Toronto Raptors', uta: 'Utah Jazz', was: 'Washington Wizards',
};

function canonicalTeam(value: string): string {
  const key = normalized(value);
  return TEAM_ALIASES[key] || NBA_TEAM_NAMES.find(name => normalized(name) === key) || value;
}

function recordOutcome(counts: OutcomeCounts, outcome: string | null) {
  counts.total += 1;
  if (outcome === 'won') counts.wins += 1;
  else if (outcome === 'lost') counts.losses += 1;
  else if (outcome === 'push/void' || outcome === 'push') counts.pushes += 1;
  else if (outcome === 'void') counts.voids += 1;
  else counts.pending += 1;
  if (outcome && outcome !== 'pending') counts.settled += 1;
}

function hitRate(counts: OutcomeCounts): number | null {
  const decided = counts.wins + counts.losses;
  return decided ? counts.wins / decided : null;
}

function withRate<T extends OutcomeCounts>(counts: T) {
  return { ...counts, hitRate: hitRate(counts) };
}

export async function GET(request: NextRequest) {
  try {
    const requestedTeam = request.nextUrl.searchParams.get('team');
    const regularOnly = sql`(${playerPropForecasts.commence_time} at time zone 'America/New_York')::date >= ${NBA_REGULAR_SEASON_START}::date`;

    const [forecastRows, tickets, legRows] = await Promise.all([
      db.select({
        team: playerPropForecasts.player_team,
        player: playerPropForecasts.player_name,
        total: count(),
        pending: sql<number>`count(*) filter (where ${playerPropForecasts.result} is null)`,
        wins: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'won')`,
        losses: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'lost')`,
        pushes: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'push')`,
        voids: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'void')`,
      }).from(playerPropForecasts).where(and(
        eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION),
        isNotNull(playerPropForecasts.player_team),
        regularOnly,
        ...(!NBA_PREDICTIONS_ENABLED ? [lte(playerPropForecasts.commence_time, new Date())] : []),
      )).groupBy(playerPropForecasts.player_team, playerPropForecasts.player_name),
      db.select({ id: playerPropTickets.id, manualOutcome: playerPropTickets.manual_outcome })
        .from(playerPropTickets).orderBy(desc(playerPropTickets.created_at)),
      db.select({
        ticketId: playerPropTicketLegs.ticket_id,
        team: playerPropTicketLegs.player_team,
        player: playerPropTicketLegs.player_name,
        result: playerPropForecasts.result,
        commenceTime: playerPropForecasts.commence_time,
      }).from(playerPropTicketLegs)
        .leftJoin(playerPropForecasts, eq(playerPropTicketLegs.forecast_id, playerPropForecasts.id)),
    ]);

    const ticketById = new Map(tickets.map(ticket => [ticket.id, ticket]));
    const legsByTicket = new Map<string, typeof legRows>();
    for (const leg of legRows) legsByTicket.set(leg.ticketId, [...(legsByTicket.get(leg.ticketId) || []), leg]);
    const personalByTeamPlayer = new Map<string, OutcomeCounts>();
    const personalByTeam = new Map<string, OutcomeCounts>();
    legsByTicket.forEach((ticketLegs, ticketId) => {
      const ticket = ticketById.get(ticketId);
      if (!ticket || ticketLegs.some(leg => !leg.commenceTime || getNbaSeasonPhase(leg.commenceTime) !== 'regular')) return;
      const outcome = ticket.manualOutcome || getTicketOutcome(ticketLegs.map(leg => leg.result));
      const teamPlayers = new Map<string, Set<string>>();
      for (const leg of ticketLegs) {
        if (!leg.team || !leg.player) continue;
        const team = canonicalTeam(leg.team);
        const players = teamPlayers.get(team) || new Set<string>();
        players.add(leg.player);
        teamPlayers.set(team, players);
      }
      teamPlayers.forEach((players, team) => {
        const teamCounts = personalByTeam.get(team) || emptyCounts();
        recordOutcome(teamCounts, outcome);
        personalByTeam.set(team, teamCounts);
        players.forEach(player => {
          const key = `${team}\u0000${player}`;
          const counts = personalByTeamPlayer.get(key) || emptyCounts();
          recordOutcome(counts, outcome);
          personalByTeamPlayer.set(key, counts);
        });
      });
    });

    const teamNames = new Set<string>(NBA_TEAM_NAMES);
    forecastRows.forEach(row => { if (row.team) teamNames.add(canonicalTeam(row.team)); });
    personalByTeam.forEach((_, team) => teamNames.add(team));

    const teams = Array.from(teamNames).sort((a, b) => a.localeCompare(b)).map(team => {
      const players = new Set<string>();
      forecastRows.filter(row => row.team && canonicalTeam(row.team) === team).forEach(row => players.add(row.player));
      personalByTeamPlayer.forEach((_, key) => { const [playerTeam, player] = key.split('\u0000'); if (playerTeam === team) players.add(player); });
      const model = forecastRows.filter(row => row.team && canonicalTeam(row.team) === team).reduce((counts, row) => {
        counts.total += Number(row.total); counts.pending += Number(row.pending); counts.wins += Number(row.wins);
        counts.losses += Number(row.losses); counts.pushes += Number(row.pushes); counts.voids += Number(row.voids);
        counts.settled += Number(row.total) - Number(row.pending);
        return counts;
      }, emptyCounts());
      return {
        name: team,
        slug: normalized(team),
        players: players.size,
        predictions: withRate(model),
        personalTickets: withRate(personalByTeam.get(team) || emptyCounts()),
      };
    });

    if (!requestedTeam) return NextResponse.json({ teams });
    const selected = teams.find(team => team.slug === normalized(canonicalTeam(requestedTeam)));
    if (!selected) return NextResponse.json({ error: 'Time não encontrado.' }, { status: 404 });
    const players = Array.from(new Set([
      ...forecastRows.filter(row => row.team && canonicalTeam(row.team) === selected.name).map(row => row.player),
      ...Array.from(personalByTeamPlayer.keys()).flatMap(key => {
        const [team, player] = key.split('\u0000');
        return team === selected.name ? [player] : [];
      }),
    ])).sort((a, b) => a.localeCompare(b)).map(player => ({
      player,
      predictions: withRate(forecastRows.filter(row => row.team && canonicalTeam(row.team) === selected.name && row.player === player).reduce((counts, row) => {
        counts.total += Number(row.total); counts.pending += Number(row.pending); counts.wins += Number(row.wins);
        counts.losses += Number(row.losses); counts.pushes += Number(row.pushes); counts.voids += Number(row.voids);
        counts.settled += Number(row.total) - Number(row.pending);
        return counts;
      }, emptyCounts())),
      personalTickets: withRate(personalByTeamPlayer.get(`${selected.name}\u0000${player}`) || emptyCounts()),
    }));
    return NextResponse.json({ team: selected, players });
  } catch (error) {
    console.error('[API/analysis/nba/teams] Failed:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os resultados por time.' }, { status: 500 });
  }
}
