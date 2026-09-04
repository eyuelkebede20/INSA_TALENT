import { db } from '../src/db/index.js';
import { players, teams } from '../src/db/schema.js';
import { count } from 'drizzle-orm';

async function test() {
  const c = await db.select({ value: count() }).from(players);
  const t = await db.select({ value: count() }).from(teams);
  console.log(`Players count: ${c[0].value}`);
  console.log(`Teams count: ${t[0].value}`);
  process.exit(0);
}
test();
