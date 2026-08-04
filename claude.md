# INSA_TALENT — Project Reference (CLAUDE.md)
Source of truth for the INSA_TALENT chess event platform. Update this file whenever architecture, schema, or scope decisions change.

## 1. Product Summary
A web app for an in-person chess learning event with 300+ students.

**Auth:** Students sign in with Google OAuth to prevent identity spoofing.

**Profile Completion & Signup:** After OAuth, users provide their `lichess_username`, 4-digit INSA ID (`CTC-XXXX-26` layout), and an optional `chesscom_username`. 
- **CRITICAL CHANGE:** The very first thing a user does in this form is select their specific group number. 
- Once submitted, these details are permanently locked for the student. Only a Superadmin can edit them later.

**Grouping Logic (Self-Selection):** Users manually select their team/group number during signup. The old "Earliest Open Slot" automatic sorting is bypassed for general signups.

**Team Composition:** Max 11 players per team.
- The structure of "8-2-1" (8 Beginners, 2 Mid, 1 Advanced) is now a **visual target and badge system** rather than a strict locking requirement.
- **Team Leader:** The team leader is dynamic. The player with the highest chess rating in a given team automatically becomes the leader.

**Leaderboards (Refreshed via scheduled syncs):**
- **Individual Student Leaderboard** — Ranks individual students (e.g., by individual net wins or rating progression).
- **Team Net Wins Leaderboard** — (wins - losses) delta per player since the last sync, summed per team.
- **Team Rating Leaderboard** — Sum of current team ratings.
- **Export Feature** — All leaderboards must support exporting as shareable PNGs at the end of the event.

**Superadmin Dashboard:**
- **Finite Canvas Drag-and-Drop:** Admin has a finite visual canvas where they can drag and drop students from one group to another to rebalance or manually assign players.
- **Nuclear Regroup Button:** A special key/button for the Superadmin. If there is a massive imbalance or miss on the first day, this button completely wipes all current team assignments and re-sorts everyone automatically based on the old Earliest Open Slot logic to fix imbalances. **Requires a confirmation popup.**
- Admin can update event settings (e.g., lower the Advanced threshold from 1200 to 1000). 
- Admin can delete a user (e.g., if they used a wrong account).
- Empty ghost teams are actively garbage-collected from the database.

**Explicitly out of scope for Phase 1 (v2 candidate):** League/bracket management, Swiss-system pairing, match trees, board-order (1v1..7v7) match scoring.

## 2. Core Business Rules
**Badges (Tiers):** Default Advanced > 1200, Mid 600–1200, Beginner < 600. The Advanced threshold is admin-configurable via an `event_settings` table. These tiers serve purely as badges for users and visual targets (the 8-2-1 goal) for the teams, but do not strictly prevent team formation.

**Rating Selection:** Lichess maintains ratings for multiple time controls (bullet, blitz, rapid, classical). The system will fetch all of them and take whichever rating is the **highest**.

**Multi-platform rating:** If a student provides both Lichess and Chess.com, the backend fetches both and assigns their initial tier based on the higher rating overall.

**Net Wins Tracking:** The scheduled cron job ONLY tracks Lichess games. Chess.com is completely ignored for leaderboard progression.

**Manual Fallback:** If rating APIs fail during signup, the user can manually input their rating. The scheduled cron job will eventually overwrite this with the real API data.

**Dynamic Team Leader:** Since the team leader is determined by highest rating, any time ratings are updated (via cron job) or a new superior player joins a team, the leadership role may automatically transfer.

**Public Canvas:** An unauthenticated infinite workspace where students can pan/zoom to find their team. They can search by Name, Username, or INSA ID. The canvas will automatically zoom and center on a player if the search narrows to exactly one result.

## 3. Architecture
```plaintext
Lichess/Chess.com APIs (GET /api/user/:username)
│ (on signup: GET max rating; scheduled: batched sync)
▼
┌────────────────┐        ┌──────────────────────────┐       ┌──────────────────┐
│ Student Client │───────▶│  Node.js / Express API   │◀──────│   Admin Client   │
│ (signup + LB)  │        │ (TypeScript, on Render)  │       │  (finite canvas) │
└────────────────┘        └────────────┬─────────────┘       └──────────────────┘
                                       ▼
                          ┌──────────────────────────┐
                          │ PostgreSQL (Neon/Supabase)│
                          │     via Drizzle ORM      │
                          └──────────────────────────┘
```

**Frontend:** React (Vite) + Tailwind + motion/react (for layout animations). 
- **State Management:** React Query for data fetching and caching, Zustand for global UI state.
- **Exporting:** `html-to-image` for perfectly crisp PNG exports of the Leaderboard.
- **Error Handling**: `sonner` is used globally for rich, non-blocking toast notifications.

**Backend:** Node.js + Express + TypeScript, deployed on Render.

**Database:** PostgreSQL via Drizzle ORM (Neon / Supabase).

**Authentication (Students):** Better Auth or Supabase Auth configured for Google OAuth only.

**Authentication (Admin):** Stateless — `ADMIN_PASSWORD` + `JWT_SECRET` in env vars. Password check → signed JWT → HttpOnly cookie middleware guards `/api/admin/*`.

**Scheduler & Rate Limiting:** 
- To respect Lichess API limits, the 12-hour sync is divided into **batched chunks**. 
- A background worker (e.g., Upstash QStash or a robust queue) processes chunks slowly.
- Results are temporarily stored and only released to the live leaderboard at the end of the entire batch process to ensure consistency.

**Drag & drop:** `@hello-pangea/dnd` or native HTML5 / Motion layout tracking (applied to the Admin's Finite Canvas).

## 4. Data Schema (PostgreSQL / Drizzle)
```typescript
import { relations } from 'drizzle-orm';
import { pgTable, serial, varchar, integer, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';

export const tierEnum = pgEnum('tier', ['ADVANCED', 'MID', 'BEGINNER']);

export const eventSettings = pgTable('event_settings', {
  id: serial('id').primaryKey(),
  advancedThreshold: integer('advanced_threshold').default(1200).notNull(),
  midThreshold: integer('mid_threshold').default(600).notNull(),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  teamNumber: integer('team_number').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  googleId: varchar('google_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  realName: varchar('real_name', { length: 100 }).notNull(),
  lichessUsername: varchar('lichess_username', { length: 100 }).unique(),
  chesscomUsername: varchar('chesscom_username', { length: 100 }).unique(),
  insaCode: varchar('insa_code', { length: 50 }).unique(),
  currentRating: integer('current_rating').notNull(),
  tier: tierEnum('tier').notNull(),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const playerDailyStats = pgTable('player_daily_stats', {
  id: serial('id').primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  wins: integer('wins').notNull(),
  losses: integer('losses').notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
});

export const teamsRelations = relations(teams, ({ many }) => ({ players: many(players) }));
export const playersRelations = relations(players, ({ one, many }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
  dailyStats: many(playerDailyStats),
}));
```

## 5. Core Algorithm — Self-Selection & Nuclear Regroup
Since the primary joining mechanism is now self-selection, the Earliest Open Slot logic is reserved entirely for the Admin's **Nuclear Regroup** feature.

```typescript
// Pseudocode for Allocation Logic (Admin Regroup Only)
async function assignPlayerToTeam(playerId: string, playerTier: string, tx: any) {
  // Target structure: 1 Advanced, 2 Mid, 8 Beginner
  const maxCapacity = playerTier === 'ADVANCED' ? 1 : playerTier === 'MID' ? 2 : 8;

  // 1. Find the earliest team with room for this tier
  const targetTeam = await tx.execute(sql`
    SELECT t.id FROM teams t 
    LEFT JOIN players p ON p.team_id = t.id AND p.tier = ${playerTier}
    GROUP BY t.id, t.team_number
    HAVING COUNT(p.id) < ${maxCapacity}
    ORDER BY t.team_number ASC 
    LIMIT 1
  `);

  let teamId = targetTeam[0]?.id;

  // 2. If no open team exists, create a new one
  if (!teamId) {
    const newTeam = await tx.insert(teams).values({
      teamNumber: await getNextTeamNumber(tx)
    }).returning();
    teamId = newTeam[0].id;
  }

  // 3. Assign the player
  await tx.update(players).set({ teamId }).where(eq(players.id, playerId));
}

// Pseudocode for Nuclear Regroup
async function performNuclearRegroup(tx: any) {
  // 1. Unassign all players
  await tx.update(players).set({ teamId: null });
  // 2. Fetch all players sorted by rating descending
  const allPlayers = await tx.select().from(players).orderBy(desc(players.currentRating));
  // 3. Re-run assignment logic for every single player
  for (const player of allPlayers) {
    await assignPlayerToTeam(player.id, player.tier, tx);
  }
}
```

## 6. API Endpoints
**Auth**
- `GET /api/auth/google` — Initiates Google OAuth.
- `POST /api/admin/login` — `{ password }` → Sets HttpOnly JWT cookie for Superadmin.

**Students**
- `POST /api/students/complete-profile` — `{ group_number, chesscom_username?, insa_code, lichess_username }` → Fetches max rating, assigns tier (badge), and places user in `group_number` manually.
- `GET /api/students/me` — Returns session user profile and current `team_number`.

**Canvas & Leaderboards (Public)**
- `GET /api/canvas` — Returns all teams and basic player info (name, tier, rating, insa_code). Dynamic Team Leader derived via max rating.
- `GET /api/leaderboard/students` — Ranked individual students, paginated UI (10/page) with deep search filtering.
- `GET /api/leaderboard/teams/rating` — Ranked teams by summed rating or daily delta.
- `GET /api/leaderboard/teams/net-wins` — Ranked teams by `(wins_now - wins_prev) - (losses_now - losses_prev)`.

**Superadmin (Requires JWT Cookie)**
- `GET /api/admin/teams` — Same as canvas but includes full data (`insa_code`, etc).
- `POST /api/admin/reassign` — `{ player_id, target_team_id }` → Forces player into a team (via Finite Canvas Drag-and-Drop).
- `POST /api/admin/regroup` — Nuclear Regroup button endpoint. Clears all assignments and reconstructs teams using automatic sorting logic.
- `POST /api/admin/settings` — Updates `event_settings` (e.g., changes Advanced threshold).
- `DELETE /api/admin/players/:id` — Deletes a user.

**Scheduled**
- `POST /api/cron/sync-lichess-queue` — Triggers a batch job that sequentially pulls Lichess stats in chunks (with delays) to respect API rate limits. Writes to `player_daily_stats` when all chunks are completely resolved. Leadership is re-evaluated dynamically on the frontend/backend when these stats update.

## 7. V1 Final Status & Key Technical Fixes (Hand-off to V2)
All major V1 milestones have been completed and are running in production. When planning V2, please note the following architectural realities and late-stage V1 fixes:

1. **Domain & CORS Topology:** The frontend was successfully migrated from `insa-talent.vercel.app` to `insa-aca.vercel.app`. However, the backend is **still hosted** at `insa-talent-1.onrender.com`. The Express CORS policy and `better-auth` configuration have been strictly updated to safely support cross-origin communication between the `insa-aca` frontend and the `insa-talent` backend.
2. **UI & Badges (Minimalism):** We completely removed literal text badges for tiers ("ADVANCED", "MID", "BEGINNER") and literal "Leader" badges from the Canvas and Admin UI. Instead, the UI relies strictly on **color-coded dots** (`bg-secondary` for Advanced, `bg-accent` for Mid, `bg-primary` for Beginner) to keep the canvas clean.
3. **Sorting Priorities:** Players rendered inside any team (Public Canvas or Admin Dashboard) are now strictly sorted on the frontend. Order of precedence: Tier (Advanced → Mid → Beginner), followed by Rating (Highest → Lowest).
4. **Admin Dashboard (Finite Canvas):** The admin panel uses `@hello-pangea/dnd` to provide a drag-and-drop finite canvas for manually reassigning players across teams. It also houses the "Nuclear Regroup" button which triggers `/api/admin/regroup` to wipe and optimally re-sort the entire database using the EOS algorithm.
5. **Hotfixes Applied:** 
   - Addressed a Node crash on Render caused by an unused `checkAndLockTeam` import in `admin.ts`.
   - Updated the GitHub Actions cron (`.github/workflows/cron.yml`) to correctly point to the live `insa-talent-1.onrender.com` backend URL.
   - Reverted a misconfigured frontend API fallback that temporarily pointed to a non-existent `insa-aca-1.onrender.com` backend.

All `tasks.md` items have been cleared. The codebase is stable, type-safe, and ready for V2 feature scoping (e.g., bracket management, Swiss-system pairing).
