import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  date,
  time,
  timestamp,
  text,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userProfiles } from "./users.js";
import { workoutTemplates, planVersions, exercisePrescriptions } from "./plans.js";

export const scheduledWorkoutStatusEnum = pgEnum("scheduled_workout_status", [
  "upcoming",
  "completed",
  "missed",
  "skipped",
]);

export const workoutSessionStatusEnum = pgEnum("workout_session_status", [
  "in_progress",
  "completed",
  "abandoned",
]);

export const attendanceEventTypeEnum = pgEnum("attendance_event_type", [
  "clock_in",
  "clock_out",
  "missed",
  "skipped",
]);

export const scheduledWorkouts = pgTable("scheduled_workouts", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id),
  workoutTemplateId: uuid("workout_template_id")
    .notNull()
    .references(() => workoutTemplates.id),
  planVersionId: uuid("plan_version_id")
    .notNull()
    .references(() => planVersions.id),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: time("scheduled_time"),
  status: scheduledWorkoutStatusEnum().notNull().default("upcoming"),
});

export const workoutSessions = pgTable("workout_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  scheduledWorkoutId: uuid("scheduled_workout_id").references(
    () => scheduledWorkouts.id,
  ),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id),
  planVersionId: uuid("plan_version_id")
    .notNull()
    .references(() => planVersions.id),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: workoutSessionStatusEnum().notNull().default("in_progress"),
  notes: text(),
});

export const setLogs = pgTable("set_logs", {
  id: uuid().primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => workoutSessions.id),
  exercisePrescriptionId: uuid("exercise_prescription_id").references(
    () => exercisePrescriptions.id,
  ),
  exerciseName: varchar("exercise_name", { length: 255 }).notNull(),
  setNumber: integer("set_number").notNull(),
  prescribedReps: integer("prescribed_reps").notNull(),
  actualReps: integer("actual_reps").notNull(),
  prescribedWeightKg: decimal("prescribed_weight_kg", {
    precision: 6,
    scale: 2,
  }),
  actualWeightKg: decimal("actual_weight_kg", { precision: 6, scale: 2 }),
  rpeActual: decimal("rpe_actual", { precision: 3, scale: 1 }),
  painReported: boolean("pain_reported").notNull().default(false),
  painNotes: text("pain_notes"),
  skipped: boolean().notNull().default(false),
  skipReason: text("skip_reason"),
});

export const attendanceEvents = pgTable("attendance_events", {
  id: uuid().primaryKey().defaultRandom(),
  scheduledWorkoutId: uuid("scheduled_workout_id")
    .notNull()
    .references(() => scheduledWorkouts.id),
  sessionId: uuid("session_id").references(() => workoutSessions.id),
  eventType: attendanceEventTypeEnum("event_type").notNull(),
  scheduledTime: timestamp("scheduled_time"),
  actualTime: timestamp("actual_time"),
  varianceMinutes: integer("variance_minutes"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});
