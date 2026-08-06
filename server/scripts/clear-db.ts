import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function clear() {
    console.log("Clearing database for production...");
    await db.execute(sql`TRUNCATE TABLE player_daily_stats, student_feedbacks, players, teams CASCADE`);
    console.log("Database cleared!");
    process.exit(0);
}

clear();
