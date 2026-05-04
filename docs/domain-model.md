# Domain Model

## Overview

This document defines the initial domain entities, their relationships, and key attributes. These are logical models -- storage and API representations may differ.

---

## Entities

### UserProfile

The user's identity and physical baseline.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     | Primary key                                |
| name               | string   |                                            |
| email              | string   | Unique, used for auth                      |
| height_cm          | decimal  |                                            |
| weight_kg          | decimal  |                                            |
| date_of_birth      | date     |                                            |
| biological_sex     | enum     | male, female -- used for baseline calcs    |
| experience_level   | enum     | beginner, intermediate, advanced           |
| created_at         | datetime |                                            |
| updated_at         | datetime |                                            |

---

### Consultation

A single AI-guided intake session. Produces structured output used for plan generation.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| user_id            | uuid     | FK → UserProfile                           |
| status             | enum     | in_progress, completed, abandoned          |
| started_at         | datetime |                                            |
| completed_at       | datetime | Nullable                                   |
| transcript         | json     | Full conversation history                  |
| structured_output  | json     | Extracted intake data (see intake-flow.md) |

---

### Assessment

Background processing step that takes consultation output and produces a draft plan.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| consultation_id    | uuid     | FK → Consultation                          |
| status             | enum     | pending, processing, completed, failed     |
| input_snapshot     | json     | Copy of consultation structured_output     |
| result             | json     | Generated plan structure                   |
| created_at         | datetime |                                            |
| completed_at       | datetime | Nullable                                   |

---

### TrainingPlan

The top-level plan container. Has versions.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| user_id            | uuid     | FK → UserProfile                           |
| assessment_id      | uuid     | FK → Assessment                            |
| name               | string   | e.g., "Upper/Lower 4-Day Split"            |
| status             | enum     | draft, approved, active, archived          |
| created_at         | datetime |                                            |

---

### PlanVersion

An immutable snapshot of a plan's content. New versions are created on revision, never mutated.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| plan_id            | uuid     | FK → TrainingPlan                          |
| version_number     | integer  | Monotonically increasing per plan          |
| status             | enum     | draft, approved, superseded                |
| structure          | json     | Full plan content (split, days, exercises) |
| rejection_feedback | text     | Nullable -- user feedback if rejected      |
| created_at         | datetime |                                            |

---

### WorkoutTemplate

A reusable workout definition within a plan version. Represents one session type (e.g., "Upper Body A").

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| plan_version_id    | uuid     | FK → PlanVersion                           |
| name               | string   | e.g., "Lower Body B"                       |
| day_of_week        | integer  | 0=Monday, 6=Sunday (nullable for flexible) |
| order_in_plan      | integer  | Sequence within the weekly cycle            |
| estimated_duration | interval | Expected session length                    |

---

### ExercisePrescription

A single exercise within a workout template, with prescribed parameters.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| workout_template_id| uuid     | FK → WorkoutTemplate                       |
| exercise_name      | string   | Canonical exercise name                    |
| order_in_workout   | integer  | Sequence within the session                |
| sets               | integer  | Prescribed number of sets                  |
| rep_min            | integer  | Bottom of rep range                        |
| rep_max            | integer  | Top of rep range                           |
| weight_kg          | decimal  | Nullable -- bodyweight exercises           |
| rpe_target         | decimal  | Nullable -- rate of perceived exertion     |
| rest_seconds       | integer  | Prescribed rest between sets               |
| notes              | text     | Nullable -- form cues, substitutions       |

---

### ScheduledWorkout

A specific workout instance placed on the calendar.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| user_id            | uuid     | FK → UserProfile                           |
| workout_template_id| uuid     | FK → WorkoutTemplate                       |
| plan_version_id    | uuid     | FK → PlanVersion (denormalized for lookup) |
| scheduled_date     | date     |                                            |
| scheduled_time     | time     | Nullable -- if user set a preferred time   |
| status             | enum     | upcoming, completed, missed, skipped       |

---

### WorkoutSession

An actual logged workout. Created when the user clocks in.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| scheduled_workout_id| uuid    | FK → ScheduledWorkout (nullable for ad-hoc)|
| user_id            | uuid     | FK → UserProfile                           |
| plan_version_id    | uuid     | FK → PlanVersion (snapshot reference)      |
| started_at         | datetime | Clock-in time                              |
| completed_at       | datetime | Nullable -- clock-out time                 |
| status             | enum     | in_progress, completed, abandoned          |
| notes              | text     | Nullable -- post-session user notes        |

---

### SetLog

A single set within a workout session.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| session_id         | uuid     | FK → WorkoutSession                        |
| exercise_name      | string   | Matches ExercisePrescription               |
| set_number         | integer  | 1-indexed within the exercise              |
| prescribed_reps    | integer  | What the plan called for                   |
| actual_reps        | integer  | What the user completed                    |
| prescribed_weight_kg| decimal | Nullable                                   |
| actual_weight_kg   | decimal  | Nullable                                   |
| rpe_actual         | decimal  | Nullable -- user-reported RPE              |
| pain_reported      | boolean  | Default false                              |
| pain_notes         | text     | Nullable -- location, severity             |
| skipped            | boolean  | Default false                              |
| skip_reason        | text     | Nullable                                   |

---

### AttendanceEvent

Tracks clock-in/clock-out timing relative to schedule.

| Field              | Type     | Notes                                         |
|--------------------|----------|-----------------------------------------------|
| id                 | uuid     |                                               |
| scheduled_workout_id| uuid    | FK → ScheduledWorkout                         |
| session_id         | uuid     | FK → WorkoutSession (nullable if missed)      |
| event_type         | enum     | clock_in, clock_out, missed, skipped          |
| scheduled_time     | datetime | When the workout was supposed to happen        |
| actual_time        | datetime | Nullable -- when it actually happened          |
| variance_minutes   | integer  | Nullable -- positive=late, negative=early      |
| recorded_at        | datetime |                                               |

---

### ProgressionPattern

A detected pattern from analyzing workout history.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| user_id            | uuid     | FK → UserProfile                           |
| pattern_type       | enum     | rep_shortfall, stall, schedule_drift, pain_recurrence, consistency_drop |
| exercise_name      | string   | Nullable -- not all patterns are per-exercise |
| description        | text     | Human-readable summary                     |
| evidence           | json     | Session IDs, set data, dates backing this  |
| severity           | enum     | info, warning, action_needed               |
| detected_at        | datetime |                                            |
| acknowledged       | boolean  | Default false                              |

---

### AdjustmentRecommendation

A suggested change to the plan or schedule, derived from patterns.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | uuid     |                                            |
| user_id            | uuid     | FK → UserProfile                           |
| pattern_id         | uuid     | FK → ProgressionPattern (nullable)         |
| recommendation_type| enum     | reduce_weight, reduce_volume, deload_week, reschedule, swap_exercise, adjust_reps |
| target_exercise    | string   | Nullable                                   |
| description        | text     | What the recommendation is and why         |
| proposed_change    | json     | Structured change payload                  |
| status             | enum     | pending, accepted, dismissed, expired      |
| created_at         | datetime |                                            |
| resolved_at        | datetime | Nullable                                   |

---

## Relationship Summary

```
UserProfile
  ├── Consultation (1:many, typically 1 at MVP)
  │     └── Assessment (1:1)
  ├── TrainingPlan (1:many, 1 active at a time)
  │     └── PlanVersion (1:many)
  │           └── WorkoutTemplate (1:many)
  │                 └── ExercisePrescription (1:many)
  ├── ScheduledWorkout (1:many)
  │     └── AttendanceEvent (1:many)
  ├── WorkoutSession (1:many)
  │     └── SetLog (1:many)
  ├── ProgressionPattern (1:many)
  └── AdjustmentRecommendation (1:many)
```

## Key Invariants

- A `PlanVersion` is immutable once approved. Changes create a new version.
- A `WorkoutSession` always references the `PlanVersion` that was active when the session was logged, even if the plan has since been revised.
- `ScheduledWorkout` records are generated from the active `PlanVersion`. When a new version is approved, future (unstarted) scheduled workouts are regenerated; past ones are untouched.
- `SetLog.pain_reported = true` is surfaced in pattern detection but never triggers automated medical advice.
