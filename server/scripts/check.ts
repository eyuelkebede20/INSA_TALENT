import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  const allTeams = await db.execute(sql`
            SELECT t.id, t.team_number, t.is_locked, 
                   json_agg(json_build_object('id', p.id, 'name', p.real_name, 'tier', p.tier, 'rating', p.current_rating, 'insa_code', p.insa_code, 'email', p.email)) as members
            FROM teams t
            LEFT JOIN players p ON p.team_id = t.id
            GROUP BY t.id
            ORDER BY t.team_number ASC
            LIMIT 2
        `);
  console.log(JSON.stringify(allTeams, null, 2));
  process.exit(0);
}
check();
