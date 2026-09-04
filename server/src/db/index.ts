import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL as string;
const client = postgres(connectionString, { 
  prepare: false,
  ssl: 'require'
});
export const db = drizzle(client, { schema });
