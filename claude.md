# INSA_TALENT — Project Reference (CLAUDE.md)
Source of truth for the INSA_TALENT chess event platform. Update this file whenever architecture, schema, or scope decisions change.

## 1. Product Summary
A web app for an in-person chess learning event with 300+ students.

**Auth:** Students sign in with Google OAuth to prevent identity spoofing, and must link their Lichess account via Lichess OAuth (to guarantee account ownership).

**Profile Completion:** After OAuth, users must provide their `insa_code` and an optional `chesscom_username`.

**Grouping Logic:** Earliest Open Slot (FCFS-based). Students are instantly slotted into partial grids.

**Team Composition:** Exactly 7 players (1 Advanced, 2 Mid, 4 Beginner). Once a team reaches this exact ratio, it locks.

**Leaderboards (Refreshed via scheduled syncs):**
- **Individual Student Leaderboard** — Ranks individual students (e.g., by individual net wins or rating progression).
- **Team Net Wins Leaderboard** — (wins - losses) delta per player since the last sync, summed per team.
- **Team Rating Leaderboard** — Sum of current team ratings.
- **Export Feature** — All leaderboards must support exporting as shareable PNGs at the end of the event.

**Superadmin Dashboard:**
- Drag-and-drop to rebalance or manually assign players.
- Admin can update event settings (e.g., lower the Advanced threshold from 1200 to 1000).
- Admin is the only entity that can modify a locked team via a 1-to-1 swap.
- Admin can delete a user (e.g., if they used a wrong account). If a user is deleted from a locked team, the system automatically triggers a cascade backfill, taking a player from the next available team to fill the spot and re-lock the team.

**Explicitly out of scope for Phase 1 (v2 candidate):** League/bracket management, Swiss-system pairing, match trees, board-order (1v1..7v7) match scoring.

## 2. Core Business Rules
**Tiers:** Default Advanced > 1200, Mid 600–1200, Beginner < 600. The Advanced threshold is admin-configurable via an `event_settings` table.

**Rating Selection:** Lichess maintains ratings for multiple time controls (bullet, blitz, rapid, classical). The system will fetch all of them and take whichever rating is the **highest**.

**Multi-platform rating:** If a student provides both Lichess and Chess.com, the backend fetches both and assigns their initial tier based on the higher rating overall.

**Net Wins Tracking:** The scheduled cron job ONLY tracks Lichess games. Chess.com is completely ignored for leaderboard progression.

**Manual Fallback:** If rating APIs fail during signup, the user can manually input their rating. The scheduled cron job will eventually overwrite this with the real API data. If the correction breaks a team's ratio, the backend will leave the locked team as-is. The admin must manually fix it.

**Locking Mechanism & Cascade Backfills:** 
- The moment a team hits 7 members (1 Adv, 2 Mid, 4 Beg), `is_locked` becomes true. 
- If the Superadmin deletes a player from a locked team, the system automatically searches the subsequent unlocked teams for a player of the same tier, moves them up to the incomplete team, and re-locks it.

**Public Canvas:** An unauthenticated page where students can pan/zoom to find their team number. Sensitive data (`insa_code`, email) must be omitted from this public endpoint.

## 3. Architecture
```plaintext
Lichess/Chess.com APIs (GET /api/user/:username)
│ (on signup: GET max rating; scheduled: batched sync)
▼
┌────────────────┐        ┌──────────────────────────┐       ┌──────────────────┐
│ Student Client │───────▶│  Node.js / Express API   │◀──────│   Admin Client   │
│ (signup + LB)  │        │ (TypeScript, on Render)  │       │  (drag & drop)   │
└────────────────┘        └────────────┬─────────────┘       └──────────────────┘
                                       ▼
                          ┌──────────────────────────┐
                          │ PostgreSQL (Neon/Supabase)│
                          │     via Drizzle ORM      │
                          └──────────────────────────┘
```

**Frontend:** React (Vite) + Tailwind + motion/react (for layout animations). 
- **State Management:** React Query for data fetching and caching, Zustand for global UI state.
- **Exporting:** `html2canvas` or `dom-to-image` to export the Leaderboard to a shareable PNG.

**Backend:** Node.js + Express + TypeScript, deployed on Render.

**Database:** PostgreSQL via Drizzle ORM (Neon / Supabase).

**Authentication (Students):** Better Auth or Supabase Auth configured for **both** Google OAuth and Lichess OAuth.

**Authentication (Admin):** Stateless — `ADMIN_PASSWORD` + `JWT_SECRET` in env vars. Password check → signed JWT → HttpOnly cookie middleware guards `/api/admin/*`.

**Scheduler & Rate Limiting:** 
- To respect Lichess API limits, the 12-hour sync is divided into **batched chunks**. 
- A background worker (e.g., Upstash QStash or a robust queue) processes chunks slowly.
- Results are temporarily stored and only released to the live leaderboard at the end of the entire batch process to ensure consistency.

**Drag & drop:** `@hello-pangea/dnd` or native HTML5 / Motion layout tracking.

## 4. Data Schema (PostgreSQL / Drizzle)
```typescript
import { relations } from 'drizzle-orm';
import { pgTable, serial, varchar, boolean, integer, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';

export const tierEnum = pgEnum('tier', ['ADVANCED', 'MID', 'BEGINNER']);

export const eventSettings = pgTable('event_settings', {
  id: serial('id').primaryKey(),
  advancedThreshold: integer('advanced_threshold').default(1200).notNull(),
  midThreshold: integer('mid_threshold').default(600).notNull(),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  teamNumber: integer('team_number').notNull().unique(),
  isLocked: boolean('is_locked').default(false).notNull(),
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

## 5. Core Algorithm — Earliest Open Slot Allocation
Instead of waiting for exact ratios, players are immediately slotted into the lowest team number with an open slot for their tier.

```typescript
// Pseudocode for Allocation Logic
async function assignPlayerToTeam(playerId: string, playerTier: string, tx: any) {
  const maxCapacity = playerTier === 'ADVANCED' ? 1 : playerTier === 'MID' ? 2 : 4;

  // 1. Find the earliest unlocked team with room for this tier
  const targetTeam = await tx.execute(sql`
    SELECT t.id FROM teams t 
    LEFT JOIN players p ON p.team_id = t.id AND p.tier = ${playerTier}
    WHERE t.is_locked = false
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

  // 4. Lock the team if it just reached exactly 7 members
  await checkAndLockTeam(teamId, tx);
}
```

**Threshold Recalculation & Backfilling (Admin Actions):**
- **When Admin Lowers `advanced_threshold`**: Detach players whose tier changes, sort by `created_at`, and run `assignPlayerToTeam` to cascade them.
- **When Admin Deletes a Player from a Locked Team**: Query the next unlocked team for a player of the missing tier. Move that player to the locked team. Loop `assignPlayerToTeam` for any remaining players that got displaced.

## 6. API Endpoints
**Auth**
- `GET /api/auth/google` — Initiates Google OAuth.
- `GET /api/auth/lichess` — Initiates Lichess OAuth (for verified usernames and ratings).
- `POST /api/admin/login` — `{ password }` → Sets HttpOnly JWT cookie for Superadmin.

**Students**
- `POST /api/students/complete-profile` — `{ chesscom_username?, insa_code }` → Fetches max rating across all connected platforms/time-controls, assigns tier, runs EOS grouping.
- `GET /api/students/me` — Returns session user profile and current `team_number`.

**Canvas & Leaderboards (Public)**
- `GET /api/canvas` — Returns all teams and basic player info (name, tier, rating). Strips email and `insa_code`.
- `GET /api/leaderboard/students` — Ranked individual students (by rating or net wins).
- `GET /api/leaderboard/teams/rating` — Ranked teams by summed rating.
- `GET /api/leaderboard/teams/net-wins` — Ranked teams by `(wins_now - wins_prev) - (losses_now - losses_prev)`.

**Superadmin (Requires JWT Cookie)**
- `GET /api/admin/teams` — Same as canvas but includes full data (`insa_code`, etc).
- `POST /api/admin/reassign` — `{ player_id, target_team_id }` → Forces player into a team (can break ratio, admin assumes responsibility).
- `POST /api/admin/exchange` — `{ player_id_1, player_id_2 }` → Swaps two players directly.
- `POST /api/admin/settings` — Updates `event_settings` (e.g., changes Advanced threshold and triggers cascade recalculation for unlocked teams).
- `DELETE /api/admin/players/:id` — Deletes a user and automatically triggers cascade backfill if the team was locked.

**Scheduled**
- `POST /api/cron/sync-lichess-queue` — Triggers a batch job that sequentially pulls Lichess stats in chunks (with delays) to respect API rate limits. Writes to `player_daily_stats` when all chunks are completely resolved.
