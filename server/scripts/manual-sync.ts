import 'dotenv/config';
import { runLichessSync } from '../src/routes/cron.js';

async function main() {
  console.log('Running manual lichess sync...');
  try {
    const result = await runLichessSync();
    console.log('Sync result:', result);
  } catch (error) {
    console.error('Sync failed:', error);
  }
  process.exit(0);
}

main();
