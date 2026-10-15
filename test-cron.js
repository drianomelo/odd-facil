require('dotenv').config({path:'.env.local'});

const postgres = require('postgres');

console.log('Testing database connection...');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function test() {
  try {
    // Test lock
    const lockResult = await sql`SELECT pg_try_advisory_xact_lock(123456789) as acquired`;
    console.log('Lock result:', lockResult);
    
    // Test credit usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const creditResult = await sql`SELECT sum(credits_used) as total FROM credit_usage WHERE date >= ${startOfMonth}`;
    console.log('Credit usage:', creditResult);
    
    // Test teams
    const teamsResult = await sql`SELECT * FROM teams LIMIT 5`;
    console.log('Teams:', teamsResult);
    
    // Test games
    const gamesResult = await sql`SELECT * FROM games LIMIT 5`;
    console.log('Games:', gamesResult);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

test();