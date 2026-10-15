require('dotenv').config({path:'.env.local'});

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE_URL = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';

async function test() {
  const today = new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({
    apiKey: ODDS_API_KEY,
    regions: 'us,eu',
    markets: 'h2h,spreads,totals',
    oddsFormat: 'decimal',
    dateFormat: 'iso',
    date: today,
  });

  const url = `${ODDS_API_BASE_URL}/sports/basketball_nba/events?${params}`;
  console.log('Fetching:', url);
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  console.log('Status:', response.status);
  console.log('Credits used:', response.headers.get('x-requests-used'));
  console.log('Credits remaining:', response.headers.get('x-requests-remaining'));

  const data = await response.json();
  console.log('Games:', data.length);
  data.forEach(g => console.log(' -', g.away_team, '@', g.home_team, g.commence_time));
}

test().catch(console.error);