import 'dotenv/config';
import { db } from '../src/db/index.js';
import { players } from '../src/db/schema.js';
import { desc, eq } from 'drizzle-orm';

async function main() {
  console.log('Resetting all leaders...');
  await db.update(players).set({ isLeader: false });

  console.log('Finding highest rating player...');
  // Find highest rating player
  const topPlayers = await db.select().from(players).orderBy(desc(players.currentRating)).limit(1);

  if (topPlayers.length > 0) {
    const topPlayer = topPlayers[0];
    console.log(`Setting player ${topPlayer.realName} (rating: ${topPlayer.currentRating}) as leader`);
    await db.update(players).set({ isLeader: true }).where(eq(players.id, topPlayer.id));
    console.log('Successfully set highest rating player as leader.');
  } else {
    console.log('No players found.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
