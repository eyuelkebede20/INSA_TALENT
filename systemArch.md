# System Architecture: INSA_TALENT Chess Platform

## 1. System Overview
The INSA_TALENT platform is an event management and live leaderboard system designed for a 300+ student chess event. It automates team formation based on skill tiers, fetches real-time stats from external chess APIs, and maintains competitive leaderboards. 

**Key Challenges Addressed:**
- **Concurrency & Race Conditions:** Handling 300 students signing up simultaneously without exceeding team limits.
- **External API Rate Limiting:** Syncing stats with Lichess without getting IP-banned.
- **Identity Integrity:** Preventing users from spoofing high-rated accounts.

---

## 2. High-Level Architecture Component Diagram

```mermaid
flowchart TD
    subgraph Clients
        StudentApp[Student Web App\nReact / Vite]
        AdminApp[Superadmin Dashboard\nReact / Vite]
        PublicCanvas[Public Canvas / Leaderboards\nReact]
    end

    subgraph API Layer (Render)
        Router[Express Router]
        AuthSvc[Auth Service]
        TeamEngine[EOS Allocation Engine]
        AdminSvc[Admin Operations]
    end

    subgraph Background Workers (Upstash / QStash)
        Cron[12-hour Cron Trigger]
        Queue[Batch Queue Worker]
    end

    subgraph Data Persistence
        DB[(PostgreSQL\nNeon / Supabase)]
        ORM[Drizzle ORM]
    end

    subgraph External Dependencies
        GoogleOAuth[Google OAuth API]
        LichessAPI[Lichess API / OAuth]
        ChessComAPI[Chess.com API]
    end

    %% Connections
    StudentApp --> Router
    AdminApp --> Router
    PublicCanvas --> Router
    Router --> AuthSvc & TeamEngine & AdminSvc
    TeamEngine & AdminSvc --> ORM
    AuthSvc --> GoogleOAuth & LichessAPI
    
    Cron --> Queue
    Queue --> LichessAPI
    Queue --> ORM
    
    ORM --> DB
```

---

## 3. Component Details & Technical Choices

### 3.1. Frontend (Client-Side)
- **Framework:** React + Vite for fast HMR and optimized builds.
- **Styling:** Tailwind CSS + `motion/react` for complex drag-and-drop and fluid layout animations on the Public Canvas.
- **State Management:**
  - **Server State:** `React Query` (@tanstack/react-query) for data fetching, caching, and background refetching (especially for the canvas).
  - **Client State:** `Zustand` for UI state (e.g., admin drag-and-drop selections, modal states).
- **Leaderboard Export:** `html2canvas` or `dom-to-image` runs client-side to generate downloadable PNGs of the leaderboard tables.

### 3.2. Backend (API Layer)
- **Runtime/Framework:** Node.js + Express + TypeScript.
- **Authentication:**
  - **Students:** Handled via Better Auth or Supabase Auth. Uses **Google OAuth** for primary identity. Users manually input their Lichess/Chess.com usernames during onboarding, after which they are locked and can only be modified by a Superadmin.
  - **Admin:** Stateless JWTs via HttpOnly secure cookies. Prevents XSS attacks.
- **Database Access:** Drizzle ORM ensures type safety between PostgreSQL schemas and TypeScript business logic.

---

## 4. Core Subsystems

### 4.1. The Earliest Open Slot (EOS) Engine
The EOS Engine handles the automated grouping logic. Because multiple students might sign up at the exact same millisecond, the allocation runs inside an **ACID-compliant Database Transaction** with row-level locks.

1. **Transaction Start:** Lock the `teams` and `players` table for the specific tier.
2. **Query:** Find the lowest `team_number` where `is_locked = false` and `COUNT(tier_players) < MaxCapacity`.
3. **Assign:** Update the player's `team_id`.
4. **Evaluate:** If the team now has exactly 7 members (1 Adv, 2 Mid, 4 Beg), set `is_locked = true`.
5. **Commit.**

### 4.2. Cascade Backfill (Admin Mutation)
When an admin manually deletes a user from a `locked` team:
1. The team instantly becomes `is_locked = false`.
2. A database query locates the oldest created player of the missing tier from the next available *unlocked* team.
3. The selected player's `team_id` is updated to the newly opened team.
4. The backfilled team returns to `is_locked = true`.
5. The engine recurses down to fix the gap left in the subsequent unlocked team if necessary.

---

## 5. Background Sync & Rate Limiting Strategy
Lichess has strict rate limits. Querying 300+ profiles simultaneously will result in `429 Too Many Requests`.

**The Sync Pipeline:**
1. **Trigger:** A cron job fires every 12 hours.
2. **Batching:** The backend queries the DB for all registered `lichess_username`s and chunks them into arrays of ~30 users.
3. **Queueing:** Each chunk is dispatched to a background queue (e.g., QStash) with a staggered delay (e.g., Chunk 1 executes at T+0s, Chunk 2 at T+10s).
4. **Execution:** 
   - Worker hits `POST https://lichess.org/api/users` (which allows fetching up to 300 users in one request, but we chunk smaller to be safe and handle network timeouts).
   - The worker calculates the highest rating (Bullet/Blitz/Rapid/Classical) and the net wins delta.
5. **Staging & Commit:** Results are held in a temporary cache/transaction. Only when *all* chunks succeed is the `player_daily_stats` table updated. This prevents the leaderboards from showing partial, corrupted data while the sync is running.

---

## 6. Data Persistence & Schema Topology
- **Primary DB:** PostgreSQL hosted on Neon (Serverless Postgres) or Supabase.
- **Relations:** 
  - `Team` (1) to `Player` (Many).
  - `Player` (1) to `PlayerDailyStats` (Many).
- **Indexing:** Indexes placed on `team_number`, `is_locked`, and `google_id` to ensure O(1) or O(log n) lookups during the EOS allocation and OAuth sign-in.

## 7. Deployment & Infrastructure
- **Frontend / Client Assets:** Vercel or Render Static Sites (Edge CDN for fast global delivery).
- **Backend API:** Render Web Service (Node.js). Environment configured with `TZ=UTC`.
- **Background Jobs:** Render Cron or Upstash QStash.
- **Environment Variables:**
  - `DATABASE_URL`
  - `GOOGLE_OAUTH_CLIENT_ID` / `SECRET`
  - `ADMIN_PASSWORD` & `JWT_SECRET`
