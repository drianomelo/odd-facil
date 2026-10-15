require('dotenv').config({path:'.env.local'});

const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function test() {
  try {
    // Check leagues
    const leagues = await sql`SELECT * FROM leagues`;
    console.log('Leagues:', leagues);
    
    // Insert NBA league if not exists
    await sql`
      INSERT INTO leagues (id, name, enabled)
      VALUES ('NBA', 'National Basketball Association', true)
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('NBA league inserted');
    
    // Verify
    const leagues2 = await sql`SELECT * FROM leagues`;
    console.log('Leagues after:', leagues2);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
}

test();