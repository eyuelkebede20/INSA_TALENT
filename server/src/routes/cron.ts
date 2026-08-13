import { Router } from "express";
import { db } from "../db";
import { players, playerDailyStats } from "../db/schema";
import { eq } from "drizzle-orm";

export const cronRouter = Router();

export let lastCronHealth = {
    lastSync: null as string | null,
    status: "Never run" as string,
    message: ""
};

export async function runLichessSync() {
    try {
        const allPlayers = await db.select().from(players);
        
        for (const player of allPlayers) {
            if (!player.lichessUsername && !player.chesscomUsername) continue;
            
            try {
                let lichessRating = 0;
                let chesscomRating = 0;
                
                let currentLichessWins = player.lichessWins;
                let currentLichessLosses = player.lichessLosses;
                let currentLichessDraws = player.lichessDraws;
                let dailyWins = 0;
                let dailyLosses = 0;
                let dailyDraws = 0;

                if (player.lichessUsername) {
                    const response = await fetch(`https://lichess.org/api/user/${player.lichessUsername}`);
                    if (response.ok) {
                        const data = await response.json();
                        const perfs = data.perfs || {};
                        const getLichessGames = (perf: any) => perf?.games || 0;
                        const ratings = [
                            getLichessGames(perfs.blitz) >= 7 ? perfs.blitz?.rating : null,
                            getLichessGames(perfs.rapid) >= 7 ? perfs.rapid?.rating : null,
                            getLichessGames(perfs.bullet) >= 7 ? perfs.bullet?.rating : null,
                            getLichessGames(perfs.classical) >= 7 ? perfs.classical?.rating : null
                        ].filter(r => typeof r === 'number');
                        if (ratings.length > 0) lichessRating = Math.max(...ratings);

                        const totalWins = data.count?.win || 0;
                        const totalLosses = data.count?.loss || 0;
                        const totalDraws = data.count?.draw || 0;
                        
                        if (player.lichessWins > 0 || player.lichessLosses > 0 || player.lichessDraws > 0) {
                             dailyWins = Math.max(0, totalWins - player.lichessWins);
                             dailyLosses = Math.max(0, totalLosses - player.lichessLosses);
                             dailyDraws = Math.max(0, totalDraws - player.lichessDraws);
                        }

                        currentLichessWins = totalWins;
                        currentLichessLosses = totalLosses;
                        currentLichessDraws = totalDraws;
                    }
                }

                if (player.chesscomUsername) {
                    const response = await fetch(`https://api.chess.com/pub/player/${player.chesscomUsername}/stats`);
                    if (response.ok) {
                        const data = await response.json();
                        const getChesscomGames = (perf: any) => (perf?.record?.win || 0) + (perf?.record?.loss || 0) + (perf?.record?.draw || 0);
                        const ratings = [
                            getChesscomGames(data.chess_blitz) >= 7 ? data.chess_blitz?.last?.rating : null,
                            getChesscomGames(data.chess_rapid) >= 7 ? data.chess_rapid?.last?.rating : null,
                            getChesscomGames(data.chess_bullet) >= 7 ? data.chess_bullet?.last?.rating : null
                        ].filter(r => typeof r === 'number');
                        if (ratings.length > 0) chesscomRating = Math.max(...ratings);
                    }
                }

                let newRating = player.currentRating;
                if (lichessRating > 0 || chesscomRating > 0) {
                    newRating = Math.max(lichessRating, chesscomRating);
                }

                await db.update(players).set({ 
                    currentRating: newRating,
                    lichessWins: currentLichessWins,
                    lichessLosses: currentLichessLosses,
                    lichessDraws: currentLichessDraws
                }).where(eq(players.id, player.id));

                if (dailyWins > 0 || dailyLosses > 0 || dailyDraws > 0) {
                    await db.insert(playerDailyStats).values({
                        playerId: player.id,
                        rating: lichessRating || player.currentRating,
                        wins: dailyWins,
                        losses: dailyLosses,
                        draws: dailyDraws
                    });
                }
            } catch (err) {
                console.error(`Failed to fetch for ${player.lichessUsername}`, err);
            }
            // 200ms delay to respect Lichess API limits (max 5 requests per second)
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        lastCronHealth.lastSync = new Date().toISOString();
        lastCronHealth.status = "Success";
        lastCronHealth.message = "Sync complete";
        return { success: true, message: "Sync complete" };
    } catch (error: any) {
        lastCronHealth.lastSync = new Date().toISOString();
        lastCronHealth.status = "Failed";
        lastCronHealth.message = error.message || "Unknown error";
        throw error;
    }
}

cronRouter.post("/sync-lichess", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        res.status(401).json({ error: "Unauthorized cron access" });
        return;
    }

    try {
        const result = await runLichessSync();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
