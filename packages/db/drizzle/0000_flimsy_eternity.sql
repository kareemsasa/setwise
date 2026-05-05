CREATE TYPE "public"."biological_sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."consultation_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'approved', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."plan_version_status" AS ENUM('draft', 'approved', 'superseded', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."attendance_event_type" AS ENUM('clock_in', 'clock_out', 'missed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."scheduled_workout_status" AS ENUM('upcoming', 'completed', 'missed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."workout_session_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."pattern_severity" AS ENUM('info', 'warning', 'action_needed');--> statement-breakpoint
CREATE TYPE "public"."pattern_type" AS ENUM('rep_shortfall', 'stall', 'schedule_drift', 'pain_recurrence', 'consistency_drop');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('pending', 'accepted', 'dismissed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('reduce_weight', 'reduce_volume', 'increase_weight', 'deload_week', 'reschedule', 'swap_exercise', 'adjust_reps');--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"height_cm" numeric(5, 1) NOT NULL,
	"weight_kg" numeric(5, 1) NOT NULL,
	"date_of_birth" date NOT NULL,
	"biological_sex" "biological_sex" NOT NULL,
	"experience_level" "experience_level" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"status" "assessment_status" DEFAULT 'pending' NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "consultation_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"transcript" jsonb,
	"structured_output" jsonb
);
--> statement-breakpoint
CREATE TABLE "exercise_prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_template_id" uuid NOT NULL,
	"exercise_name" varchar(255) NOT NULL,
	"order_in_workout" integer NOT NULL,
	"sets" integer NOT NULL,
	"rep_min" integer NOT NULL,
	"rep_max" integer NOT NULL,
	"weight_kg" integer,
	"rpe_target" integer,
	"rest_seconds" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "plan_version_status" DEFAULT 'draft' NOT NULL,
	"structure" jsonb NOT NULL,
	"rejection_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"day_of_week" integer,
	"order_in_plan" integer NOT NULL,
	"estimated_duration_minutes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_workout_id" uuid NOT NULL,
	"session_id" uuid,
	"event_type" "attendance_event_type" NOT NULL,
	"scheduled_time" timestamp NOT NULL,
	"actual_time" timestamp,
	"variance_minutes" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workout_template_id" uuid NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"scheduled_time" time,
	"status" "scheduled_workout_status" DEFAULT 'upcoming' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_name" varchar(255) NOT NULL,
	"set_number" integer NOT NULL,
	"prescribed_reps" integer NOT NULL,
	"actual_reps" integer NOT NULL,
	"prescribed_weight_kg" numeric(6, 2),
	"actual_weight_kg" numeric(6, 2),
	"rpe_actual" numeric(3, 1),
	"pain_reported" boolean DEFAULT false NOT NULL,
	"pain_notes" text,
	"skipped" boolean DEFAULT false NOT NULL,
	"skip_reason" text
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_workout_id" uuid,
	"user_id" uuid NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" "workout_session_status" DEFAULT 'in_progress' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "adjustment_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pattern_id" uuid,
	"recommendation_type" "recommendation_type" NOT NULL,
	"target_exercise" varchar(255),
	"description" text NOT NULL,
	"proposed_change" jsonb NOT NULL,
	"status" "recommendation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "progression_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pattern_type" "pattern_type" NOT NULL,
	"exercise_name" varchar(255),
	"description" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"severity" "pattern_severity" NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_prescriptions" ADD CONSTRAINT "exercise_prescriptions_workout_template_id_workout_templates_id_fk" FOREIGN KEY ("workout_template_id") REFERENCES "public"."workout_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_scheduled_workout_id_scheduled_workouts_id_fk" FOREIGN KEY ("scheduled_workout_id") REFERENCES "public"."scheduled_workouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_workouts" ADD CONSTRAINT "scheduled_workouts_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_workouts" ADD CONSTRAINT "scheduled_workouts_workout_template_id_workout_templates_id_fk" FOREIGN KEY ("workout_template_id") REFERENCES "public"."workout_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_workouts" ADD CONSTRAINT "scheduled_workouts_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_scheduled_workout_id_scheduled_workouts_id_fk" FOREIGN KEY ("scheduled_workout_id") REFERENCES "public"."scheduled_workouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_recommendations" ADD CONSTRAINT "adjustment_recommendations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_recommendations" ADD CONSTRAINT "adjustment_recommendations_pattern_id_progression_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."progression_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_patterns" ADD CONSTRAINT "progression_patterns_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;