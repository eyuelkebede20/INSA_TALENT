import { db } from "../db";
import { players, teams } from "../db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function assignPlayerToTeam(playerId: string, playerTier: "ADVANCED" | "MID" | "BEGINNER", tx: any = db) {
    const maxCapacity = 11;

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
        const teamCountRes = await tx.execute(sql`SELECT COUNT(*) as count FROM teams`);
        const teamCount = Number(teamCountRes[0]?.count || 0);
        if (teamCount >= 100) {
            throw new Error("Maximum number of teams (100) reached.");
        }

        const highestTeamResult = await tx.execute(sql`SELECT MAX(team_number) as max_team FROM teams`);
        const maxTeamNumber = highestTeamResult[0]?.max_team || 0;
        
        let nextTeamNumber = maxTeamNumber + 1;
        if (nextTeamNumber > 100) {
            // Find lowest available team number between 1 and 100
            const existingTeams = await tx.execute(sql`SELECT team_number FROM teams`);
            const usedNumbers = new Set(existingTeams.map((t: any) => t.team_number));
            for (let i = 1; i <= 100; i++) {
                if (!usedNumbers.has(i)) {
                    nextTeamNumber = i;
                    break;
                }
            }
            if (nextTeamNumber > 100) {
                 throw new Error("No available team numbers between 1 and 100.");
            }
        }

        const newTeam = await tx.insert(teams).values({
            teamNumber: nextTeamNumber,
            isLocked: false
        }).returning();
        teamId = newTeam[0].id;
    }

    // 3. Assign the player
    await tx.update(players).set({ teamId }).where(eq(players.id, playerId));
}
