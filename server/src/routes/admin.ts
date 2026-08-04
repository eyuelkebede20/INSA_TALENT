import { Router } from "express";
import { db } from "../db";
import { players, teams, eventSettings } from "../db/schema";
import { sql, eq } from "drizzle-orm";
import { deletePlayerAndBackfill, cascadeBackfill, cleanupEmptyTeams } from "../services/admin";
import { assignPlayerToTeam } from "../services/eos";
import jwt from "jsonwebtoken";

export const adminRouter = Router();

adminRouter.post("/login", (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET as string, { expiresIn: "1d" });
        res.cookie("admin_token", token, { httpOnly: true, secure: true, sameSite: 'none' });
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "Invalid password" });
    }
});

adminRouter.post("/logout", (req, res) => {
    res.clearCookie("admin_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none"
    });
    res.json({ success: true });
});

adminRouter.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader === `Bearer ${process.env.ADMIN_PASSWORD}`) {
        return next();
    }
    
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenMatch = cookies.match(/admin_token=([^;]+)/);
        if (tokenMatch && tokenMatch[1]) {
            try {
                jwt.verify(tokenMatch[1], process.env.JWT_SECRET as string);
                return next();
            } catch (err) {
                // fall through
            }
        }
    }

    res.status(401).json({ error: "Unauthorized" });
});

adminRouter.get("/teams", async (req, res) => {
    try {
        const allTeams = await db.execute(sql`
            SELECT t.id, t.team_number, t.is_locked, 
                   json_agg(json_build_object('id', p.id, 'name', p.real_name, 'tier', p.tier, 'rating', p.current_rating, 'insa_code', p.insa_code, 'email', p.email)) as members
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

adminRouter.delete("/players/:id", async (req, res) => {
    try {
        await deletePlayerAndBackfill(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

adminRouter.post("/reassign", async (req, res) => {
    try {
        const { player_id, target_team_id } = req.body;
        await db.update(players).set({ teamId: target_team_id }).where(eq(players.id, player_id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

adminRouter.post("/settings", async (req, res) => {
    try {
        const { advanced_threshold, mid_threshold } = req.body;
        
        await db.transaction(async (tx: any) => {
            const settingsRes = await tx.execute(sql`SELECT * FROM event_settings LIMIT 1`);
            if (settingsRes.length === 0) {
                await tx.insert(eventSettings).values({ advancedThreshold: advanced_threshold, midThreshold: mid_threshold });
            } else {
                await tx.update(eventSettings).set({ advancedThreshold: advanced_threshold, midThreshold: mid_threshold });
            }

            const allPlayers = await tx.execute(sql`
                SELECT p.id, p.current_rating, p.tier, p.team_id 
                FROM players p
                ORDER BY p.created_at ASC
            `);

            for (const p of allPlayers) {
                let newTier: "ADVANCED" | "MID" | "BEGINNER" = "BEGINNER";
                if (p.current_rating >= advanced_threshold) newTier = "ADVANCED";
                else if (p.current_rating >= mid_threshold) newTier = "MID";

                if (newTier !== p.tier) {
                    await tx.update(players).set({ teamId: null, tier: newTier }).where(eq(players.id, p.id));
                    if (p.team_id) {
                        await cascadeBackfill(p.team_id, p.tier, tx);
                    }
                    await assignPlayerToTeam(p.id, newTier, tx);
                }
            }
            await cleanupEmptyTeams(tx);
        });
        
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

adminRouter.get("/feedbacks", async (req, res) => {
    try {
        const feedbacks = await db.execute(sql`
            SELECT f.id, f.message, f.created_at, p.real_name, p.tier, t.team_number
            FROM student_feedbacks f
            JOIN players p ON f.player_id = p.id
            LEFT JOIN teams t ON p.team_id = t.id
            ORDER BY f.created_at DESC
        `);
        res.json(feedbacks);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
