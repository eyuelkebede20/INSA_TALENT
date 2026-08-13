import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export const publicRouter = Router();

// Simple in-memory cache to handle traffic spikes and prevent DB overload
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 1000; // 15 seconds TTL

const getCachedData = (key: string) => {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }
    return null;
};

const setCachedData = (key: string, data: any) => {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

publicRouter.get("/canvas", async (req, res) => {
    try {
        const cacheKey = "canvas";
        const cached = getCachedData(cacheKey);
        if (cached) return res.json(cached);

        const allTeams = await db.execute(sql`
            SELECT t.id, t.team_number, t.is_locked, 
                   json_agg(json_build_object('name', p.real_name, 'tier', p.tier, 'rating', p.current_rating, 'insa_code', p.insa_code, 'lichess_username', p.lichess_username)) as members
            FROM teams t
            LEFT JOIN players p ON p.team_id = t.id
            GROUP BY t.id
            ORDER BY t.team_number ASC
        `);
        
        setCachedData(cacheKey, allTeams);
        res.json(allTeams);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

publicRouter.get("/leaderboard/students", async (req, res) => {
    try {
        const cacheKey = "leaderboard_students";
        const cached = getCachedData(cacheKey);
        if (cached) return res.json(cached);

        const students = await db.execute(sql`
            SELECT p.real_name, p.tier, p.current_rating, p.lichess_username, t.team_number, p.insa_code,
                   COALESCE((SELECT SUM(wins + losses + draws) FROM player_daily_stats WHERE player_id = p.id), 0) as games_played_today
            FROM players p
            LEFT JOIN teams t ON p.team_id = t.id
            ORDER BY p.current_rating DESC
            LIMIT 100
        `);
        
        setCachedData(cacheKey, students);
        res.json(students);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

publicRouter.get("/leaderboard/teams/rating", async (req, res) => {
    try {
        const cacheKey = "leaderboard_teams_rating";
        const cached = getCachedData(cacheKey);
        if (cached) return res.json(cached);

        const teams = await db.execute(sql`
            SELECT 
                t.team_number, 
                COALESCE(SUM(ds.wins), 0) as total_wins,
                COALESCE(SUM(ds.losses), 0) as total_losses,
                COALESCE(SUM(ds.draws), 0) as total_draws,
                (COALESCE(SUM(ds.wins), 0) * 3) + COALESCE(SUM(ds.draws), 0) as total_rating
            FROM teams t
            JOIN players p ON p.team_id = t.id
            LEFT JOIN player_daily_stats ds ON ds.player_id = p.id
            GROUP BY t.team_number
            ORDER BY total_rating DESC, total_wins DESC
        `);
        
        setCachedData(cacheKey, teams);
        res.json(teams);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
