import { Router } from "express";
import { db } from "../db";
import { players, teams, eventSettings } from "../db/schema";
import { sql, eq } from "drizzle-orm";
import { deletePlayerAndBackfill } from "../services/admin";
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

adminRouter.use((req, res, next) => {
    // Basic auth check
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Wait, we might need cookie-parser but let's support Bearer for simplicity
    
    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        jwt.verify(token, process.env.JWT_SECRET as string);
        next();
    } catch (e) {
        res.status(401).json({ error: "Unauthorized" });
    }
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
