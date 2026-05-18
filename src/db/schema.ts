import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  text,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Tracks the lifecycle of a sporting event.
 */
export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "live",
  "finished",
]);

// ============================================================================
// TABLES
// ============================================================================

/**
 * Core Matches Table
 * Contains structural metadata and real-time aggregate scoring for individual games.
 */
export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    sport: varchar("sport", { length: 50 }).notNull(),
    homeTeam: varchar("home_team", { length: 100 }).notNull(),
    awayTeam: varchar("away_team", { length: 100 }).notNull(),
    status: matchStatusEnum("status").default("scheduled").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    homeScore: integer("home_score").default(0).notNull(),
    awayScore: integer("away_score").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Optimizes index lookup for active/live games, filtering by specific sport
    index("idx_matches_sport_status").on(table.sport, table.status),
    // Index to fast-sort or search by event start time profiles
    index("idx_matches_start_time").on(table.startTime),
  ],
);

/**
 * Commentary Table
 * Stores granular chronological events happening inside a live match.
 * Built to feed real-time WebSockets or server-sent event (SSE) streams.
 */
export const commentary = pgTable(
  "commentary",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    minute: integer("minute").notNull(),
    sequence: integer("sequence").notNull(), // Disambiguates multiple events occurring in the same minute
    period: varchar("period", { length: 50 }).notNull(), // e.g., 'first_half', 'quarter_1', 'overtime'
    eventType: varchar("event_type", { length: 50 }).notNull(), // e.g., 'goal', 'foul', 'substitution', 'card'
    actor: varchar("actor", { length: 150 }), // The player or referee involved
    team: varchar("team", { length: 100 }), // The team associated with the event action
    message: text("message").notNull(), // Human-readable log entry text
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}), // Dynamic, payload-specific metrics (e.g., coordinates, xG)
    tags: text("tags").array(), // Searchable indexing flags like ['VAR', 'Milestone']
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Critical for chronological socket delivery per match timeline
    index("idx_commentary_match_timeline").on(table.matchId, table.sequence),
  ],
);

// ============================================================================
// RELATIONS (Drizzle Application-Level Relations Query API)
// ============================================================================

export const matchesRelations = relations(matches, ({ many }) => ({
  commentaries: many(commentary),
}));

export const commentaryRelations = relations(commentary, ({ one }) => ({
  match: one(matches, {
    fields: [commentary.matchId],
    references: [matches.id],
  }),
}));
