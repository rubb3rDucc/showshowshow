import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import dotenv from 'dotenv';
import { Database } from './types.js';

dotenv.config();

const { Pool } = pg;

// Create connection pool
// CRITICAL: Supabase free tier has 15 connection limit
// With max: 5 per instance, we can run up to 3 instances (15 total)
// Set DB_POOL_MAX env var to override (e.g., DB_POOL_MAX=10 for single instance)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '5', 10), // Reduced from 20 to 5
  min: 1, // Keep at least 1 connection ready
  idleTimeoutMillis: 10000, // Reduced from 30000 - release idle connections faster
  connectionTimeoutMillis: 10000, // Increased from 2000 to 10000 (10 seconds)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Connection pool monitoring (logs every 30 seconds in production)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    console.log('📊 DB Pool Stats:', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
      max: pool.options.max,
    });
  }, 30000);

  pool.on('connect', () => {
    console.log(`🔌 New DB client connected. Total: ${pool.totalCount}/${pool.options.max}`);
  });

  pool.on('remove', () => {
    console.log(`🔌 DB client removed. Total: ${pool.totalCount}/${pool.options.max}`);
  });

  pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle DB client:', err);
  });
}

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
