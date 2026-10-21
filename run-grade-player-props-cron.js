require('dotenv').config({ path: '.env.local' });

const port = process.env.PORT || '3000';
const baseUrl = (process.env.ODD_FACIL_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
  console.error('CRON_SECRET não está configurada no .env.local.');
  process.exit(1);
}

async function run() {
  const cronUrl = `${baseUrl}/api/cron/grade-player-props`;
  console.log(`Chamando rotina em: ${cronUrl}`);
  const response = await fetch(cronUrl, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const responseText = await response.text();
  let body = {};
  try { body = responseText ? JSON.parse(responseText) : {}; } catch { body = { response: responseText.slice(0, 300) }; }

  console.log(`Apuração: HTTP ${response.status}`);
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok || body.success !== true || body.errors > 0) {
    if (response.status === 404) {
      console.error('A rota não existe nesse endereço. Confira se o npm run dev está ligado na mesma porta. Se estiver em 3001, use $env:ODD_FACIL_BASE_URL="http://localhost:3001" antes de rodar a rotina.');
    }
    process.exitCode = 1;
    return;
  }

  const historyResponse = await fetch(
    `${baseUrl}/api/analysis/nba/history?phase=preseason&limit=100`,
  );
  const history = await historyResponse.json().catch(() => ({}));

  if (!historyResponse.ok || !Array.isArray(history.forecasts)) {
    console.error(`Não foi possível consultar o piloto: HTTP ${historyResponse.status}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nPiloto da pré-temporada:');
  console.log(`${history.page.total} previsões no histórico`);
  for (const item of history.forecasts) {
    const game = item.game || 'Partida sem identificação';
    const player = item.player || 'Jogador';
    const market = item.market || 'Mercado';
    const line = item.line ?? '—';
    const actual = item.actualValue ?? 'aguardando jogo';
    const result = item.result || 'pendente';
    console.log(`- ${game} | ${player} | ${market} ${line} | ${result} | realizado: ${actual}`);
  }
}

run().catch((error) => {
  console.error(`Falha ao chamar o cron: ${error.message}`);
  process.exitCode = 1;
});
