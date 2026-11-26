import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgresql://samba:samba_secret@localhost:5432/samba_db';

const isLocalConnection =
  connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  (!isLocalConnection && process.env.DATABASE_SSL !== 'false');

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDbHealth() {
  const res = await pool.query(
    'SELECT current_database() AS database, current_user AS db_user, version() AS version'
  );
  return res.rows[0];
}

export async function closePool() {
  await pool.end();
}
