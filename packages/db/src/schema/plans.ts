import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userProfiles } from "./users.js";
import { assessments } from "./consultations.js";

export const planStatusEnum = pgEnum("plan_status", [
  "draft",
  "approved",
  "active",
  "archived",
]);

export const planVersionStatusEnum = pgEnum("plan_version_status", [
  "draft",
  "approved",
  "superseded",
  "rejected",
]);

export const trainingPlans = pgTable("training_plans", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id),
  assessmentId: uuid("assessment_id")
    .notNull()
    .references(() => assessments.id),
  name: varchar({ length: 255 }).notNull(),
  status: planStatusEnum().notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const planVersions = pgTable("plan_versions", {
  id: uuid().primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => trainingPlans.id),
  versionNumber: integer("version_number").notNull(),
  status: planVersionStatusEnum().notNull().default("draft"),
  structure: jsonb().notNull(),
  rejectionFeedback: text("rejection_feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workoutTemplates = pgTable("workout_templates", {
  id: uuid().primaryKey().defaultRandom(),
  planVersionId: uuid("plan_version_id")
    .notNull()
    .references(() => planVersions.id),
  name: varchar({ length: 255 }).notNull(),
  dayOfWeek: integer("day_of_week"),
  orderInPlan: integer("order_in_plan").notNull(),
  estimatedDurationMinutes: integer("estimated_duration_minutes").notNull(),
});

export const exercisePrescriptions = pgTable("exercise_prescriptions", {
  id: uuid().primaryKey().defaultRandom(),
  workoutTemplateId: uuid("workout_template_id")
    .notNull()
    .references(() => workoutTemplates.id),
  exerciseName: varchar("exercise_name", { length: 255 }).notNull(),
  orderInWorkout: integer("order_in_workout").notNull(),
  sets: integer().notNull(),
  repMin: integer("rep_min").notNull(),
  repMax: integer("rep_max").notNull(),
  weightKg: integer("weight_kg"),
  rpeTarget: integer("rpe_target"),
  restSeconds: integer("rest_seconds").notNull(),
  notes: text(),
});
