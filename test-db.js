require('dotenv').config({path:'.env.local'});
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
sql`SELECT 1`.then(r => {
  console.log('DB OK:', r);
  return sql.end();
}).catch(e => {
  console.error('DB Error:', e.message);
  return sql.end();
});