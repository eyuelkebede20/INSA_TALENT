import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export const publicRouter = Router();

publicRouter.get("/canvas", async (req, res) => {
    try {
        const allTeams = await db.execute(sql`
            SELECT t.id, t.team_number, t.is_locked, 
                   json_agg(json_build_object('name', p.real_name, 'tier', p.tier, 'rating', p.current_rating, 'insa_code', p.insa_code, 'lichess_username', p.lichess_username)) as members
            FROM teams t
            LEFT JOIN players p ON p.team_id = t.id
            GROUP BY t.id
            ORDER BY t.team_number ASC
        `);
        res.json(allTeams);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

publicRouter.get("/leaderboard/students", async (req, res) => {
    try {
        const students = await db.execute(sql`
            SELECT p.real_name, p.tier, p.current_rating, p.lichess_username, t.team_number, p.insa_code
            FROM players p
            LEFT JOIN teams t ON p.team_id = t.id
            ORDER BY p.current_rating DESC
            LIMIT 100
        `);
        res.json(students);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

publicRouter.get("/leaderboard/teams/rating", async (req, res) => {
    try {
        const teams = await db.execute(sql`
            SELECT t.team_number, SUM(p.current_rating) as total_rating
            FROM teams t
            JOIN players p ON p.team_id = t.id
            GROUP BY t.team_number
            ORDER BY total_rating DESC
        `);
        res.json(teams);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
