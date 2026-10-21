import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local', quiet: true });

const API_ROOT = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
};

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find(value => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function appDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} deve estar no formato YYYY-MM-DD.`);
  }
}

function seasonFor(date) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function minutes(value) {
  const raw = String(value ?? '').trim();
  const clock = raw.match(/^(\d+):(\d{1,2})$/);
  if (clock) return number(clock[1]) + number(clock[2]) / 60;
  const iso = raw.match(/^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (iso) return number(iso[1]) + number(iso[2]) / 60;
  return number(raw);
}

function made(value) {
  if (typeof value === 'number') return value;
  const match = String(value ?? '').match(/^(\d+)/);
  return match ? number(match[1]) : 0;
}

function normalize(value) {
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === 'losangelesclippers' ? 'laclippers' : normalized;
}

function seasonPickActual(market, row) {
  if (!row.played) return undefined;
  switch (market) {
    case 'player_points': return row.points;
    case 'player_rebounds': return row.rebounds;
    case 'player_assists': return row.assists;
    case 'player_threes': return row.threes;
    case 'player_points_rebounds_assists': return row.points + row.rebounds + row.assists;
    default: return undefined;
  }
}

function gradeSeasonPick(selection, line, actual) {
  if (actual === undefined) return 'void';
  if (actual === line) return 'push';
  return (actual > line ? 'Over' : 'Under') === selection ? 'won' : 'lost';
}

async function fetchJson(url, label) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  return response.json();
}

function finalEvent(event) {
  return event.status?.type?.completed === true;
}

function extractPlayers(summary, event, season) {
  const competitors = summary.header?.competitions?.[0]?.competitors
    || event.competitions?.[0]?.competitors
    || [];
  const boxscoreTeams = summary.boxscore?.players || [];
  const rows = [];
  const sourceUrl = `https://www.espn.com/nba/boxscore/_/gameId/${event.id}`;

  for (const teamEntry of boxscoreTeams) {
    const teamInfo = teamEntry.team || {};
    const teamName = String(teamInfo.displayName || teamInfo.name || teamInfo.abbreviation || '').trim();
    if (!teamName) continue;

    const ownCompetitor = competitors.find(competitor => {
      const team = competitor.team || {};
      return [team.id, team.abbreviation, team.displayName, team.name]
        .map(normalize).filter(Boolean)
        .some(value => [teamInfo.id, teamInfo.abbreviation, teamInfo.displayName, teamInfo.name]
          .map(normalize).filter(Boolean).includes(value));
    });
    const opponent = competitors.find(competitor => competitor !== ownCompetitor)?.team || {};
    const opponentName = String(opponent.displayName || opponent.name || opponent.abbreviation || 'Unknown').trim();

    const statGroup = (teamEntry.statistics || []).find(group =>
      (group.labels || group.keys || []).some(label => ['pts', 'points'].includes(String(label).toLowerCase()))
      && Array.isArray(group.athletes),
    );
    if (!statGroup) continue;
    const labels = statGroup.labels || statGroup.keys || [];

    for (const row of statGroup.athletes || []) {
      const athlete = row.athlete || {};
      const name = String(athlete.displayName || athlete.fullName || athlete.name || '').trim();
      if (!name) continue;
      const values = row.stats || [];
      const stat = (...keys) => {
        const index = labels.findIndex(label => keys.includes(String(label).toLowerCase()));
        return index >= 0 ? values[index] : undefined;
      };
      const playerMinutes = minutes(stat('min', 'minutes'));
      const playerId = String(athlete.id || `${normalize(name)}-${normalize(teamName)}`);
      rows.push({
        season,
        eventId: String(event.id),
        gameDate: new Date(event.date),
        playerId,
        playerName: name,
        team: teamName,
        opponent: opponentName,
        minutes: playerMinutes.toFixed(2),
        played: playerMinutes > 0,
        points: Math.round(number(stat('pts', 'points'))),
        rebounds: Math.round(number(stat('reb', 'rebounds', 'totalrebounds'))),
        assists: Math.round(number(stat('ast', 'assists'))),
        threes: made(stat('3pt', '3pm', 'threepointfieldgoalsmade')),
        source: 'espn-public',
        sourceUrl,
      });
    }
  }

  if (!rows.length) throw new Error(`ESPN não retornou linhas de jogadores para o jogo ${event.id}.`);
  return rows;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não está definida em .env.local.');
  const seasonStart = process.env.NBA_REGULAR_SEASON_START || '2026-10-20';
  const today = appDate();
  const defaultTo = `${today.year}-${today.month}-${today.day}`;
  const from = arg('from') || seasonStart;
  const to = arg('to') || defaultTo;
  assertDate(from, '--from');
  assertDate(to, '--to');
  if (from < seasonStart) throw new Error(`A importação começa em ${seasonStart}, início configurado da temporada regular.`);
  if (from > to) throw new Error('--from não pode ser posterior a --to.');

  const season = seasonFor(from);
  const dates = [];
  for (let cursor = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10).replaceAll('-', ''));
  }

  const eventsById = new Map();
  for (const date of dates) {
    const body = await fetchJson(`${API_ROOT}/scoreboard?dates=${date}`, `ESPN scoreboard ${date}`);
    for (const event of body.events || []) if (finalEvent(event)) eventsById.set(String(event.id), event);
  }

  const events = [...eventsById.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!events.length) {
    console.log(`Nenhum jogo final encontrado entre ${from} e ${to}. Nenhum dado foi alterado.`);
    return;
  }

  const playerRows = [];
  for (const event of events) {
    const summary = await fetchJson(`${API_ROOT}/summary?event=${encodeURIComponent(event.id)}`, `ESPN summary ${event.id}`);
    playerRows.push(...extractPlayers(summary, event, season));
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10, prepare: false });
  let seasonPicksGraded = 0;
  let seasonPicksVoided = 0;
  let manualTicketLegsGraded = 0;
  let manualTicketLegsVoided = 0;
  try {
    await sql.begin(async transaction => {
      for (const row of playerRows) {
        await transaction`
          insert into player_game_stats (
            season, event_id, game_date, player_id, player_name, team, opponent,
            minutes, played, points, rebounds, assists, threes, source, source_url, imported_at
          ) values (
            ${row.season}, ${row.eventId}, ${row.gameDate}, ${row.playerId}, ${row.playerName}, ${row.team}, ${row.opponent},
            ${row.minutes}, ${row.played}, ${row.points}, ${row.rebounds}, ${row.assists}, ${row.threes}, ${row.source}, ${row.sourceUrl}, now()
          )
          on conflict (event_id, player_id) do update set
            season = excluded.season,
            game_date = excluded.game_date,
            player_name = excluded.player_name,
            team = excluded.team,
            opponent = excluded.opponent,
            minutes = excluded.minutes,
            played = excluded.played,
            points = excluded.points,
            rebounds = excluded.rebounds,
            assists = excluded.assists,
            threes = excluded.threes,
            source = excluded.source,
            source_url = excluded.source_url,
            imported_at = now()
        `;
      }

      const pendingPicks = await transaction`
        select id, player_id, player_team, opponent_team, market, line, selection, commence_time
        from season_player_picks
        where season = ${season} and result is null and commence_time < now()
      `;
      for (const pick of pendingPicks) {
        const matchingRow = playerRows
          .filter(row => row.playerId === pick.player_id
            && normalize(row.team) === normalize(pick.player_team)
            && normalize(row.opponent) === normalize(pick.opponent_team)
            && Math.abs(row.gameDate.getTime() - new Date(pick.commence_time).getTime()) <= 12 * 60 * 60 * 1000)
          .sort((a, b) => Math.abs(a.gameDate.getTime() - new Date(pick.commence_time).getTime())
            - Math.abs(b.gameDate.getTime() - new Date(pick.commence_time).getTime()))[0];
        if (!matchingRow) continue;
        const actual = seasonPickActual(pick.market, matchingRow);
        const result = gradeSeasonPick(pick.selection, Number(pick.line), actual);
        const updated = await transaction`
          update season_player_picks
          set actual_value = ${actual ?? null}, result = ${result}, graded_at = now()
          where id = ${pick.id} and result is null
          returning id
        `;
        if (updated.length) {
          if (result === 'void') seasonPicksVoided++;
          else seasonPicksGraded++;
        }
      }

      const pendingManualLegs = await transaction`
        select leg.id, leg.player_name, leg.player_team, leg.opponent_team, leg.market, leg.line, leg.selection, leg.commence_time
        from player_prop_ticket_legs leg
        inner join player_prop_tickets ticket on ticket.id = leg.ticket_id
        where ticket.source = 'manual' and leg.result is null and leg.commence_time < now()
      `;
      for (const leg of pendingManualLegs) {
        const matchingRow = playerRows
          .filter(row => normalize(row.playerName) === normalize(leg.player_name)
            && normalize(row.team) === normalize(leg.player_team)
            && normalize(row.opponent) === normalize(leg.opponent_team)
            && Math.abs(row.gameDate.getTime() - new Date(leg.commence_time).getTime()) <= 12 * 60 * 60 * 1000)
          .sort((a, b) => Math.abs(a.gameDate.getTime() - new Date(leg.commence_time).getTime())
            - Math.abs(b.gameDate.getTime() - new Date(leg.commence_time).getTime()))[0];
        if (!matchingRow) continue;
        const actual = seasonPickActual(leg.market, matchingRow);
        const result = gradeSeasonPick(leg.selection, Number(leg.line), actual);
        const updated = await transaction`
          update player_prop_ticket_legs
          set actual_value = ${actual ?? null}, result = ${result}, graded_at = now()
          where id = ${leg.id} and result is null
          returning id
        `;
        if (updated.length) {
          if (result === 'void') manualTicketLegsVoided++;
          else manualTicketLegsGraded++;
        }
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(`Temporada: ${season}`);
  console.log(`Período consultado: ${from} a ${to}`);
  console.log(`Jogos finais importados/atualizados: ${events.length}`);
  console.log(`Linhas de atletas importadas/atualizadas: ${playerRows.length}`);
  console.log(`Previsões da temporada apuradas: ${seasonPicksGraded} (${seasonPicksVoided} anuladas por DNP)`);
  console.log(`Seleções de bilhetes pessoais apuradas: ${manualTicketLegsGraded} (${manualTicketLegsVoided} anuladas por DNP)`);
  console.log('Fonte: placares e boxscores públicos da ESPN; nenhuma chave paga é usada.');
}

main().catch(error => {
  console.error(`Falha ao importar estatísticas da temporada: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
