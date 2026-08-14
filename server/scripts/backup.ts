import { db } from '../src/db';
import { teams, players, eventSettings, playerDailyStats, studentFeedbacks, user, session, account, verification } from '../src/db/schema';
import fs from 'fs/promises';
import path from 'path';

async function backup() {
  console.log('Starting backup...');
  
  const backupData = {
    timestamp: new Date().toISOString(),
    data: {
      eventSettings: await db.select().from(eventSettings),
      teams: await db.select().from(teams),
      players: await db.select().from(players),
      playerDailyStats: await db.select().from(playerDailyStats),
      studentFeedbacks: await db.select().from(studentFeedbacks),
      user: await db.select().from(user),
      session: await db.select().from(session),
      account: await db.select().from(account),
      verification: await db.select().from(verification)
    }
  };

  const backupDir = path.join(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(backupDir, filename);
  
  await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));
  console.log(`Backup saved to ${filepath}`);
  process.exit(0);
}

backup().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
