# Setwise

Adaptive training planner and workout execution tracker.

Setwise turns a user's profile, constraints, goals, schedule, and actual workout performance into a structured training plan with scheduled sessions, consistency tracking, and evidence-based progression recommendations.

## Status

**Phase: Scheduled Workout Generation** -- profile creation, consultation intake, assessment handoff, draft plan lifecycle, and scheduled workout generation are wired up. Plan generation and exercise prescriptions are deterministic/mock. No workout logging, clock-in, or missed detection yet. No real AI calls yet.

## Core Workflow

1. User creates a profile (basic physical stats, experience level).
2. AI-guided consultation gathers goals, constraints, injuries, equipment access, schedule, and preferences.
3. Background assessment produces a draft training plan and weekly schedule.
4. User reviews and approves (or rejects with feedback) the plan.
5. Approved plan generates workout slots on an in-app calendar.
6. User clocks in to workouts; actual timing, sets, reps, and weights are logged.
7. Missed sessions are tracked automatically.
8. The system analyzes workout data over time and recommends plan or schedule adjustments based on evidence.

## Key Principles

- **Reduce ambiguity**: answer "what should I do today?", "am I progressing?", "should the plan change?"
- **Deterministic rules first**: use explicit progression logic; reserve AI for intake, summarization, and review.
- **Conservative around safety**: pain and injuries are constraints, not problems to diagnose.

## Repository Structure

```
setwise/
  apps/
    web/                     # Next.js App Router (port 3000)
    api/                     # Fastify API server (port 4000)
  packages/
    domain/                  # Pure TypeScript types and enums
    training-core/           # Deterministic progression rules
    db/                      # Drizzle ORM schema, client, and migrations
    validation/              # Zod schemas for API input
  docs/
    product-brief.md         # product thesis, target user, MVP scope
    domain-model.md          # entities, relationships, lifecycle states
    intake-flow.md           # consultation process and structured output
    plan-lifecycle.md        # plan states, versioning, workout generation
    progression-rules-v0.md  # deterministic progression and deload rules
    architecture-notes.md    # technical architecture and module boundaries
```

## Tech Stack

- TypeScript end-to-end
- pnpm workspaces + Turborepo
- Next.js 15 (App Router) for the web app
- Fastify 5 for the API
- PostgreSQL 16 + Drizzle ORM
- Zod for validation
- Vitest for tests

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for local Postgres)

## Local Development

### 1. Install dependencies

```sh
pnpm install
```

### 2. Start the database

```sh
docker compose up -d
```

This starts a local Postgres on port 5432 with database `setwise`, user `setwise`, password `setwise`.

### 3. Set up environment variables

```sh
cp .env.example .env
```

The default `DATABASE_URL` points to the Docker Postgres instance.

### 4. Run database migrations

```sh
pnpm db:migrate
```

### 5. Start development servers

```sh
pnpm dev
```

This starts the API on http://localhost:4000 and the web app on http://localhost:3000.

## Database Commands

```sh
pnpm db:generate   # Generate new migration from schema changes
pnpm db:migrate    # Apply pending migrations
pnpm db:studio     # Open Drizzle Studio (database browser)
```

## API Endpoints

### POST /api/profiles

Create a new user profile.

**Request body:**

```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "heightCm": 170,
  "weightKg": 65,
  "dateOfBirth": "1990-05-15",
  "biologicalSex": "female",
  "experienceLevel": "intermediate"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "heightCm": "170.0",
  "weightKg": "65.0",
  "dateOfBirth": "1990-05-15",
  "biologicalSex": "female",
  "experienceLevel": "intermediate",
  "createdAt": "2026-05-04T...",
  "updatedAt": "2026-05-04T..."
}
```

**Error responses:**

- `400` — Validation failed (missing/invalid fields)
- `409` — Email already exists

**Example with curl:**

```sh
curl -X POST http://localhost:4000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","heightCm":170,"weightKg":65,"dateOfBirth":"1990-05-15","biologicalSex":"female","experienceLevel":"intermediate"}'
```

### POST /api/profiles/:profileId/consultations

Create a consultation with structured intake data for a profile.

**Request body:**

```json
{
  "injuriesAndRestrictions": [],
  "equipment": {
    "location": "commercial_gym",
    "locationNotes": "",
    "availableEquipment": ["barbell", "dumbbells", "cables"],
    "equipmentLimitations": ""
  },
  "goals": {
    "primaryGoal": "strength",
    "secondaryGoals": [],
    "specificTargets": ["bench 100kg"],
    "timeline": "6 months"
  },
  "schedule": {
    "daysPerWeek": 4,
    "availableDays": ["monday", "tuesday", "thursday", "friday"],
    "preferredTime": "morning",
    "sessionLengthMinutes": 60,
    "upcomingDisruptions": ""
  },
  "trainingHistory": {
    "experienceDuration": "2 years",
    "recentProgram": "PPL",
    "familiarExercises": ["squat", "bench press", "deadlift"],
    "recentWorkingWeights": [
      { "exercise": "bench press", "weightKg": 80, "reps": 5, "notes": "" }
    ],
    "pastObservations": ""
  },
  "preferences": {
    "likedExercises": [],
    "dislikedExercises": [],
    "trainingStyle": "",
    "cardioPreference": "",
    "otherNotes": ""
  },
  "safetyFlags": [],
  "agentNotes": ""
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "profileId": "uuid",
  "status": "completed",
  "startedAt": "2026-05-04T...",
  "completedAt": "2026-05-04T...",
  "structuredOutput": { ... }
}
```

**Error responses:**

- `400` — Validation failed (missing/invalid fields)
- `404` — Profile not found

### GET /api/profiles/:profileId/consultations

List all consultations for a profile.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "profileId": "uuid",
    "status": "completed",
    "startedAt": "2026-05-04T...",
    "completedAt": "2026-05-04T...",
    "structuredOutput": { ... }
  }
]
```

**Error responses:**

- `404` — Profile not found

### POST /api/consultations/:consultationId/assessments

Create an assessment from a completed consultation. The assessment is a status record only — no plan generation occurs yet.

**Response (201):**

```json
{
  "id": "uuid",
  "consultationId": "uuid",
  "status": "pending",
  "inputSnapshot": { "..." : "..." },
  "result": null,
  "createdAt": "2026-05-04T...",
  "completedAt": null
}
```

**Error responses:**

- `400` — Invalid consultation ID (not a UUID)
- `404` — Consultation not found
- `409` — An active assessment (pending/processing) already exists for this consultation
- `422` — Consultation is not completed

**Duplicate handling:** If a pending or processing assessment already exists, returns 409 with the existing assessment. If all previous assessments are completed or failed, a new assessment is allowed.

### GET /api/consultations/:consultationId/assessments

List all assessments for a consultation, ordered by creation date (newest first).

**Response (200):**

```json
[
  {
    "id": "uuid",
    "consultationId": "uuid",
    "status": "pending",
    "inputSnapshot": { "..." : "..." },
    "result": null,
    "createdAt": "2026-05-04T...",
    "completedAt": null
  }
]
```

**Error responses:**

- `404` — Consultation not found

### GET /api/assessments/:assessmentId

Fetch a single assessment by ID.

**Response (200):**

```json
{
  "id": "uuid",
  "consultationId": "uuid",
  "status": "pending",
  "inputSnapshot": { "..." : "..." },
  "result": null,
  "createdAt": "2026-05-04T...",
  "completedAt": null
}
```

**Error responses:**

- `400` — Invalid assessment ID (not a UUID)
- `404` — Assessment not found

### POST /api/assessments/:assessmentId/plans

Create a draft training plan from an assessment. Uses deterministic mock generation (no AI).

**Response (201):**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "assessmentId": "uuid",
  "name": "strength plan",
  "status": "draft",
  "createdAt": "2026-05-04T...",
  "currentVersion": {
    "id": "uuid",
    "versionNumber": 1,
    "status": "draft",
    "structure": {
      "goalSummary": "...",
      "weeklySchedule": { "..." : "..." },
      "safetyNotes": [],
      "progressionRules": "...",
      "generatedAt": "...",
      "generationMethod": "deterministic-mock"
    },
    "rejectionFeedback": null,
    "createdAt": "2026-05-04T..."
  }
}
```

**Error responses:**

- `400` — Invalid assessment ID
- `404` — Assessment not found
- `409` — Assessment is processing, or a draft plan already exists for this assessment
- `422` — Assessment has failed

**Assessment status gating:** Plans can be created from `pending` or `completed` assessments. `processing` returns 409; `failed` returns 422.

**Duplicate handling:** Only one draft plan per assessment. If a draft already exists, returns 409 with the existing plan. After rejection, a new plan can be created.

### GET /api/assessments/:assessmentId/plans

List all plans for an assessment, each with its latest version.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "assessmentId": "uuid",
    "name": "strength plan",
    "status": "draft",
    "createdAt": "2026-05-04T...",
    "currentVersion": { "..." : "..." }
  }
]
```

**Error responses:**

- `404` — Assessment not found

### GET /api/plans/:planId

Fetch a single plan with its latest version.

**Response (200):** Same shape as individual items in the list endpoint above.

**Error responses:**

- `400` — Invalid plan ID
- `404` — Plan not found

### POST /api/plans/:planId/approve

Approve a draft plan. Sets both the plan status and latest version status to `approved`.

**Response (200):** Returns the updated plan with its approved version.

**Error responses:**

- `400` — Invalid plan ID
- `404` — Plan not found
- `409` — Plan is not in draft status (already approved, rejected, or no version)

**Note:** After approval, use `POST /api/plans/:planId/scheduled-workouts` to generate workout instances.

### POST /api/plans/:planId/reject

Reject a draft plan with feedback. The latest version is marked `rejected` with the feedback stored. The plan itself remains in `draft` status (awaiting a future revision).

**Request body:**

```json
{
  "feedback": "Too much volume for a beginner"
}
```

**Response (200):** Returns the updated plan with its rejected version.

**Error responses:**

- `400` — Invalid plan ID or missing/empty feedback
- `404` — Plan not found
- `409` — Plan is not in draft status (already approved, rejected, or no version)

**Note:** This slice does not auto-generate a revised version. A future revision endpoint will handle that.

### POST /api/plans/:planId/scheduled-workouts

Generate scheduled workout instances from an approved plan. Creates workout templates, exercise prescriptions, and scheduled workout records in a single transaction.

**Optional request body:**

```json
{
  "startDate": "2026-06-01",
  "weeks": 4
}
```

- `startDate`: ISO date (YYYY-MM-DD). Defaults to today.
- `weeks`: 1--12. Defaults to 4.

**Response (201):**

```json
{
  "planId": "uuid",
  "planVersionId": "uuid",
  "versionNumber": 1,
  "generatedCount": 16,
  "scheduledWorkouts": [
    {
      "id": "uuid",
      "profileId": "uuid",
      "planVersionId": "uuid",
      "scheduledDate": "2026-06-01",
      "scheduledTime": null,
      "status": "upcoming",
      "template": {
        "id": "uuid",
        "name": "Heavy Compound",
        "dayOfWeek": 0,
        "estimatedDurationMinutes": 60
      }
    }
  ]
}
```

**Error responses:**

- `400` — Invalid plan ID or body
- `404` — Plan not found
- `409` — Plan is not approved, latest version is not approved, or workouts already exist for this version

**Duplicate behavior:** If workouts already exist for the approved plan version, returns 409 with the existing workouts. Does not generate duplicates.

**Note:** Generated workouts are planned instances only. Use the execution endpoints below to start workouts and log sets.

### GET /api/scheduled-workouts

List scheduled workouts, optionally filtered by date range.

**Query params:**

- `start` (optional): ISO date. Filter `scheduledDate >= start`.
- `end` (optional): ISO date. Filter `scheduledDate <= end`.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "profileId": "uuid",
    "planVersionId": "uuid",
    "scheduledDate": "2026-06-01",
    "scheduledTime": null,
    "status": "upcoming",
    "template": {
      "id": "uuid",
      "name": "Heavy Compound",
      "dayOfWeek": 0,
      "estimatedDurationMinutes": 60
    }
  }
]
```

### GET /api/scheduled-workouts/:scheduledWorkoutId

Fetch a single scheduled workout with full exercise list.

**Response (200):**

```json
{
  "id": "uuid",
  "profileId": "uuid",
  "planVersionId": "uuid",
  "scheduledDate": "2026-06-01",
  "scheduledTime": null,
  "status": "upcoming",
  "template": {
    "id": "uuid",
    "name": "Heavy Compound",
    "dayOfWeek": 0,
    "estimatedDurationMinutes": 60,
    "exercises": [
      {
        "id": "uuid",
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

**Error responses:**

- `400` — Invalid workout ID
- `404` — Scheduled workout not found

### POST /api/scheduled-workouts/:scheduledWorkoutId/start

Start (or resume) a workout session for a scheduled workout.

**Response (201 — new session):**

```json
{
  "session": {
    "id": "uuid",
    "scheduledWorkoutId": "uuid",
    "userId": "uuid",
    "planVersionId": "uuid",
    "startedAt": "2026-06-01T09:00:00.000Z",
    "completedAt": null,
    "status": "in_progress",
    "notes": null
  },
  "created": true
}
```

**Response (200 — existing in-progress session):** Same shape with `"created": false`.

**Error responses:**

- `400` — Invalid scheduled workout ID
- `404` — Scheduled workout not found
- `409` — A completed session already exists for this scheduled workout

### GET /api/scheduled-workouts/:scheduledWorkoutId/session

Look up the workout session for a scheduled workout.

**Response (200):**

```json
{
  "session": { "..." : "..." },
  "plannedExercises": [ { "id": "uuid", "exerciseName": "Goblet Squat", "..." : "..." } ],
  "setLogs": [ { "id": "uuid", "exercisePrescriptionId": "uuid", "..." : "..." } ]
}
```

**Error responses:**

- `404` — No session found for this scheduled workout

### POST /api/workout-sessions/:sessionId/set-logs

Log a completed set against a planned exercise prescription.

**Request body:**

```json
{
  "exercisePrescriptionId": "uuid",
  "setNumber": 1,
  "repsCompleted": 8,
  "weightKg": 60,
  "rpe": 7.5,
  "painReported": false,
  "notes": null
}
```

**Response (201):** Returns the created set log with `exercisePrescriptionId`, denormalized `exerciseName`, `prescribedReps`, and actual values.

**Error responses:**

- `400` — Invalid session ID or request body
- `404` — Session or exercise prescription not found
- `409` — Session is not in progress, or prescription does not belong to this workout's template

### POST /api/workout-sessions/:sessionId/complete

Complete a workout session. Idempotent — safe to call multiple times.

**Optional request body:**

```json
{
  "notes": "Felt strong today"
}
```

**Response (200):**

```json
{
  "session": { "..." : "...", "status": "completed", "completedAt": "2026-06-01T10:00:00.000Z" },
  "alreadyCompleted": false
}
```

Repeated calls return `"alreadyCompleted": true`.

**Error responses:**

- `404` — Session not found

### GET /api/workout-sessions/:sessionId

Fetch session details with planned exercises and actual set logs.

**Response (200):**

```json
{
  "session": { "..." : "..." },
  "plannedExercises": [ { "..." : "..." } ],
  "setLogs": [ { "..." : "..." } ]
}
```

**Error responses:**

- `404` — Session not found

### GET /api/profiles/:profileId/progression-patterns

Detect exercise-level progression patterns across recent completed sessions for a profile. This is read-only pattern detection — it does not modify plans, prescriptions, or scheduled workouts, and does not generate recommendations.

**Query parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `exerciseName` | No | — | Filter results to a specific exercise |
| `limit` | No | `10` | Number of recent completed sessions to analyze (1–50) |

**Response (200):**

```json
[
  {
    "patternType": "rep_shortfall",
    "exerciseName": "Bench Press",
    "severity": "warning",
    "evidence": {
      "sessionsAnalyzed": 5,
      "occurrences": 3,
      "sessionIds": ["uuid", "uuid", "uuid"]
    },
    "summary": "Bench Press: missed rep target in 3 of 4 recent sessions"
  }
]
```

Returns an empty array when there are fewer than 2 completed sessions or no patterns are detected.

**Pattern types:**

- `rep_shortfall` — Exercise completion rate below 90% in a majority of recent sessions
- `consistent_completion` — Exercise completed at or above target in a majority of recent sessions
- `pain_recurrence` — Pain reported for the same exercise in 2+ sessions

**Error responses:**

- `400` — Invalid profileId
- `404` — Profile not found

---

**Out of scope:** Automatic progression recommendations, plan modifications, missed workout detection, notifications, and authentication are not yet implemented. Pattern detection is read-only and does not trigger any automated changes. See `docs/specs/2026-05-04-workout-execution-logging-design.md` for the full design spec.

## Running Tests

```sh
DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm test
```

Tests require a running Postgres instance (via `docker compose up -d`) with migrations applied.
