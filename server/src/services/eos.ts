import { db } from "../db";
import { players, teams } from "../db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function assignPlayerToTeam(playerId: string, playerTier: "ADVANCED" | "MID" | "BEGINNER", tx: any = db) {
    const maxCapacity = playerTier === 'ADVANCED' ? 1 : playerTier === 'MID' ? 2 : 8;

    // 1. Find the earliest unlocked team with room for this tier
    const targetTeam = await tx.execute(sql`
        SELECT t.id, t.team_number 
        FROM teams t 
        LEFT JOIN players p ON p.team_id = t.id AND p.tier = ${playerTier}
        WHERE t.is_locked = false
        GROUP BY t.id, t.team_number
        HAVING COUNT(p.id) < ${maxCapacity}
        ORDER BY t.team_number ASC 
        LIMIT 1
    `);

    let teamId = targetTeam[0]?.id;

    // 2. If no open team exists, create a new one
    if (!teamId) {
        const highestTeamResult = await tx.execute(sql`SELECT MAX(team_number) as max_team FROM teams`);
        const maxTeamNumber = highestTeamResult[0]?.max_team || 0;
        
        const newTeam = await tx.insert(teams).values({
            teamNumber: maxTeamNumber + 1,
            isLocked: false
        }).returning();
        teamId = newTeam[0].id;
    }

    // 3. Assign the player
    await tx.update(players).set({ teamId }).where(eq(players.id, playerId));
}
