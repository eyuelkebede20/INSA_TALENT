import { Router } from "express";
import { db } from "../db";
import { players, teams, eventSettings, user, webinarRegistrations } from "../db/schema";
import { sql, eq } from "drizzle-orm";
import { deletePlayer, updateTeamLocks } from "../services/admin";
import { assignPlayerToTeam } from "../services/eos";
import jwt from "jsonwebtoken";

export const adminRouter = Router();

adminRouter.post("/login", (req, res) => {
    let { password } = req.body;
    password = typeof password === 'string' ? password.replace(/[<>'"]/g, '').trim() : '';
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

adminRouter.get("/export-csv", async (req, res) => {
    try {
        const allPlayers = await db.select().from(players);
        let csv = "Name,Email,INSA_ID,Lichess,Chesscom,Rating,Tier,Team_ID\n";
        for (const p of allPlayers) {
            csv += `"${p.realName || ''}","${p.email || ''}","${p.insaCode || ''}","${p.lichessUsername || ''}","${p.chesscomUsername || ''}","${p.currentRating || 0}","${p.tier || ''}","${p.teamId || ''}"\n`;
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="players.csv"');
        res.send(csv);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

adminRouter.delete("/players/:id", async (req, res) => {
    try {
        await deletePlayer(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

adminRouter.post("/reassign", async (req, res) => {
    try {
        const { player_id, target_team_id } = req.body;
        await db.update(players).set({ teamId: target_team_id }).where(eq(players.id, player_id));
        await updateTeamLocks();
        const { cleanupEmptyTeams } = require('../services/admin');
        await cleanupEmptyTeams();
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

adminRouter.post("/settings", async (req, res) => {
    try {
        const { advanced_threshold, mid_threshold, registration_open } = req.body;
        
        await db.transaction(async (tx: any) => {
            const settingsRes = await tx.execute(sql`SELECT * FROM event_settings LIMIT 1`);
            if (settingsRes.length === 0) {
                await tx.insert(eventSettings).values({ advancedThreshold: advanced_threshold, midThreshold: mid_threshold, registrationOpen: registration_open !== undefined ? registration_open : true });
            } else {
                await tx.update(eventSettings).set({ advancedThreshold: advanced_threshold, midThreshold: mid_threshold, registrationOpen: registration_open !== undefined ? registration_open : true });
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
                    await tx.update(players).set({ tier: newTier }).where(eq(players.id, p.id));
                }
            }
        });
        
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

adminRouter.get("/settings", async (req, res) => {
    try {
        const settingsRes = await db.execute(sql`SELECT * FROM event_settings LIMIT 1`);
        const settings = settingsRes[0] || { advanced_threshold: 1200, mid_threshold: 600, registration_open: true };
        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

adminRouter.post("/regroup", async (req, res) => {
    try {
        await db.transaction(async (tx: any) => {
            // 1. Unassign all players
            await tx.update(players).set({ teamId: null });
            
            // 2. Fetch all players sorted by rating descending
            const allPlayers = await tx.select().from(players).orderBy(sql`${players.currentRating} DESC`);
            
            // 3. Re-run assignment logic for every single player
            for (const player of allPlayers) {
                await assignPlayerToTeam(player.id, player.tier, tx);
            }
            await updateTeamLocks(tx);
            const { cleanupEmptyTeams } = require('../services/admin');
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

import { lastCronHealth, runLichessSync } from "./cron";
adminRouter.get("/cron-health", async (req, res) => {
    try {
        const settingsRes = await db.execute(sql`SELECT last_sync_at FROM event_settings LIMIT 1`);
        let persistedLastSync = settingsRes[0]?.last_sync_at as string | undefined;
        
        // If in-memory status says "never run" but we have a date in DB, we know it ran before restart
        let responseHealth = { ...lastCronHealth };
        
        if (persistedLastSync && !responseHealth.lastSync) {
            responseHealth.lastSync = persistedLastSync;
            responseHealth.status = "Success (From DB)";
            responseHealth.message = "Loaded from previous run";
        } else if (responseHealth.lastSync && !persistedLastSync) {
            // Update the DB if memory is ahead
            await db.execute(sql`UPDATE event_settings SET last_sync_at = ${responseHealth.lastSync}`);
        } else if (responseHealth.lastSync && persistedLastSync) {
            // Both exist, use the most recent one.
            const memTime = new Date(responseHealth.lastSync).getTime();
            const dbTime = new Date(persistedLastSync).getTime();
            
            if (dbTime > memTime) {
                responseHealth.lastSync = persistedLastSync;
            }
        }
        
        res.json(responseHealth);
    } catch (err) {
        res.json(lastCronHealth);
    }
});

adminRouter.post("/force-sync", (req, res) => {
    // Fire and forget so we don't timeout on Vercel proxy
    runLichessSync().catch(console.error);
    res.json({ success: true, message: "Sync started in background" });
});

adminRouter.get("/webinar-registrations", async (req, res) => {
    try {
        const registrations = await db.select({
            id: webinarRegistrations.id,
            userId: webinarRegistrations.userId,
            userName: webinarRegistrations.name,
            userEmail: webinarRegistrations.email,
            bankRefNumber: webinarRegistrations.bankRefNumber,
            screenshotData: webinarRegistrations.screenshotData,
            status: webinarRegistrations.status,
            createdAt: webinarRegistrations.createdAt
        }).from(webinarRegistrations)
        .orderBy(sql`${webinarRegistrations.createdAt} DESC`);
        
        res.json(registrations);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

adminRouter.post("/webinar-registrations/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        if (!['PENDING', 'ACCEPTED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        await db.update(webinarRegistrations)
            .set({ status })
            .where(eq(webinarRegistrations.id, parseInt(req.params.id)));
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

adminRouter.get("/export-webinar-csv", async (req, res) => {
    try {
        const accepted = await db.select().from(webinarRegistrations).where(eq(webinarRegistrations.status, 'ACCEPTED'));
        
        let csv = "Name,Email,BankRef,RegisteredAt\n";
        for (const reg of accepted) {
            // Escape quotes and wrap in quotes for CSV safety
            const name = `"${reg.name.replace(/"/g, '""')}"`;
            const email = `"${reg.email.replace(/"/g, '""')}"`;
            const bankRef = `"${reg.bankRefNumber.replace(/"/g, '""')}"`;
            const date = `"${reg.createdAt.toISOString()}"`;
            
            csv += `${name},${email},${bankRef},${date}\n`;
        }
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="webinar_registrations.csv"');
        res.send(csv);
    } catch (err: any) {
        res.status(500).send(err.message);
    }
});
