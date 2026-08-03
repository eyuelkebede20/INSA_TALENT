# INSA_TALENT Remaining Tasks

- [x] Task 1: Admin Settings Endpoint & Recalculation (Backend)
  - [x] Implement `POST /api/admin/settings` to update `advanced_threshold` / `mid_threshold`.
  - [x] Implement recalculation logic: detach players whose tiers change (if team unlocked), then re-run EOS grouping for them.

- [ ] Task 2: Lichess Cron Sync Worker (Backend)
  - [ ] Implement `POST /api/cron/sync-lichess-queue`.
  - [ ] Create batched API fetcher to Lichess API.
  - [ ] Update `player_daily_stats`.

- [ ] Task 3: Admin Dashboard UI (Frontend)
  - [ ] Build login form for `ADMIN_PASSWORD`.
  - [ ] Build drag-and-drop interface (`@hello-pangea/dnd`) for reassigning teams.
  - [ ] Build interface to delete players and update event settings.

- [ ] Task 4: Leaderboards UI & Export (Frontend)
  - [ ] Build UI to display Individual, Team Rating, and Team Net Wins leaderboards.
  - [ ] Add `html2canvas` export button to download shareable PNGs.

- [ ] Task 5: Public Canvas UI (Frontend)
  - [ ] Build panning/zooming canvas to display teams visually.
