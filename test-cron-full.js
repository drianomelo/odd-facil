require('dotenv').config({path:'.env.local'});

const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function testCron() {
  console.log('=== Testing cron components ===');
  
  // 1. Test lock
  console.log('\n1. Testing lock...');
  try {
    const lockResult = await sql`SELECT pg_try_advisory_xact_lock(123456789) as acquired`;
    console.log('Lock acquired:', lockResult[0]?.acquired);
  } catch (e) {
    console.error('Lock error:', e.message);
  }
  
  // 2. Test credit budget
  console.log('\n2. Testing credit budget...');
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const creditResult = await sql`SELECT sum(credits_used) as total FROM credit_usage WHERE date >= ${startOfMonth}`;
    console.log('Credit used:', creditResult[0]?.total);
  } catch (e) {
    console.error('Credit budget error:', e.message);
  }
  
  // 3. Test odds API
  console.log('\n3. Testing odds API...');
  try {
    const ODDS_API_KEY = process.env.ODDS_API_KEY;
    const today = new Date().toISOString().split('T')[0];
    const params = new URLSearchParams({
      apiKey: ODDS_API_KEY,
      regions: 'us,eu',
      markets: 'h2h,spreads,totals',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
      date: today,
    });
    const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/events?${params}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log('Games fetched:', data.length);
  } catch (e) {
    console.error('Odds API error:', e.message);
  }
  
  // 4. Test database inserts
  console.log('\n4. Testing database inserts...');
  try {
    // Insert a test team
    const teamResult = await sql`
      INSERT INTO teams (external_id, league_id, name, abbreviation)
      VALUES ('test-team', 'NBA', 'Test Team', 'TST')
      ON CONFLICT (external_id, league_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    console.log('Team insert:', teamResult[0]);
    
    // Insert a test game
    const gameResult = await sql`
      INSERT INTO games (external_id, league_id, home_team_id, away_team_id, commence_time, status)
      VALUES ('test-game', 'NBA', ${teamResult[0]?.id}, ${teamResult[0]?.id}, NOW(), 'scheduled')
      ON CONFLICT (external_id) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `;
    console.log('Game insert:', gameResult[0]);
    
    // Clean up
    await sql`DELETE FROM games WHERE external_id = 'test-game'`;
    await sql`DELETE FROM teams WHERE external_id = 'test-team'`;
    console.log('Cleanup done');
  } catch (e) {
    console.error('Database insert error:', e.message);
  }
  
  await sql.end();
  console.log('\n=== Test complete ===');
}

testCron().catch(console.error);