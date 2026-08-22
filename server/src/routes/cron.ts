import { Router } from "express";
import { db } from "../db";
import { players, playerDailyStats, eventSettings } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export const cronRouter = Router();

export let lastCronHealth = {
  lastSync: null as string | null,
  status: "Never run" as string,
  message: "",
  invalidAccounts: [] as string[],
};

// Prevents overlapping runs if the cron fires again before a previous
// sync has finished (e.g. a slow run due to rate limiting).
let isSyncRunning = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, retries = 3, delayMs = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && i < retries - 1) {
        await sleep(2000);
        continue;
      }
      return res;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await sleep(delayMs);
    }
  }
  throw new Error(`Fetch failed after ${retries} retries`);
};

export async function runLichessSync() {
  if (isSyncRunning) {
    const message = "Sync already in progress, skipping this run";
    lastCronHealth.message = message;
    return { success: false, message };
  }

  isSyncRunning = true;
  lastCronHealth.status = "Running...";
  lastCronHealth.message = "Sync in progress";

  try {
    const allPlayers = await db.select().from(players);
    lastCronHealth.invalidAccounts = []; // reset for this run

    for (const player of allPlayers) {
      if (!player.lichessUsername && !player.chesscomUsername) continue;

      // Every path through this block ends with a trailing delay so we
      // never hammer either API back-to-back after a rate-limit/error.
      try {
        let lichessRating = 0;
        let chesscomRating = 0;

        let currentLichessWins = player.lichessWins;
        let currentLichessLosses = player.lichessLosses;
        let currentLichessDraws = player.lichessDraws;
        let dailyWins = 0;
        let dailyLosses = 0;
        let dailyDraws = 0;

        const cleanLichessUser = player.lichessUsername?.replace(/^@+/, "").trim();
        const cleanChesscomUser = player.chesscomUsername?.replace(/^@+/, "").trim();

        let skipUpdate = false;

        if (cleanLichessUser) {
          const response = await fetchWithRetry(`https://lichess.org/api/user/${cleanLichessUser}`);
          if (response.ok) {
            const data = await response.json();
            const perfs = data.perfs || {};
            const getLichessGames = (perf: any) => perf?.games || 0;
            const ratings = [
              getLichessGames(perfs.blitz) >= 7 ? perfs.blitz?.rating : null,
              getLichessGames(perfs.rapid) >= 7 ? perfs.rapid?.rating : null,
              getLichessGames(perfs.bullet) >= 7 ? perfs.bullet?.rating : null,
              getLichessGames(perfs.classical) >= 7 ? perfs.classical?.rating : null,
            ].filter((r) => typeof r === "number");
            if (ratings.length > 0) lichessRating = Math.max(...ratings);

            const totalWins = data.count?.win || 0;
            const totalLosses = data.count?.loss || 0;
            const totalDraws = data.count?.draw || 0;

            if (player.lichessWins > 0 || player.lichessLosses > 0 || player.lichessDraws > 0) {
              const rawWinDelta = totalWins - player.lichessWins;
              const rawLossDelta = totalLosses - player.lichessLosses;
              const rawDrawDelta = totalDraws - player.lichessDraws;

              if (rawWinDelta < 0 || rawLossDelta < 0 || rawDrawDelta < 0) {
                // Counts went down (account swap, stats reset, etc).
                // We clamp to 0 rather than record a negative delta,
                // but log it since the new lower total becomes the
                // baseline going forward and could cause an inflated
                // spike later.
                console.warn(
                  `Lichess stat count decreased for ${player.realName} (${cleanLichessUser}): ` +
                    `wins ${player.lichessWins}->${totalWins}, losses ${player.lichessLosses}->${totalLosses}, ` +
                    `draws ${player.lichessDraws}->${totalDraws}`,
                );
              }

              dailyWins = Math.max(0, rawWinDelta);
              dailyLosses = Math.max(0, rawLossDelta);
              dailyDraws = Math.max(0, rawDrawDelta);
            }

            currentLichessWins = totalWins;
            currentLichessLosses = totalLosses;
            currentLichessDraws = totalDraws;
          } else if (response.status === 404) {
            lastCronHealth.invalidAccounts.push(`${player.realName} (lichess: ${cleanLichessUser})`);
          } else if (response.status === 429) {
            // Rate limited even after internal retries; skip this
            // player entirely so we don't overwrite with 0s.
            skipUpdate = true;
          } else {
            // 500s or other errors - skip
            skipUpdate = true;
          }
        }

        if (!skipUpdate && cleanChesscomUser) {
          const response = await fetchWithRetry(`https://api.chess.com/pub/player/${cleanChesscomUser}/stats`);
          if (response.ok) {
            const data = await response.json();
            const getChesscomGames = (perf: any) => (perf?.record?.win || 0) + (perf?.record?.loss || 0) + (perf?.record?.draw || 0);
            const ratings = [
              getChesscomGames(data.chess_blitz) >= 7 ? data.chess_blitz?.last?.rating : null,
              getChesscomGames(data.chess_rapid) >= 7 ? data.chess_rapid?.last?.rating : null,
              getChesscomGames(data.chess_bullet) >= 7 ? data.chess_bullet?.last?.rating : null,
            ].filter((r) => typeof r === "number");
            if (ratings.length > 0) chesscomRating = Math.max(...ratings);
          } else if (response.status === 404) {
            lastCronHealth.invalidAccounts.push(`${player.realName} (chess.com: ${cleanChesscomUser})`);
          }
          // Note: chess.com win/loss/draw counts aren't tracked into
          // dailyWins/Losses/Draws here because the players table only
          // has lichessWins/Losses/Draws baseline columns. Add
          // chesscomWins/Losses/Draws columns to the schema if you want
          // chess.com-only players to show up in daily activity stats.
        }

        if (skipUpdate) {
          continue; // trailing delay still runs via finally below
        }

        let newRating = player.currentRating;
        if (lichessRating > 0 || chesscomRating > 0) {
          newRating = Math.max(lichessRating, chesscomRating);
        }

        await Promise.all([
          db
            .update(players)
            .set({
              currentRating: newRating,
              lichessWins: currentLichessWins,
              lichessLosses: currentLichessLosses,
              lichessDraws: currentLichessDraws,
            })
            .where(eq(players.id, player.id)),
          dailyWins > 0 || dailyLosses > 0 || dailyDraws > 0
            ? db.insert(playerDailyStats).values({
                playerId: player.id,
                rating: newRating,
                wins: dailyWins,
                losses: dailyLosses,
                draws: dailyDraws,
              })
            : Promise.resolve(),
        ]);
      } catch (err) {
        console.error(`Failed to fetch for ${player.lichessUsername}`, err);
        // fall through to trailing delay
      } finally {
        // Always wait between players, including after a rate limit or
        // error, so we don't immediately hammer the next request.
        await sleep(1000);
      }
    }

    const syncTime = new Date();
    const existingSettings = await db.select().from(eventSettings).limit(1);
    if (existingSettings.length === 0) {
      await db.insert(eventSettings).values({ lastSyncAt: syncTime });
    } else {
      await db.update(eventSettings).set({ lastSyncAt: syncTime }).where(eq(eventSettings.id, existingSettings[0].id));
    }

    // Update is_leader atomically so there's never a moment with zero
    // or multiple leaders, and so overlapping runs can't interleave.
    await db.transaction(async (tx) => {
      await tx.update(players).set({ isLeader: false });
      const topPlayers = await tx
        .select()
        .from(players)
        .orderBy(sql`${players.currentRating} DESC`)
        .limit(1);
      if (topPlayers.length > 0) {
        await tx.update(players).set({ isLeader: true }).where(eq(players.id, topPlayers[0].id));
      }
    });

    // Wipe the frontend public cache so leaderboard updates immediately
    try {
      const { setCachedData } = await import("./public");
      setCachedData("leaderboard_teams_rating", null);
      setCachedData("leaderboard_students_rating", null);
    } catch (e) {
      console.error("Failed to invalidate leaderboard cache:", e);
    }

    lastCronHealth.lastSync = syncTime.toISOString();
    lastCronHealth.status = "Success";
    lastCronHealth.message = "Sync complete";
    return { success: true, message: "Sync complete" };
  } catch (error: any) {
    lastCronHealth.lastSync = new Date().toISOString();
    lastCronHealth.status = "Failed";
    lastCronHealth.message = error.message || "Unknown error";
    throw error;
  } finally {
    isSyncRunning = false;
  }
}

cronRouter.post("/sync-lichess", async (req, res) => {
  // Fail closed: if CRON_SECRET isn't configured, refuse all requests
  // instead of silently allowing unauthenticated access.
  if (!process.env.CRON_SECRET) {
    console.error("CRON_SECRET is not set; refusing sync request");
    res.status(500).json({ error: "Server misconfigured: CRON_SECRET not set" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized cron access" });
    return;
  }

  if (isSyncRunning) {
    res.status(409).json({ success: false, message: "Sync already in progress" });
    return;
  }

  try {
    // Run in the background so the request doesn't hang
    runLichessSync().catch((err) => console.error("Background sync failed:", err));
    res.json({ success: true, message: "Sync started in background" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
