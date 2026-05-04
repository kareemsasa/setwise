import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userProfiles } from "./users.js";

export const consultationStatusEnum = pgEnum("consultation_status", [
  "in_progress",
  "completed",
  "abandoned",
]);

export const assessmentStatusEnum = pgEnum("assessment_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const consultations = pgTable("consultations", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id),
  status: consultationStatusEnum().notNull().default("in_progress"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  transcript: jsonb(),
  structuredOutput: jsonb("structured_output"),
});

export const assessments = pgTable("assessments", {
  id: uuid().primaryKey().defaultRandom(),
  consultationId: uuid("consultation_id")
    .notNull()
    .references(() => consultations.id),
  status: assessmentStatusEnum().notNull().default("pending"),
  inputSnapshot: jsonb("input_snapshot").notNull(),
  result: jsonb(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
