import { Router } from "express";
import { db } from "../db";
import { players } from "../db/schema";
import { eq } from "drizzle-orm";

export const cronRouter = Router();

cronRouter.post("/sync-lichess", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        res.status(401).json({ error: "Unauthorized cron access" });
        return;
    }

    try {
        const allPlayers = await db.select().from(players);
        
        for (const player of allPlayers) {
            if (!player.lichessUsername) continue;
            
            try {
                const response = await fetch(`https://lichess.org/api/user/${player.lichessUsername}`);
                if (response.ok) {
                    const data = await response.json();
                    const newRating = data.perfs?.rapid?.rating || data.perfs?.blitz?.rating || player.currentRating;
                    
                    if (newRating !== player.currentRating) {
                        await db.update(players).set({ currentRating: newRating }).where(eq(players.id, player.id));
                    }
                }
            } catch (err) {
                console.error(`Failed to fetch for ${player.lichessUsername}`, err);
            }
            // 200ms delay to respect Lichess API limits (max 5 requests per second)
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        res.json({ success: true, message: "Sync complete" });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
