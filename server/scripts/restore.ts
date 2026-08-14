import { db } from '../src/db';
import { teams, players, eventSettings, playerDailyStats, studentFeedbacks, user, session, account, verification } from '../src/db/schema';
import fs from 'fs/promises';
import path from 'path';

const dateReviver = (key: string, value: any) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(value);
  }
  return value;
};

async function restore() {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Please provide a backup filename to restore: npm run restore <filename>');
    process.exit(1);
  }

  const filepath = path.resolve(process.cwd(), 'backups', filename);
  
  console.log(`Reading backup from ${filepath}...`);
  const fileContent = await fs.readFile(filepath, 'utf-8');
  const backup = JSON.parse(fileContent, dateReviver);
  const data = backup.data;

  console.log('Starting restore (this will overwrite current data)...');

  await db.transaction(async (tx) => {
    // 1. Delete all existing data in reverse dependency order
    await tx.delete(studentFeedbacks);
    await tx.delete(playerDailyStats);
    await tx.delete(players);
    await tx.delete(teams);
    await tx.delete(eventSettings);
    
    await tx.delete(session);
    await tx.delete(account);
    await tx.delete(verification);
    await tx.delete(user);

    // 2. Insert data back
    if (data.user?.length) await tx.insert(user).values(data.user);
    if (data.session?.length) await tx.insert(session).values(data.session);
    if (data.account?.length) await tx.insert(account).values(data.account);
    if (data.verification?.length) await tx.insert(verification).values(data.verification);
    
    if (data.eventSettings?.length) await tx.insert(eventSettings).values(data.eventSettings);
    if (data.teams?.length) await tx.insert(teams).values(data.teams);
    if (data.players?.length) await tx.insert(players).values(data.players);
    if (data.playerDailyStats?.length) await tx.insert(playerDailyStats).values(data.playerDailyStats);
    if (data.studentFeedbacks?.length) await tx.insert(studentFeedbacks).values(data.studentFeedbacks);
  });

  console.log('Restore completed successfully!');
  process.exit(0);
}

restore().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
