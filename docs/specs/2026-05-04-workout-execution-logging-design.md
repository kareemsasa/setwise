# Workout Execution & Logging — Design Spec

## 1. Goal and Scope

Enable users to execute scheduled workouts: start a session, log set results against planned exercise prescriptions, and complete the workout. This slice captures actual workout performance but does not implement long-term analytics, progression recommendations, or missed workout detection.

**Position in the flow:**

```
Profile → Consultation → Assessment → Draft Plan → Approved Plan
→ Scheduled Workout Instances → **Workout Execution/Logging** → (later: progression analysis)
```

## 2. Route Design

Routes are split by resource ownership. Starting a workout and looking up its session belong under the scheduled workout. Once a session exists, logging and completion belong under the session.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/scheduled-workouts/:scheduledWorkoutId/start` | Create or resume a workout session |
| GET | `/api/scheduled-workouts/:scheduledWorkoutId/session` | Look up the session for a scheduled workout |
| POST | `/api/workout-sessions/:sessionId/set-logs` | Log a completed set |
| POST | `/api/workout-sessions/:sessionId/complete` | Mark a session as completed |
| GET | `/api/workout-sessions/:sessionId` | Get session details with planned exercises and set logs |

The existing stub routes in `workout-sessions.ts` (`POST /`, `GET /:id`, `POST /:id/sets`, `POST /:id/complete`) will be replaced. The new route shapes take precedence.

## 3. Lifecycle Rules

### Starting a workout

- If no session exists for the scheduled workout: create one, return **201 Created** with `{ session, created: true }`.
- If an `in_progress` session exists: return **200 OK** with `{ session, created: false }`.
- If a `completed` session exists: return **409 Conflict**. A completed workout cannot be restarted.
- Scheduled workout status is **not changed** on start (there is no `in_progress` value in the `ScheduledWorkoutStatus` enum).

### Logging sets

- Set logs are only accepted while the session status is `in_progress`.
- If the session is `completed` or `abandoned`: return **409 Conflict**.
- The `exercisePrescriptionId` in the request must belong to the workout template associated with the session's scheduled workout. If it does not: return **409 Conflict**.
- If the exercise prescription does not exist: return **404**.

### Completing a workout

- If the session is `in_progress`: mark it `completed`, set `completedAt`, return **200 OK** with `{ session, alreadyCompleted: false }`.
- If the session is already `completed`: return **200 OK** with `{ session, alreadyCompleted: true }`. No duplicate `clock_out` events are created.
- On completion, update `scheduled_workouts.status` to `completed`.

### General

- Missing resources (scheduled workout, session, prescription) return **404**.
- Invalid payloads return **400**.

## 4. Database Change

### Migration: add `exercise_prescription_id` to `set_logs`

Add a nullable FK column `exercise_prescription_id` referencing `exercise_prescriptions.id` to the `set_logs` table. Nullable to avoid breaking any hypothetical existing rows, but the API will always populate it for new set logs.

```sql
ALTER TABLE set_logs
  ADD COLUMN exercise_prescription_id uuid REFERENCES exercise_prescriptions(id);
```

### Denormalized snapshot fields (no change)

The existing `set_logs` columns (`exercise_name`, `prescribed_reps`, `prescribed_weight_kg`) are retained as denormalized snapshots. The API populates them from the exercise prescription at insert time. This preserves historical integrity if a plan version is later revised.

**Both** the FK and the snapshots are written:
- `exercise_prescription_id` — authoritative reference back to the prescription
- `exercise_name` — snapshot from `exercise_prescriptions.exercise_name`
- `prescribed_reps` — snapshot from `exercise_prescriptions.rep_max` (the target ceiling)
- `prescribed_weight_kg` — snapshot from `exercise_prescriptions.weight_kg`

## 5. Validation Schemas

New file: `packages/validation/src/workout-session.ts`

### `startWorkoutParamsSchema`

Reuse the existing `scheduledWorkoutByIdParamsSchema` (`{ scheduledWorkoutId: uuid }`).

### `sessionByIdParamsSchema`

```typescript
{ sessionId: z.string().uuid() }
```

### `createSetLogBodySchema`

```typescript
{
  exercisePrescriptionId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  repsCompleted: z.number().int().min(0),
  weightKg: z.number().nonnegative().optional().nullable(),
  rpe: z.number().min(1).max(10).optional().nullable(),
  painReported: z.boolean().optional().default(false),
  notes: z.string().optional().nullable()
}
```

### `completeSessionBodySchema`

```typescript
{
  notes: z.string().optional().nullable()
}
```

## 6. Attendance Events

### On session start (clock_in)

Insert an `attendance_events` row:
- `eventType: 'clock_in'`
- `scheduledWorkoutId` from the scheduled workout
- `sessionId` from the newly created session
- `scheduledTime` from `scheduled_workouts.scheduled_time` (or `scheduled_date` at midnight UTC if no time)
- `actualTime: new Date()`
- `varianceMinutes`: computed as `actualTime - scheduledTime` in minutes if `scheduledTime` exists, `null` otherwise
- `recordedAt: new Date()`

### On session completion (clock_out)

Insert an `attendance_events` row:
- `eventType: 'clock_out'`
- `scheduledWorkoutId` from the scheduled workout
- `sessionId` from the session
- `scheduledTime` same as the clock_in event's `scheduledTime`
- `actualTime: new Date()`
- `varianceMinutes`: null (clock_out variance is not meaningful without a scheduled end time)
- `recordedAt: new Date()`
- Only inserted if the session was not already completed (no duplicate clock_out events)

## 7. API Behavior Detail

### `POST /api/scheduled-workouts/:scheduledWorkoutId/start`

1. Validate params
2. Fetch scheduled workout — 404 if missing
3. Query for existing session (`workout_sessions` where `scheduledWorkoutId` matches)
4. If `completed` session exists → 409
5. If `in_progress` session exists → 200, `{ session, created: false }`
6. Create session row (`in_progress`, `startedAt: now`)
7. Insert `clock_in` attendance event
8. Return 201, `{ session, created: true }`

### `GET /api/scheduled-workouts/:scheduledWorkoutId/session`

1. Validate params
2. Query session by `scheduledWorkoutId`
3. If no session → 404
4. Join set logs and planned exercises
5. Return 200 with session, set logs, and planned exercises

### `POST /api/workout-sessions/:sessionId/set-logs`

1. Validate params and body
2. Fetch session — 404 if missing
3. Check status is `in_progress` — 409 if not
4. Fetch exercise prescription by `exercisePrescriptionId` — 404 if missing
5. Verify prescription belongs to session's scheduled workout's template — 409 if mismatch
6. Insert `set_logs` row with FK and denormalized snapshots
7. Return 201 with set log

### `POST /api/workout-sessions/:sessionId/complete`

1. Validate params and optional body
2. Fetch session — 404 if missing
3. If already `completed` → 200, `{ session, alreadyCompleted: true }`
4. Update session: `status = 'completed'`, `completedAt = now`, merge notes
5. Update `scheduled_workouts.status = 'completed'`
6. Insert `clock_out` attendance event
7. Return 200, `{ session, alreadyCompleted: false }`

### `GET /api/workout-sessions/:sessionId`

1. Validate params
2. Fetch session with joins: scheduled workout → workout template → exercise prescriptions (plan), set logs (actuals)
3. Return 200 with `{ session, plannedExercises, setLogs }`

## 8. Web UI Behavior

The existing `/workouts/[id]` page serves as the shell and detail loader. A small client component handles execution controls.

### Page load

1. Server-fetch the scheduled workout detail (existing behavior)
2. Client-fetch `GET /api/scheduled-workouts/:id/session` — 404 means not started

### UI states

**Not Started** (no session):
- Display the exercise prescription table (existing)
- Show a "Start Workout" button
- On click: POST start → transition to In Progress

**In Progress** (session status = `in_progress`):
- Show each prescribed exercise as a section
- For each exercise: display prescribed sets/reps/weight/RPE
- For each set: inline form to log `repsCompleted`, `weightKg` (prefilled from prescription), `rpe`, `painReported`, `notes`
- Already-logged sets display actual values with visual distinction from pending sets
- "Complete Workout" button at the bottom

**Completed** (session status = `completed`):
- Read-only summary showing planned vs actual for each exercise/set
- Start/end times, duration, "Completed" badge
- No further interaction

### Constraints

- Keep the client component small and focused
- One set submission at a time is acceptable for the first version
- No analytics charts, progression indicators, or dashboards

## 9. Test Plan

Integration tests in `apps/api/tests/workout-execution.test.ts` using Vitest + Fastify injection.

### Setup

Use isolated fixture helpers to avoid cross-test coupling:
- `createScheduledWorkoutFixture()` — creates the full chain (profile → plan → template → prescriptions → scheduled workout)
- `createStartedSessionFixture()` — creates fixture + starts a session
- `createCompletedSessionFixture()` — creates fixture + starts + completes a session

### Test cases

**Start workout:**
- Start a scheduled workout → 201, session with `created: true`
- Start again (in_progress session exists) → 200, same session, `created: false`
- Start after completion → 409
- Start non-existent scheduled workout → 404

**Log sets:**
- Log a valid set → 201, set log returned
- Log with optional fields omitted → 201
- Log with `painReported: true` → 201, stored correctly
- Verify `exercisePrescriptionId` is persisted and returned
- Log for prescription not in session's template → 409
- Log for non-existent prescription → 404
- Log after session completion → 409
- Log with invalid body → 400
- Log for non-existent session → 404

**Complete workout:**
- Complete in_progress session → 200, `alreadyCompleted: false`, `completedAt` set
- Complete already-completed session → 200, `alreadyCompleted: true`
- Complete with optional notes → 200, notes stored
- Complete non-existent session → 404
- Verify `scheduled_workouts.status` is `completed` after session completion
- Verify `clock_out` attendance event created
- Verify no duplicate `clock_out` on repeated completion

**Get session:**
- Get session with set logs and planned exercises → 200
- Get non-existent session → 404

**Get session by scheduled workout:**
- Scheduled workout with session → 200
- Scheduled workout without session → 404

**Attendance events:**
- `clock_in` event created on start with correct timestamps
- `varianceMinutes` computed when `scheduledTime` exists
- `varianceMinutes` null when `scheduledTime` is null

## 10. Non-Goals

The following are explicitly out of scope for this slice:

- **Progression analytics** — no automatic weight/rep recommendations
- **Missed workout detection** — no detection of unattended scheduled workouts
- **Skipped set UX** — `skipped` field defaults to `false`; skip interaction deferred
- **Notifications** — no reminders or alerts
- **Authentication** — no auth middleware
- **AI integration** — no real AI for recommendations
- **External calendar** — no calendar sync
- **Analytics dashboards** — no charts or trend visualizations
- **Workout reopening** — completed sessions cannot be reopened or edited
