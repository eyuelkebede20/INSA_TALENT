import { db } from "../db";
import { players, teams, eventSettings } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { assignPlayerToTeam } from "./eos";

export async function cascadeBackfill(lockedTeamId: number, missingTier: "ADVANCED" | "MID" | "BEGINNER", tx: any = db) {
    // 1. Unlock the team instantly since someone is missing
    await tx.update(teams).set({ isLocked: false }).where(eq(teams.id, lockedTeamId));

    // 2. Find the oldest player of the missingTier in the next available UNLOCKED team
    const nextPlayerRes = await tx.execute(sql`
        SELECT p.id, p.team_id 
        FROM players p
        JOIN teams t ON p.team_id = t.id
        WHERE p.tier = ${missingTier} 
          AND t.is_locked = false 
          AND t.id != ${lockedTeamId}
        ORDER BY t.team_number ASC, p.created_at ASC
        LIMIT 1
    `);

    const playerToMove = nextPlayerRes[0];

    if (!playerToMove) return;

    // 3. Move the player up to the incomplete team
    await tx.update(players).set({ teamId: lockedTeamId }).where(eq(players.id, playerToMove.id));

    // 4. Lock the team again
    await tx.update(teams).set({ isLocked: true }).where(eq(teams.id, lockedTeamId));
}

export async function deletePlayerAndBackfill(playerId: string) {
    await db.transaction(async (tx: any) => {
        const playerRes = await tx.execute(sql`SELECT p.tier, p.team_id, t.is_locked FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ${playerId}`);
        const pInfo = playerRes[0];
        
        if (!pInfo) throw new Error("Player not found");

        await tx.delete(players).where(eq(players.id, playerId));

        if (pInfo.is_locked && pInfo.team_id) {
            await cascadeBackfill(pInfo.team_id, pInfo.tier, tx);
        }
    });
}
