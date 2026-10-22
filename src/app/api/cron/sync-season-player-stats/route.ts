import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' };

function normalize(value: unknown) {
  const name = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const withoutNameSuffix = name.replace(/(?:jr|sr|ii|iii|iv|v)$/, '');
  return withoutNameSuffix === 'losangelesclippers' ? 'laclippers' : withoutNameSuffix;
}

function appDate(offsetDays: number) {
  const date = new Date();
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const cursor = new Date(`${local}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + offsetDays);
  return cursor.toISOString().slice(0, 10);
}

function parseMinutes(value: unknown) {
  const raw = String(value ?? '').trim();
  const clock = raw.match(/^(\d+):(\d{1,2})$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
  const iso = raw.match(/^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (iso) return Number(iso[1] || 0) + Number(iso[2] || 0) / 60;
  return Number(raw) || 0;
}

async function json(url: string) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(`ESPN HTTP ${response.status}: ${url}`);
  return response.json();
}

function extractRows(summary: any, event: any, season: string) {
  const competitors = summary.header?.competitions?.[0]?.competitors || event.competitions?.[0]?.competitors || [];
  const rows: any[] = [];
  for (const entry of summary.boxscore?.players || []) {
    const team = entry.team || {};
    const teamName = team.displayName || team.name || team.abbreviation;
    const boxTeamKeys = [team.id, team.abbreviation, team.displayName, team.name].map(normalize).filter(Boolean);
    const own = competitors.find((c: any) => [c.team?.id, c.team?.abbreviation, c.team?.displayName, c.team?.name]
      .map(normalize).filter(Boolean).some((key: string) => boxTeamKeys.includes(key)));
    const opponent = competitors.find((c: any) => c !== own)?.team || {};
    const group = (entry.statistics || []).find((g: any) => (g.labels || g.keys || []).some((label: string) => ['pts', 'points'].includes(label.toLowerCase())) && Array.isArray(g.athletes));
    if (!group) continue;
    const labels = group.labels || group.keys || [];
    for (const item of group.athletes) {
      const athlete = item.athlete || {};
      const playerName = athlete.displayName || athlete.fullName || athlete.name;
      if (!playerName) continue;
      const stat = (...keys: string[]) => item.stats?.[labels.findIndex((label: string) => keys.includes(label.toLowerCase()))];
      const mins = parseMinutes(stat('min', 'minutes'));
      const threes = String(stat('3pt', '3pm', 'threepointfieldgoalsmade') ?? '').match(/^(\d+)/);
      rows.push({ season, eventId: String(event.id), gameDate: new Date(event.date), playerId: String(athlete.id || normalize(playerName)), playerName, team: teamName, opponent: opponent.displayName || opponent.name || opponent.abbreviation || '', minutes: mins.toFixed(2), played: mins > 0, points: Number(stat('pts', 'points')) || 0, rebounds: Number(stat('reb', 'rebounds', 'totalrebounds')) || 0, assists: Number(stat('ast', 'assists')) || 0, threes: Number(threes?.[1] || 0), sourceUrl: `https://www.espn.com/nba/boxscore/_/gameId/${event.id}` });
    }
  }
  if (!rows.length) throw new Error(`Boxscore sem atletas para ${event.id}`);
  return rows;
}

function actualFor(market: string, row: any): number | undefined {
  if (!row.played) return undefined;
  if (market === 'player_points') return row.points;
  if (market === 'player_rebounds') return row.rebounds;
  if (market === 'player_assists') return row.assists;
  if (market === 'player_threes') return row.threes;
  if (market === 'player_points_rebounds_assists') return row.points + row.rebounds + row.assists;
  return undefined;
}

function grade(selection: string, line: number, actual: number | undefined) {
  if (actual === undefined) return 'void';
  if (actual === line) return 'push';
  return ((actual > line ? 'Over' : 'Under') === selection) ? 'won' : 'lost';
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DATABASE_URL não configurada' }, { status: 500 });

  const seasonStart = process.env.NBA_REGULAR_SEASON_START || '2026-10-20';
  const dates = [-3, -2, -1, 0].map(appDate).filter(date => date >= seasonStart);
  const seasonYear = Number(seasonStart.slice(0, 4));
  const season = `${seasonYear}-${String(seasonYear + 1).slice(-2)}`;
  try {
    const events = new Map<string, any>();
    for (const date of dates) {
      const day = date.replaceAll('-', '');
      const board = await json(`${ESPN}/scoreboard?dates=${day}`);
      for (const event of board.events || []) if (event.status?.type?.completed) events.set(String(event.id), event);
    }
    const rows: any[] = [];
    for (const event of Array.from(events.values())) rows.push(...extractRows(await json(`${ESPN}/summary?event=${encodeURIComponent(event.id)}`), event, season));
    if (!rows.length) return NextResponse.json({ success: true, games: 0, rows: 0, manualLegsGraded: 0, message: 'Nenhum boxscore final nos últimos quatro dias.' });

    const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10, prepare: false });
    let manualLegsGraded = 0;
    let seasonPicksGraded = 0;
    try {
      await sql.begin(async tx => {
        for (const row of rows) await tx`
          insert into player_game_stats (season,event_id,game_date,player_id,player_name,team,opponent,minutes,played,points,rebounds,assists,threes,source,source_url,imported_at)
          values (${row.season},${row.eventId},${row.gameDate},${row.playerId},${row.playerName},${row.team},${row.opponent},${row.minutes},${row.played},${row.points},${row.rebounds},${row.assists},${row.threes},'espn-public',${row.sourceUrl},now())
          on conflict (event_id,player_id) do update set game_date=excluded.game_date,player_name=excluded.player_name,team=excluded.team,opponent=excluded.opponent,minutes=excluded.minutes,played=excluded.played,points=excluded.points,rebounds=excluded.rebounds,assists=excluded.assists,threes=excluded.threes,source=excluded.source,source_url=excluded.source_url,imported_at=now()`;

        const pending = await tx`select leg.id,leg.player_name,leg.player_team,leg.opponent_team,leg.market,leg.line,leg.selection,leg.commence_time from player_prop_ticket_legs leg join player_prop_tickets ticket on ticket.id=leg.ticket_id where ticket.source='manual' and leg.result is null and leg.commence_time < now()`;
        for (const leg of pending) {
          const row = rows.filter(item => normalize(item.playerName) === normalize(leg.player_name) && normalize(item.team) === normalize(leg.player_team) && normalize(item.opponent) === normalize(leg.opponent_team) && Math.abs(item.gameDate.getTime() - new Date(leg.commence_time).getTime()) <= 12 * 60 * 60 * 1000).sort((a,b) => Math.abs(a.gameDate.getTime()-new Date(leg.commence_time).getTime()) - Math.abs(b.gameDate.getTime()-new Date(leg.commence_time).getTime()))[0];
          if (!row) continue;
          const actual = actualFor(leg.market, row);
          const result = grade(leg.selection, Number(leg.line), actual);
          const updated = await tx`update player_prop_ticket_legs set actual_value=${actual ?? null},result=${result},graded_at=now() where id=${leg.id} and result is null returning id`;
          manualLegsGraded += updated.length;
        }
        const picks = await tx`select id,player_id,player_team,opponent_team,market,line,selection,commence_time from season_player_picks where season=${season} and result is null and commence_time < now()`;
        for (const pick of picks) {
          const row = rows.filter(item => item.playerId === pick.player_id && normalize(item.team) === normalize(pick.player_team) && normalize(item.opponent) === normalize(pick.opponent_team) && Math.abs(item.gameDate.getTime()-new Date(pick.commence_time).getTime()) <= 12*60*60*1000).sort((a,b) => Math.abs(a.gameDate.getTime()-new Date(pick.commence_time).getTime()) - Math.abs(b.gameDate.getTime()-new Date(pick.commence_time).getTime()))[0];
          if (!row) continue;
          const actual = actualFor(pick.market, row);
          const result = grade(pick.selection, Number(pick.line), actual);
          const updated = await tx`update season_player_picks set actual_value=${actual ?? null},result=${result},graded_at=now() where id=${pick.id} and result is null returning id`;
          seasonPicksGraded += updated.length;
        }
      });
    } finally { await sql.end({ timeout: 5 }); }
    return NextResponse.json({ success: true, dates, games: events.size, rows: rows.length, manualLegsGraded, seasonPicksGraded });
  } catch (error) {
    console.error('[sync-season-player-stats]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Falha ao sincronizar resultados' }, { status: 500 });
  }
}
