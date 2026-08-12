import { relations } from 'drizzle-orm';
import { pgTable, serial, varchar, boolean, integer, timestamp, uuid, pgEnum, text } from 'drizzle-orm/pg-core';

export const tierEnum = pgEnum('tier', ['ADVANCED', 'MID', 'BEGINNER']);

export const user = pgTable("user", {
	id: varchar("id", { length: 36 }).primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('emailVerified').notNull(),
	image: text('image'),
	createdAt: timestamp('createdAt').notNull(),
	updatedAt: timestamp('updatedAt').notNull()
});

export const session = pgTable("session", {
	id: varchar("id", { length: 36 }).primaryKey(),
	expiresAt: timestamp('expiresAt').notNull(),
	token: text('token').notNull().unique(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: varchar('userId', { length: 36 }).notNull().references(() => user.id),
	createdAt: timestamp('createdAt'),
	updatedAt: timestamp('updatedAt')
});

export const account = pgTable("account", {
	id: varchar("id", { length: 36 }).primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: varchar('userId', { length: 36 }).notNull().references(() => user.id),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	expiresAt: timestamp('expiresAt'),
	accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
	refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('createdAt'),
	updatedAt: timestamp('updatedAt')
});

export const verification = pgTable("verification", {
	id: varchar("id", { length: 36 }).primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expiresAt').notNull(),
	createdAt: timestamp('createdAt'),
	updatedAt: timestamp('updatedAt')
});

export const eventSettings = pgTable('event_settings', {
  id: serial('id').primaryKey(),
  advancedThreshold: integer('advanced_threshold').default(1200).notNull(),
  midThreshold: integer('mid_threshold').default(600).notNull(),
  registrationOpen: boolean('registration_open').default(true).notNull(),
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
  lichessWins: integer('lichess_wins').default(0).notNull(),
  lichessLosses: integer('lichess_losses').default(0).notNull(),
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

export const studentFeedbacks = pgTable('student_feedbacks', {
  id: serial('id').primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teamsRelations = relations(teams, ({ many }) => ({ players: many(players) }));
export const playersRelations = relations(players, ({ one, many }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
  dailyStats: many(playerDailyStats),
  feedbacks: many(studentFeedbacks),
}));
