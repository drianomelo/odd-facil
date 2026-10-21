import fs from 'node:fs/promises';
import path from 'node:path';

const REPORT_PATH = path.join(process.cwd(), 'data-backtests', 'opening-slate-2026-10-20.json');
const OUTPUT_PATH = path.join(process.cwd(), 'data-backtests', 'opening-slate-official-validation.json');
const GAMES = [
  { id: '0022600001', reportId: '129643', teams: ['BOS', 'DET'], espnTeams: [['BOS', 'Boston Celtics'], ['DET', 'Detroit Pistons']], url: 'https://www.nba.com/game/bos-vs-det-0022600001/box-score' },
  { id: '0022600002', reportId: '129635', teams: ['PHI', 'NYK'], espnTeams: [['PHI', 'Philadelphia 76ers', '76ers'], ['NY', 'NYK', 'New York Knicks', 'Knicks']], url: 'https://www.nba.com/game/phi-vs-nyk-0022600002/box-score' },
  { id: '0022600003', reportId: '129636', teams: ['OKC', 'SAS'], espnTeams: [['OKC', 'Oklahoma City Thunder', 'Thunder'], ['SA', 'SAS', 'San Antonio Spurs', 'Spurs']], url: 'https://www.nba.com/game/okc-vs-sas-0022600003/box-score' },
];
const CDN_URL = id => `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json`;
const ESPN_SCOREBOARD_URL = date => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`;
const ESPN_SUMMARY_URL = eventId => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`;
const requestHeaders = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
};
let scoreboardCache;

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorDetail(error) {
  if (!(error instanceof Error)) return String(error);
  const causeCode = error.cause && typeof error.cause === 'object' && 'code' in error.cause
    ? ` (${String(error.cause.code)})`
    : '';
  return `${error.message}${causeCode}`;
}

function minutes(value) {
  if (typeof value === 'number') return value;
  const raw = String(value || '');
  const iso = raw.match(/PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (iso) return number(iso[1]) + number(iso[2]) / 60;
  const clock = raw.match(/^(\d+):(\d{1,2})$/);
  if (clock) return number(clock[1]) + number(clock[2]) / 60;
  return 0;
}

function madeValue(value) {
  if (typeof value === 'number') return value;
  const match = String(value || '').match(/^(\d+)/);
  return match ? number(match[1]) : 0;
}

function espnPlayers(teamEntry) {
  const teamName = String(teamEntry.team?.displayName || teamEntry.team?.name || teamEntry.team?.abbreviation || '');
  const results = [];
  for (const group of teamEntry.statistics || []) {
    const labels = group.labels || group.keys || [];
    for (const statRow of group.athletes || []) {
      const values = statRow.stats || [];
      const valueAt = (...names) => {
        const index = labels.findIndex(label => names.includes(String(label).toLowerCase()));
        return index >= 0 ? values[index] : undefined;
      };
      const athlete = statRow.athlete || {};
      const name = athlete.displayName || athlete.fullName || athlete.name;
      if (!name) continue;
      const min = minutes(valueAt('min', 'minutes'));
      const points = number(valueAt('pts', 'points'));
      const rebounds = number(valueAt('reb', 'rebounds', 'totalrebounds'));
      const assists = number(valueAt('ast', 'assists'));
      const threes = madeValue(valueAt('3pt', '3pm', 'threepointfieldgoalsmade'));
      results.push({
        playerId: String(athlete.id || ''),
        player: String(name).trim(),
        team: teamName,
        played: min > 0,
        minutes: min,
        points,
        rebounds,
        assists,
        threes,
        pra: points + rebounds + assists,
      });
    }
  }
  return results;
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: requestHeaders,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  return response.json();
}

async function getEspnEvent(game) {
  if (!scoreboardCache) {
    scoreboardCache = Promise.all(['20261020', '20261021'].map(date => fetchJson(ESPN_SCOREBOARD_URL(date), `ESPN scoreboard ${date}`)))
      .then(bodies => bodies.flatMap(body => body.events || []));
  }
  const events = await scoreboardCache;
  return events.find(event => {
    const competitors = event.competitions?.[0]?.competitors || [];
    const namesAndCodes = competitors.map(team => [
      team.team?.abbreviation,
      team.team?.displayName,
      team.team?.name,
      team.team?.shortDisplayName,
    ].map(normalized).filter(Boolean));
    return game.espnTeams.every(aliases => namesAndCodes.some(values => values.some(value =>
      aliases.some(alias => normalized(alias) === value),
    )));
  });
}

async function fetchEspnBoxscore(game) {
  const event = await getEspnEvent(game);
  if (!event) throw new Error(`ESPN não encontrou a partida ${game.teams.join('-')}.`);
  const summary = await fetchJson(ESPN_SUMMARY_URL(event.id), `ESPN summary ${event.id}`);
  const boxscore = summary.boxscore;
  if (!boxscore?.players?.length) throw new Error(`ESPN não retornou estatísticas de jogadores para ${game.id}.`);
  const competitors = summary.header?.competitions?.[0]?.competitors || event.competitions?.[0]?.competitors || [];
  const players = boxscore.players.flatMap(teamEntry => espnPlayers(teamEntry));
  const findTeam = aliases => competitors.find(team => {
    const values = [team.team?.abbreviation, team.team?.displayName, team.team?.name, team.team?.shortDisplayName]
      .map(normalized).filter(Boolean);
    return values.some(value => aliases.some(alias => normalized(alias) === value));
  });
  const away = findTeam(game.espnTeams[0]);
  const home = findTeam(game.espnTeams[1]);
  const status = summary.header?.competitions?.[0]?.status || event.status;
  return {
    gameId: game.id,
    gameStatus: status?.type?.completed ? 3 : 1,
    gameStatusText: String(status?.type?.shortDetail || status?.type?.description || ''),
    gameDateTimeUTC: String(event.date || ''),
    away: { team: away?.team?.displayName || game.teams[0], abbreviation: game.teams[0], score: number(away?.score) },
    home: { team: home?.team?.displayName || game.teams[1], abbreviation: game.teams[1], score: number(home?.score) },
    source: `https://www.espn.com/nba/boxscore/_/gameId/${event.id}`,
    dataProvider: 'ESPN public game summary',
    players,
  };
}

function playerRow(player, team) {
  const stats = player.statistics || {};
  const played = player.played === true || minutes(stats.minutes) > 0;
  const points = number(stats.points);
  const rebounds = number(stats.reboundsTotal ?? stats.rebounds);
  const assists = number(stats.assists);
  const threes = number(stats.threePointersMade ?? stats.threes);
  return {
    playerId: String(player.personId || ''),
    player: String(player.name || '').trim(),
    team,
    played,
    minutes: minutes(stats.minutes),
    points,
    rebounds,
    assists,
    threes,
    pra: points + rebounds + assists,
  };
}

function marketActual(player, market) {
  return {
    player_points: player.points,
    player_rebounds: player.rebounds,
    player_assists: player.assists,
    player_threes: player.threes,
    player_points_rebounds_assists: player.pra,
  }[market];
}

function settle(pick, actual) {
  if (!actual.played) return 'void';
  if (actual.value === pick.line) return 'push';
  if (pick.selection === 'Over') return actual.value > pick.line ? 'won' : 'lost';
  return actual.value < pick.line ? 'won' : 'lost';
}

async function fetchBoxscore(game) {
  try {
    const payload = await fetchJson(CDN_URL(game.id), `Boxscore NBA ${game.id}`);
    const data = payload?.game;
    if (!data || String(data.gameId) !== game.id) throw new Error(`Resposta incompleta para o jogo ${game.id}.`);
    const teams = [data.awayTeam, data.homeTeam];
    const players = teams.flatMap(team => (team.players || []).map(player => playerRow(
      player,
      String(team.teamName || team.teamTricode || ''),
    ))).filter(player => player.player);
    return {
      gameId: game.id,
      gameStatus: Number(data.gameStatus),
      gameStatusText: String(data.gameStatusText || ''),
      gameDateTimeUTC: String(data.gameTimeUTC || ''),
      away: {
        team: String(data.awayTeam.teamName || data.awayTeam.teamTricode || ''),
        abbreviation: String(data.awayTeam.teamTricode || ''),
        score: number(data.awayTeam.score),
      },
      home: {
        team: String(data.homeTeam.teamName || data.homeTeam.teamTricode || ''),
        abbreviation: String(data.homeTeam.teamTricode || ''),
        score: number(data.homeTeam.score),
      },
      source: game.url,
      dataProvider: 'NBA.com official live boxscore',
      players,
    };
  } catch (nbaError) {
    try {
      const fallback = await fetchEspnBoxscore(game);
      fallback.nbaSourceError = nbaError instanceof Error ? nbaError.message : String(nbaError);
      return fallback;
    } catch (espnError) {
      throw new Error(`NBA.com bloqueou o boxscore (${errorDetail(nbaError)}); fonte alternativa também falhou (${errorDetail(espnError)}).`);
    }
  }
}

const originalReport = JSON.parse(await fs.readFile(REPORT_PATH, 'utf8'));
if (!Array.isArray(originalReport.picks)) throw new Error('O relatório retrospectivo não tem a lista de palpites.');

const boxscores = await Promise.all(GAMES.map(fetchBoxscore));
const gameIndex = new Map(GAMES.map(game => [game.reportId, game]));
const playerIndexes = new Map(boxscores.map(boxscore => [boxscore.gameId, new Map(
  boxscore.players.map(player => [normalized(player.player), player]),
)]));

const auditedPicks = originalReport.picks.map(pick => {
  const game = gameIndex.get(String(pick.eventId));
  const player = game ? playerIndexes.get(game.id)?.get(normalized(pick.player)) : undefined;
  const value = player ? marketActual(player, pick.market) : undefined;
  const officialResult = player && Number.isFinite(value)
    ? settle(pick, { played: player.played, value })
    : 'missing';
  return {
    eventId: String(pick.eventId),
    gameId: game?.id || null,
    player: pick.player,
    market: pick.market,
    line: pick.line,
    selection: pick.selection,
    archivedActual: pick.actual,
    officialActual: value ?? null,
    played: player?.played ?? null,
    archivedGrade: pick.archivedGrade,
    officialGrade: officialResult,
    actualMatches: player ? Number(value) === Number(pick.actual) : false,
    gradeMatches: officialResult === pick.archivedGrade,
  };
});

const missingPlayers = auditedPicks.filter(row => row.officialGrade === 'missing');
const actualMismatches = auditedPicks.filter(row => row.officialGrade !== 'missing' && !row.actualMatches);
const gradeMismatches = auditedPicks.filter(row => row.officialGrade !== 'missing' && !row.gradeMatches);
const gamesComplete = boxscores.length === GAMES.length && boxscores.every(game => game.gameStatus === 3);
const verified = gamesComplete && missingPlayers.length === 0 && actualMismatches.length === 0 && gradeMismatches.length === 0;

const output = {
  title: 'Auditoria oficial · abertura NBA 20/10/2026',
  generatedAt: new Date().toISOString(),
  sourceReport: path.relative(process.cwd(), REPORT_PATH),
  officialSource: 'NBA.com; fallback gratuito para o boxscore público da ESPN. Sem chave paga.',
  verified,
  summary: {
    games: boxscores.length,
    gamesFinal: boxscores.filter(game => game.gameStatus === 3).length,
    playersInBoxscores: boxscores.reduce((total, game) => total + game.players.length, 0),
    propsChecked: auditedPicks.length,
    missingPlayers: missingPlayers.length,
    actualMismatches: actualMismatches.length,
    gradeMismatches: gradeMismatches.length,
  },
  games: boxscores,
  auditedPicks,
  discrepancies: { missingPlayers, actualMismatches, gradeMismatches },
};

await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Partidas finais: ${output.summary.gamesFinal}/${output.summary.games}`);
console.log(`Jogadores incluídos nas súmulas: ${output.summary.playersInBoxscores}`);
console.log(`Palpites conferidos: ${output.summary.propsChecked}`);
console.log(`Divergências de estatística: ${output.summary.actualMismatches}`);
console.log(`Divergências de apuração: ${output.summary.gradeMismatches}`);
console.log(`Jogadores não encontrados: ${output.summary.missingPlayers}`);
console.log(`Validação oficial: ${verified ? 'APROVADA' : 'PENDENTE — confira discrepancies no relatório'}`);
console.log(`Relatório: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
if (!verified) process.exitCode = 1;
