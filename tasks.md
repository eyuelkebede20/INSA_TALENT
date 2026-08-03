# INSA_TALENT Development Tasks



- [ ] Task 2: Database Setup (Server)
  - [x] Configure Drizzle ORM and Neon/PostgreSQL connection.
  - [x] Write schema definition (`schema.ts`) matching `claude.md`.
  - [ ] Generate and apply initial database migrations.

- [ ] Task 3: Backend Authentication
  - [ ] Set up Better Auth / Supabase Auth.
  - [ ] Implement Google OAuth and Lichess OAuth integration.
  - [ ] Implement Superadmin JWT authentication middleware.

- [ ] Task 4: Student Flow & EOS Engine
  - [ ] Implement profile completion endpoint (fetching max rating from Lichess APIs).
  - [ ] Build the Earliest Open Slot (EOS) engine wrapped in DB transactions.
  - [ ] Lock teams automatically when reaching exact 7-player ratio.

- [ ] Task 5: Admin API Operations
  - [ ] Implement Drag-and-Drop reassignment endpoint.
  - [ ] Implement direct 1-to-1 swap endpoint.
  - [ ] Implement user deletion endpoint with automated cascade backfill logic.
  - [ ] Implement settings update endpoint (threshold recalculation).

- [ ] Task 6: Leaderboards & Scheduled Sync
  - [ ] Implement `GET /api/leaderboard/students`.
  - [ ] Implement `GET /api/leaderboard/teams/rating`.
  - [ ] Implement `GET /api/leaderboard/teams/net-wins`.
  - [ ] Set up background batched worker for 12-hour Lichess stat sync.

- [ ] Task 7: Frontend Foundation
  - [ ] Set up React Router, React Query (for API), and Zustand (for UI state).
  - [ ] Establish base layout and UI components (buttons, modals, tables).

- [ ] Task 8: Student & Public UI
  - [ ] Build OAuth login and profile completion form.
  - [ ] Build the Public Canvas with pan/zoom to find teams.

- [ ] Task 9: Leaderboard UI
  - [ ] Display the 3 leaderboards securely.
  - [ ] Implement `html2canvas` for exporting the leaderboards to PNG.

- [ ] Task 10: Superadmin Dashboard UI
  - [ ] Implement secure login form.
  - [ ] Build drag-and-drop interface for managing unlocked teams.
  - [ ] Add controls for updating event settings and deleting users.
