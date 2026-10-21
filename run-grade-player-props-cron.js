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

  if (response.ok && body.success === true && body.pendingForecasts === 0) {
    console.log('Nenhum palpite elegível foi encontrado no banco deste endereço. A rotina só considera palpites pendentes cujo jogo começou há mais de 4 horas.');
  }

  if (!response.ok || body.success !== true || body.errors > 0) {
    if (response.status === 404) {
      console.error('A rota não existe nesse endereço. Confira se o npm run dev está ligado na mesma porta. Se estiver em 3001, use $env:ODD_FACIL_BASE_URL="http://localhost:3001" antes de rodar a rotina.');
    }
    process.exitCode = 1;
    return;
  }
}

run().catch((error) => {
  console.error(`Falha ao chamar o cron: ${error.message}`);
  process.exitCode = 1;
});
