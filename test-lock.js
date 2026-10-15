require('dotenv').config({path:'.env.local'});
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
sql`SELECT pg_try_advisory_xact_lock(123456789) as acquired`.then(r => console.log('Lock:', r)).catch(e => console.error('Error:', e.message)).finally(() => sql.end());