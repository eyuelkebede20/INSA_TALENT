import { Router } from "express";
import { db } from "../db";
import { players, teams } from "../db/schema";
import { sql, eq } from "drizzle-orm";
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
        const authSession = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!authSession?.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const sanitizeText = (str: any) => typeof str === 'string' ? str.replace(/[<>'"]/g, '').trim() : str;
        
        const lichess_username = sanitizeText(req.body.lichess_username);
        const chesscom_username = sanitizeText(req.body.chesscom_username);
        const insa_code = sanitizeText(req.body.insa_code);
        const { manual_rating, group_number } = req.body;
        if (!group_number) {
            return res.status(400).json({ error: "Group number is required" });
        }
        if (Number(group_number) < 1 || Number(group_number) > 100) {
            return res.status(400).json({ error: "Team number must be between 1 and 100" });
        }
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

        let lichessRating = 0;
        let chesscomRating = 0;

        if (lichess_username) {
            try {
                const resp = await fetch(`https://lichess.org/api/user/${lichess_username}`);
                if (resp.ok) {
                    const data = await resp.json();
                    const perfs = data.perfs || {};
                    const getLichessGames = (perf: any) => perf?.games || 0;
                    const ratings = [
                        getLichessGames(perfs.blitz) >= 7 ? perfs.blitz?.rating : null,
                        getLichessGames(perfs.rapid) >= 7 ? perfs.rapid?.rating : null,
                        getLichessGames(perfs.bullet) >= 7 ? perfs.bullet?.rating : null,
                        getLichessGames(perfs.classical) >= 7 ? perfs.classical?.rating : null
                    ].filter(r => typeof r === 'number');
                    if (ratings.length > 0) lichessRating = Math.max(...ratings);
                }
            } catch (e) {
                // Ignore and fall back
            }
        } 
        
        if (chesscom_username) {
            try {
                const resp = await fetch(`https://api.chess.com/pub/player/${chesscom_username}/stats`);
                if (resp.ok) {
                    const data = await resp.json();
                    const getChesscomGames = (perf: any) => (perf?.record?.win || 0) + (perf?.record?.loss || 0) + (perf?.record?.draw || 0);
                    const ratings = [
                        getChesscomGames(data.chess_blitz) >= 7 ? data.chess_blitz?.last?.rating : null,
                        getChesscomGames(data.chess_rapid) >= 7 ? data.chess_rapid?.last?.rating : null,
                        getChesscomGames(data.chess_bullet) >= 7 ? data.chess_bullet?.last?.rating : null
                    ].filter(r => typeof r === 'number');
                    if (ratings.length > 0) chesscomRating = Math.max(...ratings);
                }
            } catch (e) {
                // Ignore and fall back
            }
        } 
        
        if (lichessRating > 0 || chesscomRating > 0) {
            rating = Math.max(lichessRating, chesscomRating);
            foundRating = true;
        }

        if (manual_rating && !foundRating) {
            rating = manual_rating;
            foundRating = true;
        }

        if (!foundRating && !manual_rating) {
             rating = 1000; // ultimate fallback
        }

        const settingsRes = await db.execute(sql`SELECT advanced_threshold, mid_threshold, registration_open FROM event_settings LIMIT 1`);
        const settings: any = settingsRes[0] || { advanced_threshold: 1200, mid_threshold: 600, registration_open: true };

        if (settings.registration_open === false) {
             return res.status(403).json({ error: "Registration is currently closed." });
        }

        let newTier: "ADVANCED" | "MID" | "BEGINNER" = "BEGINNER";
        if (rating >= settings.advanced_threshold) newTier = "ADVANCED";
        else if (rating >= settings.mid_threshold) newTier = "MID";

        await db.transaction(async (tx: any) => {
            let teamRes = await tx.execute(sql`SELECT id FROM teams WHERE team_number = ${group_number}`);
            let teamId = teamRes[0]?.id;
            
            if (!teamId) {
                const teamCountRes = await tx.execute(sql`SELECT COUNT(*) as count FROM teams`);
                const teamCount = Number(teamCountRes[0]?.count || 0);
                if (teamCount >= 100) {
                    throw new Error("Maximum number of teams (100) reached.");
                }

                const newTeam = await tx.insert(teams).values({
                    teamNumber: group_number,
                    isLocked: false
                }).returning();
                teamId = newTeam[0].id;
            } else {
                const maxCap = newTier === 'ADVANCED' ? 1 : newTier === 'MID' ? 2 : 8;
                const countRes = await tx.execute(sql`SELECT COUNT(*) as count FROM players WHERE team_id = ${teamId} AND tier = ${newTier}`);
                if (Number(countRes[0]?.count || 0) >= maxCap) {
                    throw new Error(`Team ${group_number} is already full for ${newTier} players.`);
                }
            }

            await tx.insert(players).values({
                googleId: authSession.user.id,
                email: authSession.user.email,
                realName: authSession.user.name,
                lichessUsername: finalLichess,
                chesscomUsername: finalChesscom,
                insaCode: insa_code,
                currentRating: rating,
                tier: newTier,
                teamId: teamId
            });

            const totalCountRes = await tx.execute(sql`SELECT COUNT(*) as count FROM players WHERE team_id = ${teamId}`);
            if (Number(totalCountRes[0]?.count || 0) === 11) {
                await tx.execute(sql`UPDATE teams SET is_locked = true WHERE id = ${teamId}`);
            }
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
        const rawMessage = req.body.message;
        const message = typeof rawMessage === 'string' ? rawMessage.replace(/[<>]/g, '').trim() : rawMessage;
        
        if (!message) return res.status(400).json({ error: "Message is required" });

        const playerRes = await db.execute(sql`SELECT id FROM players WHERE google_id = ${user.id}`);
        if (!playerRes[0]) return res.status(403).json({ error: "Complete your profile first" });

        await db.insert(studentFeedbacks).values({
            playerId: String(playerRes[0].id),
            message: message
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
