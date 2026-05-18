import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL');
}

export const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool);
