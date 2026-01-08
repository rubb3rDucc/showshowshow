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
    rejectUnauthorized: false  // Accept self-signed certs (common for managed Postgres like Supabase)
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

// Configurable threshold for slow queries (default: 1000ms)
const SLOW_QUERY_THRESHOLD_MS = parseInt(
  process.env.SLOW_QUERY_THRESHOLD_MS || '1000',
  10
);

// Track slow queries using pg pool query events
if (process.env.NODE_ENV === 'production') {
  // Intercept pool queries to track timing
  const originalQuery = pool.query.bind(pool);
  (pool as any).query = function(...args: any[]): any {
    const startTime = Date.now();
    const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
    
    // Call original query with proper typing
    const result: any = (originalQuery as any).apply(pool, args);
    
    // Track query duration (async, don't block)
    if (result && typeof result.then === 'function') {
      result
        .then(() => {
          const duration = Date.now() - startTime;
          
          if (duration >= SLOW_QUERY_THRESHOLD_MS) {
            // Track slow query in PostHog
            import('../lib/posthog.js')
              .then(({ captureEvent }) => {
                captureEvent('slow_query', {
                  distinctId: 'system',
                  properties: {
                    query_type: extractQueryType(queryText),
                    table: extractTableName(queryText),
                    duration_ms: duration,
                    query_preview: queryText.substring(0, 200),
                  },
                });
              })
              .catch(() => {
                // Silently fail if PostHog not available
              });

            // Log slow query
            console.warn('⚠️  Slow query detected:', {
              duration_ms: duration,
              query_type: extractQueryType(queryText),
              table: extractTableName(queryText),
              preview: queryText.substring(0, 100),
            });
          }
        })
        .catch(() => {
          // Ignore query errors for timing purposes
        });
    }
    
    return result;
  };
}

// Create Kysely instance
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  log(event) {
    // Development: log all queries
    if (event.level === 'query' && process.env.NODE_ENV === 'development') {
      console.log('Query:', event.query.sql);
      if (event.query.parameters.length > 0) {
        console.log('Params:', event.query.parameters);
      }
    }
  },
});

/**
 * Extract query type from SQL (SELECT, INSERT, UPDATE, DELETE)
 */
function extractQueryType(sql: string): string {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT')) return 'SELECT';
  if (trimmed.startsWith('INSERT')) return 'INSERT';
  if (trimmed.startsWith('UPDATE')) return 'UPDATE';
  if (trimmed.startsWith('DELETE')) return 'DELETE';
  return 'UNKNOWN';
}

/**
 * Extract table name from SQL query (simple extraction)
 */
function extractTableName(sql: string): string | null {
  const trimmed = sql.trim().toUpperCase();
  
  // Try to extract table name from common patterns
  const fromMatch = trimmed.match(/FROM\s+["`]?(\w+)["`]?/i);
  if (fromMatch) return fromMatch[1];
  
  const insertMatch = trimmed.match(/INTO\s+["`]?(\w+)["`]?/i);
  if (insertMatch) return insertMatch[1];
  
  const updateMatch = trimmed.match(/UPDATE\s+["`]?(\w+)["`]?/i);
  if (updateMatch) return updateMatch[1];
  
  return null;
}

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
