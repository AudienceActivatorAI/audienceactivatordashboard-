import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

// Get database connection string from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres connection
// For migrations and queries, we use different connection settings
export const createDbConnection = (options?: { max?: number }) => {
  const sql = postgres(connectionString, {
    max: options?.max ?? 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

  return drizzle(sql, { schema });
};

// Default database instance
export const db = createDbConnection();

// Type exports for convenience
export type Database = typeof db;
export * from './schema/index.js';
