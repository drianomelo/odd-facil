import fs from 'node:fs/promises';
import path from 'node:path';

const MODEL_VERSION = 'player-props-v0.5.0';
const EVENT_IDS = new Set(['129635', '129636', '129643']);
const BACKUP_DIR = path.join(process.cwd(), 'data-backups');
const OUTPUT_DIR = path.join(process.cwd(), 'data-backtests');

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDetails(row) {
  if (row.details && typeof row.details === 'object') return row.details;
  try { return JSON.parse(row.details || '{}'); } catch { return {}; }
}

function selectionHit(selection, line, actual) {
  if (actual === line) return 'push';
  if (selection === 'Over') return actual > line ? 'won' : 'lost';
  if (selection === 'Under') return actual < line ? 'won' : 'lost';
  return 'unknown';
}

function hasValidPregameQuotes(row) {
  const start = Date.parse(row.commence_time);
  const quotes = parseDetails(row).quotes;
  if (!Number.isFinite(start) || !Array.isArray(quotes)) return false;
  const sidesByBook = new Map();
  for (const quote of quotes) {
    const quoteTime = Date.parse(quote.updatedAt);
    if (!Number.isFinite(quoteTime) || quoteTime >= start) continue;
    const book = normalize(quote.bookmakerKey || quote.bookmaker);
    const sides = sidesByBook.get(book) || new Set();
    sides.add(quote.side);
    sidesByBook.set(book, sides);
  }
  return [...sidesByBook.values()].some(sides => sides.has('Over') && sides.has('Under'));
}

function newer(a, b) {
  return Date.parse(a.recorded_at) - Date.parse(b.recorded_at);
}

function betterLine(a, b) {
  return Number(b.shortlist_eligible) - Number(a.shortlist_eligible)
    || Number(b.expected_value || 0) - Number(a.expected_value || 0)
    || Number(b.predicted_probability || 0) - Number(a.predicted_probability || 0)
    || Number(b.sample_size || 0) - Number(a.sample_size || 0)
    || Number(a.line) - Number(b.line);
}

function gameLabel(row) {
  const game = parseDetails(row).game;
  return typeof game === 'string' && game ? game : `Partida ${row.event_id}`;
}

const backupFiles = (await fs.readdir(BACKUP_DIR))
  .filter(name => name.startsWith('prediction-data-') && name.endsWith('.json'))
  .sort();
if (!backupFiles.length) throw new Error('Nenhum backup encontrado em data-backups/.');

const backupPath = path.join(BACKUP_DIR, backupFiles.at(-1));
const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));
const rows = backup.tables?.player_prop_forecasts;
if (!Array.isArray(rows)) throw new Error('O backup não contém player_prop_forecasts.');

const eligible = rows.filter(row => EVENT_IDS.has(String(row.event_id))
  && row.model_version === MODEL_VERSION
  && Number.isFinite(Date.parse(row.commence_time))
  && Number.isFinite(Date.parse(row.recorded_at))
  && Date.parse(row.recorded_at) < Date.parse(row.commence_time)
  && hasValidPregameQuotes(row)
  && row.actual_value !== null && row.actual_value !== undefined
  && Number.isFinite(Number(row.projection))
  && Number.isFinite(Number(row.line))
  && Number.isFinite(Number(row.actual_value))
  && ['Over', 'Under'].includes(row.selection));

// Keep the latest snapshot available before tipoff for each offered line, then
// select one line per player/category using only pregame model fields.
const latestByOfferedLine = new Map();
for (const row of eligible) {
  const key = [row.event_id, normalize(row.player_name), row.market, row.line].join('|');
  const previous = latestByOfferedLine.get(key);
  if (!previous || newer(row, previous) > 0) latestByOfferedLine.set(key, row);
}

const onePerPlayerMarket = new Map();
for (const row of latestByOfferedLine.values()) {
  const key = [row.event_id, normalize(row.player_name), row.market].join('|');
  const previous = onePerPlayerMarket.get(key);
  if (!previous || betterLine(row, previous) < 0) onePerPlayerMarket.set(key, row);
}

const picks = [...onePerPlayerMarket.values()].map(row => {
  const actual = Number(row.actual_value);
  const line = Number(row.line);
  const result = selectionHit(row.selection, line, actual);
  // Recompute the categorical outcome from actual stat + selected line;
  // the backup's grading field is retained only for audit comparison.
  return {
    eventId: String(row.event_id),
    commenceTimeUtc: row.commence_time,
    gameDateEastern: row.event_id === '129636' ? '2026-10-20' : row.commence_time.slice(0, 10),
    game: gameLabel(row),
    player: row.player_name,
    playerTeam: row.player_team || null,
    market: row.market,
    selection: row.selection,
    line,
    projection: Number(row.projection),
    actual,
    projectionError: Number(row.projection) - actual,
    result,
    archivedGrade: row.result,
    gradeMatches: result === row.result,
    americanOdds: Number(row.american_odds),
    bookmaker: row.bookmaker,
    recordedAt: row.recorded_at,
    sampleSize: Number(row.sample_size),
    confidence: row.confidence,
    shortlistEligible: Boolean(row.shortlist_eligible),
  };
}).sort((a, b) => a.commenceTimeUtc.localeCompare(b.commenceTimeUtc)
  || a.game.localeCompare(b.game)
  || a.player.localeCompare(b.player)
  || a.market.localeCompare(b.market));

const games = [...new Set(picks.map(pick => pick.eventId))];
const graded = picks.filter(pick => pick.result === 'won' || pick.result === 'lost');
const wins = graded.filter(pick => pick.result === 'won').length;
const losses = graded.filter(pick => pick.result === 'lost').length;
const mae = picks.length ? picks.reduce((sum, pick) => sum + Math.abs(pick.projectionError), 0) / picks.length : null;
const bias = picks.length ? picks.reduce((sum, pick) => sum + pick.projectionError, 0) / picks.length : null;
const byMarket = Object.fromEntries([...new Set(picks.map(pick => pick.market))].sort().map(market => {
  const marketPicks = picks.filter(pick => pick.market === market);
  const marketGraded = marketPicks.filter(pick => pick.result === 'won' || pick.result === 'lost');
  const marketWins = marketGraded.filter(pick => pick.result === 'won').length;
  return [market, {
    picks: marketPicks.length,
    wins: marketWins,
    losses: marketGraded.length - marketWins,
    hitRate: marketGraded.length ? marketWins / marketGraded.length : null,
    projectionMae: marketPicks.reduce((sum, pick) => sum + Math.abs(pick.projectionError), 0) / marketPicks.length,
    projectionBias: marketPicks.reduce((sum, pick) => sum + pick.projectionError, 0) / marketPicks.length,
  }];
}));
const report = {
  title: 'Backtest retrospectivo isolado · abertura NBA 20/10/2026',
  createdAt: new Date().toISOString(),
  sourceBackup: path.relative(process.cwd(), backupPath),
  modelVersion: MODEL_VERSION,
  method: {
    cutoff: 'Somente previsões registradas e cotações pareadas Over/Under anteriores ao início do jogo.',
    deDuplication: 'Uma previsão por jogo, jogador e mercado. Escolhida entre linhas disponíveis usando elegibilidade, EV, probabilidade e tamanho de amostra; dados pós-jogo não participam da seleção.',
    actuals: 'Estatística real arquivada no registro da previsão; acerto/erro recalculado pela seleção e linha.',
    limits: 'Backtest pequeno e exploratório. As odds arquivadas não provam que o usuário teria acesso àquela cotação, e este relatório não representa apostas pessoais nem lucro real.',
  },
  summary: {
    games: games.length,
    picks: picks.length,
    wins,
    losses,
    pushes: picks.filter(pick => pick.result === 'push').length,
    unknown: picks.filter(pick => pick.result === 'unknown').length,
    hitRateExcludingPushes: graded.length ? wins / graded.length : null,
    projectionMae: mae,
    projectionBias: bias,
    gradingFieldMismatches: picks.filter(pick => !pick.gradeMatches).length,
    byMarket,
  },
  picks,
};

if (games.length !== EVENT_IDS.size) {
  throw new Error(`Esperava 3 partidas da abertura; encontrei ${games.length}. Relatório não gravado.`);
}
if (report.summary.gradingFieldMismatches > 0) {
  throw new Error(`Há ${report.summary.gradingFieldMismatches} divergências na apuração arquivada. Relatório não gravado.`);
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const outputPath = path.join(OUTPUT_DIR, 'opening-slate-2026-10-20.json');
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Backup: ${path.relative(process.cwd(), backupPath)}`);
console.log(`Jogos incluídos: ${report.summary.games}`);
console.log(`Props selecionadas (uma por jogador/categoria): ${report.summary.picks}`);
console.log(`Acertos/erros: ${wins}/${losses}`);
console.log(`MAE da projeção: ${mae === null ? 'n/a' : mae.toFixed(2)}`);
console.log(`Divergências com a apuração arquivada: ${report.summary.gradingFieldMismatches}`);
console.log(`Relatório separado: ${path.relative(process.cwd(), outputPath)}`);
