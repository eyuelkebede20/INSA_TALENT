import { Router } from "express";
import { db } from "../db";
import { players } from "../db/schema";
import { assignPlayerToTeam } from "../services/eos";
import { sql } from "drizzle-orm";
import { auth } from "../auth";
import { fromNodeHeaders } from "better-auth/node";
import { studentFeedbacks } from "../db/schema";

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
        const authSession = await auth.api.getSession({ headers: req.headers });
        if (!authSession?.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { lichess_username, chesscom_username, manual_rating, insa_code } = req.body;
        if (!lichess_username && !chesscom_username && !manual_rating) {
            return res.status(400).json({ error: "Must provide Lichess, Chess.com, or Manual Rating" });
        }
        if (!insa_code) {
            return res.status(400).json({ error: "INSA code is required" });
        }

        let rating = 1000;
        let finalLichess = lichess_username || null;
        let finalChesscom = chesscom_username || null;
        let foundRating = false;

        if (lichess_username && !foundRating) {
            try {
                const resp = await fetch(`https://lichess.org/api/user/${lichess_username}`);
                if (resp.ok) {
                    const data = await resp.json();
                    rating = data.perfs?.blitz?.rating || data.perfs?.rapid?.rating || 1000;
                    foundRating = true;
                }
            } catch (e) {
                // Ignore and fall back
            }
        } 
        
        if (chesscom_username && !foundRating) {
            try {
                const resp = await fetch(`https://api.chess.com/pub/player/${chesscom_username}/stats`);
                if (resp.ok) {
                    const data = await resp.json();
                    rating = data.chess_blitz?.last?.rating || data.chess_rapid?.last?.rating || 1000;
                    foundRating = true;
                }
            } catch (e) {
                // Ignore and fall back
            }
        } 
        
        if (manual_rating && !foundRating) {
            rating = manual_rating;
            foundRating = true;
        }

        if (!foundRating && !manual_rating) {
             rating = 1000; // ultimate fallback
        }

        const settingsRes = await db.execute(sql`SELECT advanced_threshold, mid_threshold FROM event_settings LIMIT 1`);
        const settings: any = settingsRes[0] || { advanced_threshold: 1200, mid_threshold: 600 };

        let newTier: "ADVANCED" | "MID" | "BEGINNER" = "BEGINNER";
        if (rating >= settings.advanced_threshold) newTier = "ADVANCED";
        else if (rating >= settings.mid_threshold) newTier = "MID";

        await db.transaction(async (tx: any) => {
            const [newPlayer] = await tx.insert(players).values({
                googleId: authSession.user.id,
                email: authSession.user.email,
                realName: authSession.user.name,
                lichessUsername: finalLichess,
                chesscomUsername: finalChesscom,
                insaCode: insa_code,
                currentRating: rating,
                tier: newTier
            }).returning();

            await assignPlayerToTeam(newPlayer.id, newTier, tx);
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

studentRouter.post("/feedback", async (req, res) => {
    try {
        const user = (req as any).user;
        const { message } = req.body;
        
        if (!message) return res.status(400).json({ error: "Message is required" });

        const playerRes = await db.execute(sql`SELECT id FROM players WHERE google_id = ${user.id}`);
        if (!playerRes[0]) return res.status(403).json({ error: "Complete your profile first" });

        await db.insert(studentFeedbacks).values({
            playerId: playerRes[0].id,
            message: message
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
