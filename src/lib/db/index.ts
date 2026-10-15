import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const conn = globalForDb.conn ?? postgres(connectionString, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

const db = globalForDb.db ?? drizzle(conn, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn;
  globalForDb.db = db;
}

export { db, conn };
export * from './schema';