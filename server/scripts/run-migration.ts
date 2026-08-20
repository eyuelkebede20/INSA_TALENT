import 'dotenv/config';
import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    const migrationSql = fs.readFileSync(path.join(process.cwd(), 'drizzle/0003_flowery_spot.sql'), 'utf-8');
    const statements = migrationSql.split('--> statement-breakpoint');
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        console.log(`Executing: ${stmt.trim()}`);
        await db.execute(sql.raw(stmt.trim()));
      }
    }
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error running migration:', error);
  }
  process.exit(0);
}

main();
