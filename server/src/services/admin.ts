import { db } from "../db";
import { players, teams, eventSettings } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { checkAndLockTeam } from "./eos";

export async function cascadeBackfill(lockedTeamId: number, missingTier: "ADVANCED" | "MID" | "BEGINNER", tx: any = db) {
    const targetTeam = await tx.execute(sql`SELECT team_number FROM teams WHERE id = ${lockedTeamId}`);
    if(!targetTeam[0]) return;
    const targetTeamNum = targetTeam[0].team_number;

    // 1. Unlock the team instantly since someone is missing
    await tx.update(teams).set({ isLocked: false }).where(eq(teams.id, lockedTeamId));

    // 2. Find the oldest player of the missingTier in ANY team with a HIGHER team number
    const nextPlayerRes = await tx.execute(sql`
        SELECT p.id, p.team_id 
        FROM players p
        JOIN teams t ON p.team_id = t.id
        WHERE p.tier = ${missingTier} 
          AND t.team_number > ${targetTeamNum}
        ORDER BY t.team_number ASC, p.created_at ASC
        LIMIT 1
    `);

    const playerToMove = nextPlayerRes[0];

    if (!playerToMove) return;

    // 3. Move the player up to the incomplete team
    await tx.update(players).set({ teamId: lockedTeamId }).where(eq(players.id, playerToMove.id));

    // 4. Check if target team should be locked again
    await checkAndLockTeam(lockedTeamId, tx);

    // 5. Recursively backfill the team that just lost a player
    await cascadeBackfill(playerToMove.team_id, missingTier, tx);
}

export async function cleanupEmptyTeams(tx: any = db) {
    await tx.execute(sql`DELETE FROM teams t WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.team_id = t.id)`);
}

export async function deletePlayerAndBackfill(playerId: string) {
    await db.transaction(async (tx: any) => {
        const playerRes = await tx.execute(sql`SELECT p.tier, p.team_id, t.is_locked FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ${playerId}`);
        const pInfo = playerRes[0];
        
        if (!pInfo) throw new Error("Player not found");

        await tx.delete(players).where(eq(players.id, playerId));

        if (pInfo.team_id) {
            await cascadeBackfill(pInfo.team_id, pInfo.tier, tx);
        }
        await cleanupEmptyTeams(tx);
    });
}
