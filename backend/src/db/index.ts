import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import dotenv from 'dotenv';
import type { Database } from './types.js';

dotenv.config();

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
});

// Create Kysely instance
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  log(event) {
    if (event.level === 'query' && process.env.NODE_ENV === 'development') {
      console.log('Query:', event.query.sql);
      if (event.query.parameters.length > 0) {
        console.log('Params:', event.query.parameters);
      }
    }
  },
});

// Test connection
export async function testConnection() {
  try {
    await db.selectFrom('users').select('id').limit(1).execute();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeConnection() {
  await pool.end();
  console.log('Database connection closed');
}

