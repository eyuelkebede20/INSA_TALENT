# INSA_TALENT Remaining Tasks

- [x] Task 1: Admin Settings Endpoint & Recalculation (Backend)
  - [x] Implement `POST /api/admin/settings` to update `advanced_threshold` / `mid_threshold`.
  - [x] Implement recalculation logic: detach players whose tiers change (if team unlocked), then re-run EOS grouping for them.

- [x] Task 2: Lichess Cron Sync Worker (Backend)
  - [x] Implement `POST /api/cron/sync-lichess-queue`.
  - [x] Create batched API fetcher to Lichess API.
  - [x] Update `player_daily_stats`.

- [x] Task 3: Admin Dashboard UI (Frontend)
  - [x] Build login form for `ADMIN_PASSWORD`.
  - [x] Build drag-and-drop interface (`@hello-pangea/dnd`) for reassigning teams.
  - [x] Build interface to delete players and update event settings.

- [x] Task 4: Leaderboards UI & Export (Frontend)
  - [x] Build UI to display Individual, Team Rating, and Team Net Wins leaderboards.
  - [x] Add `html2canvas` export button to download shareable PNGs.

- [x] Task 5: Public Canvas UI (Frontend)
  - [x] Build panning/zooming canvas to display teams visually.
