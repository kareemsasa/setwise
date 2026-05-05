# Scheduled Workout Generation Design

## Overview

After a plan is approved, the app generates scheduled workout instances from the approved plan version. This creates the in-app calendar foundation. Scheduled workouts are planned instances only --- workout execution and logging are out of scope.

## Flow

```
Profile -> Consultation -> Assessment -> Draft Plan -> Approved Plan -> Scheduled Workout Instances
```

Generation is triggered explicitly via `POST /api/plans/:planId/scheduled-workouts`. It is not automatic on approval.

---

## Generation Endpoint

### `POST /api/plans/:planId/scheduled-workouts`

**Precondition checks (in order):**

1. Plan exists -> 404 if not
2. Plan status is `approved` -> 409 "Plan is not approved"
3. Latest `PlanVersion` status is `approved` -> 409 "Latest plan version is not approved"
4. No scheduled workouts already exist for this plan version -> 409 with existing workouts

**Optional request body:**

```json
{
  "startDate": "2026-05-04",
  "weeks": 4
}
```

- `startDate`: ISO date string (YYYY-MM-DD). Defaults to today if omitted.
- `weeks`: integer, 1--12. Defaults to 4 if omitted.

**Generation steps (all within a single database transaction):**

1. Parse `PlanVersion.structure.weeklySchedule.sessions`
2. For each session -> create a `WorkoutTemplate` row (linked to plan version via `plan_version_id`)
3. For each template -> create 3--5 `ExercisePrescription` rows (deterministic, based on session type)
4. Calculate generation horizon: `weeks` weeks starting from `startDate`
5. For each template with a `dayOfWeek`, for each week -> create a `ScheduledWorkout` row with status `upcoming`

If any step fails, the entire transaction rolls back. No partial state.

**Response:** 201 with the plan/version context and the generated scheduled workouts.

**Duplicate behavior:** If scheduled workouts already exist for the approved plan version, return 409 with the existing set. Duplicate check is based on `planVersionId`.

### Response Shape (201)

```json
{
  "planId": "...",
  "planVersionId": "...",
  "versionNumber": 1,
  "generatedCount": 16,
  "scheduledWorkouts": [
    {
      "id": "...",
      "profileId": "...",
      "planVersionId": "...",
      "scheduledDate": "2026-05-05",
      "scheduledTime": null,
      "status": "upcoming",
      "template": {
        "id": "...",
        "name": "Heavy Compound",
        "dayOfWeek": 0,
        "estimatedDurationMinutes": 60
      }
    }
  ]
}
```

### Response Shape (409 - Duplicate)

```json
{
  "error": "Scheduled workouts already exist for this plan version",
  "planId": "...",
  "planVersionId": "...",
  "existingCount": 16,
  "scheduledWorkouts": [...]
}
```

---

## Query Endpoints

### `GET /api/scheduled-workouts`

Optional query params:
- `start`: ISO date string (YYYY-MM-DD). Filter `scheduledDate >= start`.
- `end`: ISO date string (YYYY-MM-DD). Filter `scheduledDate <= end`.
- If neither: return all scheduled workouts.

Ordered by `scheduledDate ASC`.

**Response shape:**

```json
[
  {
    "id": "...",
    "profileId": "...",
    "planVersionId": "...",
    "scheduledDate": "2026-05-05",
    "scheduledTime": null,
    "status": "upcoming",
    "template": {
      "id": "...",
      "name": "Heavy Compound",
      "dayOfWeek": 0,
      "estimatedDurationMinutes": 60
    }
  }
]
```

### `GET /api/scheduled-workouts/:scheduledWorkoutId`

Returns a single scheduled workout with full template and exercise prescriptions.

404 if not found.

**Response shape:**

```json
{
  "id": "...",
  "profileId": "...",
  "planVersionId": "...",
  "scheduledDate": "2026-05-05",
  "scheduledTime": null,
  "status": "upcoming",
  "template": {
    "id": "...",
    "name": "Heavy Compound",
    "dayOfWeek": 0,
    "estimatedDurationMinutes": 60,
    "exercises": [
      {
        "id": "...",
        "exerciseName": "Goblet Squat",
        "orderInWorkout": 1,
        "sets": 4,
        "repMin": 4,
        "repMax": 6,
        "weightKg": null,
        "rpeTarget": 8,
        "restSeconds": 180,
        "notes": null
      }
    ]
  }
}
```

---

## Day Mapping

The mock plan uses day name strings. The DB uses integers (0=Monday per domain-model.md).

| String    | DB integer | JS `getDay()` |
|-----------|------------|---------------|
| monday    | 0          | 1             |
| tuesday   | 1          | 2             |
| wednesday | 2          | 3             |
| thursday  | 3          | 4             |
| friday    | 4          | 5             |
| saturday  | 5          | 6             |
| sunday    | 6          | 0             |

A pure helper function handles the conversion.

**Date calculation:**
- Starting from `startDate`, for each of the next `weeks` weeks, find the calendar date for each template's `dayOfWeek`.
- If `startDate` falls on a template's day, include that date.
- If the template's day has already passed in that week, use the next occurrence.
- Generation window is always forward-looking.

---

## Mock Exercise Generation

Deterministic exercise selection based on session type. Conservative, broadly accessible movements. No progression logic. No load prescriptions (`weightKg = null`). Moderate RPE.

Lives in `apps/api/src/mock-exercise-generator.ts`.

### Exercise Library

| Session Type        | Exercises                                                           | Sets | Rep Range | RPE | Rest  |
|---------------------|---------------------------------------------------------------------|------|-----------|-----|-------|
| Heavy Compound      | Goblet Squat, Dumbbell Bench Press, Dumbbell Row, Romanian Deadlift | 4    | 4--6      | 8   | 180s  |
| Accessory Strength  | Split Squat, Incline DB Press, Cable Row, Face Pull, Lateral Raise  | 3    | 8--12     | 7   | 90s   |
| Power Development   | Dumbbell Push Press, Split Squat Jump, Cable Row, Farmer Carry      | 4    | 5--8      | 7   | 120s  |
| Upper Hypertrophy   | Dumbbell Bench Press, Cable Row, DB Shoulder Press, Cable Pressdown, Face Pull | 3 | 10--15 | 7 | 60s |
| Lower Hypertrophy   | Leg Press, Split Squat, Leg Curl, Calf Raise, Hip Thrust            | 3    | 10--15    | 7   | 60s   |
| Full Body Volume    | Goblet Squat, Dumbbell Bench Press, Cable Row, DB Shoulder Press, Plank | 3 | 10--12 | 7 | 60s |
| Endurance Circuit   | Farmer Carry, Incline Walk, Stationary Bike, Goblet Squat, Plank   | 3    | 12--20    | 6   | 45s   |
| Tempo Work          | Goblet Squat, Dumbbell Bench Press, Cable Row, Romanian Deadlift    | 3    | 8--10     | 7   | 90s   |
| Conditioning        | Incline Walk, Stationary Bike, Farmer Carry, Plank                  | 3    | 10--15    | 6   | 60s   |
| Full Body           | Goblet Squat, Dumbbell Bench Press, Dumbbell Row, DB Shoulder Press, Plank | 3 | 8--12 | 7 | 90s |
| Upper Focus         | Dumbbell Bench Press, Cable Row, DB Shoulder Press, Face Pull, Cable Pressdown | 3 | 8--12 | 7 | 90s |
| Lower Focus         | Goblet Squat, Romanian Deadlift, Leg Press, Split Squat, Calf Raise | 3   | 8--12     | 7   | 90s   |
| Default (fallback)  | Goblet Squat, Dumbbell Bench Press, Dumbbell Row, Plank             | 3    | 8--12     | 7   | 90s   |

Unrecognized session types fall through to the default set.

---

## Validation Schemas

New file: `packages/validation/src/scheduled-workout.ts`

- `generateScheduledWorkoutsParamsSchema`: `{ planId: z.string().uuid() }`
- `generateScheduledWorkoutsBodySchema`: `{ startDate?: z.string().date(), weeks?: z.number().int().min(1).max(12) }`
- `scheduledWorkoutByIdParamsSchema`: `{ scheduledWorkoutId: z.string().uuid() }`
- `scheduledWorkoutQuerySchema`: `{ start?: z.string().date(), end?: z.string().date() }`

Exported from the validation package index.

---

## Database

### No Migrations Required

The existing schema already has all required tables:
- `workout_templates` (plans.ts)
- `exercise_prescriptions` (plans.ts)
- `scheduled_workouts` (workouts.ts)

### New Exports

Add `gte`, `lte`, `asc` to the re-exports from `@setwise/db` (for date range filtering and ordering).

### Transaction Support

Drizzle ORM supports transactions natively via `db.transaction()`. No new infrastructure needed. The generation endpoint wraps all inserts (templates, prescriptions, scheduled workouts) in a single `db.transaction()` call.

---

## Status Enum

The existing `ScheduledWorkoutStatus` enum uses `"upcoming"` (confirmed in `packages/domain/src/enums.ts` and `packages/db/src/schema/workouts.ts`). Use `"upcoming"` for all newly created scheduled workouts.

---

## Public API Naming

Public API responses use `profileId` instead of `userId`. Internal DB column naming (`user_id`) remains unchanged. The mapping happens at the route handler level when constructing response objects.

---

## Tests

Integration tests in `apps/api/tests/scheduled-workouts.test.ts`.

Test setup reuses the existing pattern from `plans.test.ts`:
- `buildApp()` creates Fastify instance
- `createAssessment()` helper returns `{ profileId, consultationId, assessmentId }`
- New `createApprovedPlan()` helper: creates assessment, creates plan, approves it, returns `{ profileId, planId, planVersionId }`

### Test Cases

1. **Generate workouts from approved plan** --- full happy path: create approved plan -> generate with fixed `startDate` -> verify 201, correct count (4 weeks x sessions/week), template and exercise data present
2. **Reject unapproved plan** --- create plan (still draft) -> attempt generation -> 409 "Plan is not approved"
3. **Reject plan with non-approved latest version** --- construct scenario where latest version is not approved -> 409
4. **Duplicate generation** --- generate twice for same plan version -> second call returns 409 with existing workouts
5. **List scheduled workouts** --- generate, then GET list -> verify order by date, template summary included
6. **List by date range** --- generate, then GET with `start`/`end` -> verify filtered results
7. **Fetch single scheduled workout** --- GET by ID -> verify full detail with exercises
8. **Missing scheduled workout** --- GET with fake UUID -> 404
9. **Plan not found** --- generate for nonexistent plan -> 404
10. **Custom weeks parameter** --- generate with `weeks: 2` -> verify correct count

All tests use deterministic `startDate` to avoid time-dependent behavior.

---

## Web (Minimal)

### `/calendar` Page

- Fetch `GET /api/scheduled-workouts` (optionally with date range for current view)
- Group by date
- Display as a list: date header, then workout name + estimated duration for each
- Replace existing "not yet implemented" stub

### `/workouts/[id]` Page

- Fetch `GET /api/scheduled-workouts/:id`
- Show template name, scheduled date, status
- Show exercise list: name, sets x reps, RPE, rest
- No logging UI, no clock-in
- Replace existing "not yet implemented" stub

---

## Out of Scope

- Workout logging
- Clock-in / clock-out
- Missed workout detection
- Notifications
- Real AI exercise programming
- External calendar integration
- Plan activation state transition
- Injury-aware exercise substitution
