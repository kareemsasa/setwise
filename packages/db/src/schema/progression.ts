import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userProfiles } from "./users.js";

export const patternTypeEnum = pgEnum("pattern_type", [
  "rep_shortfall",
  "stall",
  "schedule_drift",
  "pain_recurrence",
  "consistency_drop",
]);

export const patternSeverityEnum = pgEnum("pattern_severity", [
  "info",
  "warning",
  "action_needed",
]);

export const recommendationTypeEnum = pgEnum("recommendation_type", [
  "reduce_weight",
  "reduce_volume",
  "increase_weight",
  "deload_week",
  "reschedule",
  "swap_exercise",
  "adjust_reps",
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "pending",
  "accepted",
  "dismissed",
  "expired",
]);

export const progressionPatterns = pgTable("progression_patterns", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id),
  patternType: patternTypeEnum("pattern_type").notNull(),
  exerciseName: varchar("exercise_name", { length: 255 }),
  description: text().notNull(),
  evidence: jsonb().notNull(),
  severity: patternSeverityEnum().notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  acknowledged: boolean().notNull().default(false),
});

export const adjustmentRecommendations = pgTable(
  "adjustment_recommendations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id),
    patternId: uuid("pattern_id").references(() => progressionPatterns.id),
    recommendationType: recommendationTypeEnum(
      "recommendation_type",
    ).notNull(),
    targetExercise: varchar("target_exercise", { length: 255 }),
    description: text().notNull(),
    proposedChange: jsonb("proposed_change").notNull(),
    status: recommendationStatusEnum().notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
);
