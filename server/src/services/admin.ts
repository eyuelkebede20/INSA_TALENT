import { db } from "../db";
import { players, teams, eventSettings } from "../db/schema";
import { eq, sql } from "drizzle-orm";



export async function updateTeamLocks(tx: any = db) {
    await tx.execute(sql`
        UPDATE teams 
        SET is_locked = true 
        WHERE id IN (
            SELECT team_id FROM players WHERE team_id IS NOT NULL GROUP BY team_id HAVING COUNT(*) >= 11
        )
    `);
    await tx.execute(sql`
        UPDATE teams 
        SET is_locked = false 
        WHERE id IN (
            SELECT team_id FROM players WHERE team_id IS NOT NULL GROUP BY team_id HAVING COUNT(*) < 11
        )
    `);
}

export async function cleanupEmptyTeams(tx: any = db) {
    await tx.execute(sql`DELETE FROM teams t WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.team_id = t.id)`);
}

export async function deletePlayer(playerId: string) {
    await db.transaction(async (tx: any) => {
        await tx.delete(players).where(eq(players.id, playerId));
        await updateTeamLocks(tx);
        await cleanupEmptyTeams(tx);
    });
}
