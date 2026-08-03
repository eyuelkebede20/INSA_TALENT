import { Router } from "express";
import { db } from "../db";
import { players } from "../db/schema";
import { assignPlayerToTeam } from "../services/eos";
import { sql } from "drizzle-orm";
import { auth } from "../auth";
import { fromNodeHeaders } from "better-auth/node";

export const studentRouter = Router();

// Middleware to require authentication
studentRouter.use(async (req, res, next) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers)
        });
        if (!session) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        (req as any).user = session.user;
        next();
    } catch (e) {
        res.status(401).json({ error: "Unauthorized" });
    }
});

studentRouter.post("/complete-profile", async (req, res) => {
    try {
        const user = (req as any).user;
        const { lichess_username, chesscom_username, insa_code, manual_rating } = req.body;

        // In a real scenario, we fetch from Lichess API here
        let highestRating = manual_rating || 1000; 

        const settingsRes = await db.execute(sql`SELECT advanced_threshold, mid_threshold FROM event_settings LIMIT 1`);
        const settings: any = settingsRes[0] || { advanced_threshold: 1200, mid_threshold: 600 };

        let tier: "ADVANCED" | "MID" | "BEGINNER" = "BEGINNER";
        if (highestRating >= settings.advanced_threshold) tier = "ADVANCED";
        else if (highestRating >= settings.mid_threshold) tier = "MID";

        await db.transaction(async (tx: any) => {
            const newPlayer = await tx.insert(players).values({
                email: user.email,
                googleId: user.id,
                realName: user.name,
                lichessUsername: lichess_username,
                chesscomUsername: chesscom_username,
                insaCode: insa_code,
                currentRating: highestRating,
                tier
            }).returning();

            await assignPlayerToTeam(newPlayer[0].id, tier, tx);
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

studentRouter.get("/me", async (req, res) => {
    try {
        const user = (req as any).user;
        const playerRes = await db.execute(sql`
            SELECT p.*, t.team_number, t.is_locked 
            FROM players p 
            LEFT JOIN teams t ON p.team_id = t.id 
            WHERE p.google_id = ${user.id}
        `);
        res.json({ profile: playerRes[0] || null });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
