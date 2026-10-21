import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local', quiet: true });

const apply = process.argv.includes('--apply');
// Keep user-entered bets and actual game values: they are inputs to the new
// season-based workflow. Only remove old model/odds history and ungraded
// forecasts. Ticket legs remain usable even if their optional forecast link
// becomes null through the database FK.
const tablesToClear = ['historical_records', 'opportunities', 'model_predictions', 'odds', 'credit_usage'];
const ungradedForecastsQuery = 'select * from player_prop_forecasts where actual_value is null';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não está definida. Confira o arquivo .env.local.');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 10,
  prepare: false,
});

async function countRows(client, table) {
  const [row] = await client.unsafe(`select count(*)::int as count from ${table}`);
  return row.count;
}

try {
  await sql`select 1`;
  const identity = await sql.unsafe('select current_database() as database');
  const counts = {};
  for (const table of tablesToClear) counts[table] = await countRows(sql, table);
  const [ungradedForecastCount] = await sql.unsafe('select count(*)::int as count from player_prop_forecasts where actual_value is null');

  console.log(`Banco conectado: ${identity[0].database}`);
  console.log('Registros que serão removidos:');
  for (const [table, count] of Object.entries(counts)) console.log(`- ${table}: ${count}`);
  console.log(`- player_prop_forecasts sem resultado real: ${ungradedForecastCount.count}`);
  console.log('\nSerão preservados: bilhetes pessoais e suas seleções, previsões que contêm valor real de jogo, equipes e partidas/resultados.');

  if (!apply) {
    console.log('\nPrévia concluída. Nada foi apagado. Para fazer a limpeza, rode: npm run data:reset -- --apply');
    process.exitCode = 0;
  } else {
    const backupFolder = path.join(process.cwd(), 'data-backups');
    await fs.mkdir(backupFolder, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupFolder, `prediction-data-${timestamp}.json`);

    await sql.begin(async transaction => {
      const backup = { createdAt: new Date().toISOString(), database: identity[0].database, tables: {} };
      for (const table of tablesToClear) {
        backup.tables[table] = await transaction.unsafe(`select * from ${table}`);
      }
      backup.tables.player_prop_forecasts_ungraded = await transaction.unsafe(ungradedForecastsQuery);
      await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');

      for (const table of tablesToClear) await transaction.unsafe(`delete from ${table}`);
      await transaction.unsafe('delete from player_prop_forecasts where actual_value is null');
    });

    const after = {};
    for (const table of tablesToClear) after[table] = await countRows(sql, table);
    const [afterUngraded] = await sql.unsafe('select count(*)::int as count from player_prop_forecasts where actual_value is null');
    const [afterActual] = await sql.unsafe('select count(*)::int as count from player_prop_forecasts where actual_value is not null');
    console.log(`\nCópia salva em: ${backupPath}`);
    console.log('Contagens após a limpeza:');
    for (const [table, count] of Object.entries(after)) console.log(`- ${table}: ${count}`);
    console.log(`- player_prop_forecasts sem resultado real: ${afterUngraded.count}`);
    console.log(`- player_prop_forecasts preservadas com valor real: ${afterActual.count}`);
    if (Object.values(after).some(count => count !== 0) || afterUngraded.count !== 0) process.exitCode = 1;
  }
} catch (error) {
  console.error(`Falha na rotina de limpeza: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
