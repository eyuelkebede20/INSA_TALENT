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
            if (!player.lichessUsername && !player.chesscomUsername) continue;
            
            try {
                let lichessRating = 0;
                let chesscomRating = 0;

                if (player.lichessUsername) {
                    const response = await fetch(`https://lichess.org/api/user/${player.lichessUsername}`);
                    if (response.ok) {
                        const data = await response.json();
                        const perfs = data.perfs || {};
                        const ratings = [perfs.blitz?.rating, perfs.rapid?.rating, perfs.bullet?.rating, perfs.classical?.rating].filter(r => typeof r === 'number');
                        if (ratings.length > 0) lichessRating = Math.max(...ratings);
                    }
                }

                if (player.chesscomUsername) {
                    const response = await fetch(`https://api.chess.com/pub/player/${player.chesscomUsername}/stats`);
                    if (response.ok) {
                        const data = await response.json();
                        const ratings = [data.chess_blitz?.last?.rating, data.chess_rapid?.last?.rating, data.chess_bullet?.last?.rating].filter(r => typeof r === 'number');
                        if (ratings.length > 0) chesscomRating = Math.max(...ratings);
                    }
                }

                const newRating = Math.max(lichessRating, chesscomRating, player.currentRating); // ensure it never drops below their current if both APIs fail

                if (newRating !== player.currentRating && (lichessRating > 0 || chesscomRating > 0)) {
                    await db.update(players).set({ currentRating: newRating }).where(eq(players.id, player.id));
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
