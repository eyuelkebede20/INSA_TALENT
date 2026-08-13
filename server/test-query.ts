import { db } from './src/db';
import { sql } from 'drizzle-orm';
db.execute(sql`
SELECT t.team_number, 
       COALESCE(SUM(ds.wins), 0) as total_wins, 
       COALESCE(SUM(ds.losses), 0) as total_losses, 
       COALESCE(SUM(ds.wins), 0) - COALESCE(SUM(ds.losses), 0) as total_rating 
FROM teams t 
JOIN players p ON p.team_id = t.id 
LEFT JOIN player_daily_stats ds ON ds.player_id = p.id AND ds.recorded_at >= CURRENT_DATE 
GROUP BY t.team_number 
ORDER BY total_rating DESC, total_wins DESC
`).then(console.log).catch(console.error).finally(()=>process.exit(0));
