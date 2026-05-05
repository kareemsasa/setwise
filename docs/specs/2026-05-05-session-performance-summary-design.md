# Session Performance Summary — Design Spec

Single-session performance summary: after a workout session is completed, summarize actual performance against the prescribed workout.

## Scope

- Analyze a single completed session against its exercise prescriptions.
- Read-only, derived data. No mutations to plans, prescriptions, scheduled workouts, or set logs.
- No long-term trend analysis, progression recommendations, plan adjustments, missed workout detection, notifications, auth, or AI.

## Domain Types

Added to `packages/domain/src/entities.ts`. No new database tables.

### SetPerformance

```typescript
interface SetPerformance {
  setNumber: number;
  prescribedReps: number;
  actualReps: number;
  prescribedWeightKg: number | null;
  actualWeightKg: number | null;
  rpeActual: number | null;
  painReported: boolean;
  skipped: boolean;
  logged: boolean; // false for prescribed-but-unlogged placeholder sets
}
```

### ExercisePerformanceSummary

```typescript
interface ExercisePerformanceSummary {
  exercisePrescriptionId: string;
  exerciseName: string;
  prescribedSets: number;
  loggedSets: number;
  prescribedRepsPerSet: number;
  completedReps: number;
  totalPrescribedReps: number;
  completionRate: number; // uncapped, may exceed 1
  status: "completed" | "partial" | "not_started";
  painReported: boolean;
  setBreakdown: SetPerformance[];
}
```

### SessionPerformanceSummary

```typescript
interface SessionPerformanceSummary {
  sessionId: string;
  sessionStatus: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
  totalExercises: number;
  completedExercises: number;
  totalPrescribedSets: number;
  totalLoggedSets: number;
  totalPrescribedReps: number;
  totalCompletedReps: number;
  completionRate: number; // uncapped, may exceed 1
  painReported: boolean;
  exercises: ExercisePerformanceSummary[];
}
```

## Reps Comparison Rule

- **Logged sets**: use `SetLog.prescribedReps` as the per-set target (denormalized snapshot captured at execution time).
- **Unlogged prescribed sets**: use `ExercisePrescription.repMax` as the expected target.
- `prescribedRepsPerSet` at the exercise level uses `ExercisePrescription.repMax` as a summary convenience.
- `repMin` is available for future richer statuses but not used in this slice.

## Exercise Status Definitions

- `"not_started"`: zero logged sets.
- `"partial"`: at least one logged set, but loggedSets < prescribedSets OR completedReps < totalPrescribedReps.
- `"completed"`: loggedSets >= prescribedSets AND completedReps >= totalPrescribedReps.

## Duplicate Set Log Handling

- Group logs by `exercisePrescriptionId + setNumber`.
- If multiple logs exist for the same combination, use the latest one by `createdAt`.
- Proper edit/correction UX is future work.

## Extra Sets Beyond Prescription

Extra logged sets (setNumber > prescribedSets) are included in:
- `setBreakdown`
- `loggedSets`
- `completedReps`
- pain detection

Extra sets are NOT included in:
- `totalPrescribedSets`
- `totalPrescribedReps`

This means `completionRate` may exceed 1.

## Skipped Sets

- `skipped: true` counts as `logged: true`.
- `actualReps` remains whatever is stored on the set log (typically 0).
- Skipped sets contribute to `loggedSets`.
- Skipped sets do not add completed reps unless `actualReps > 0`.
- Skipped sets can still carry `painReported` if present.
- No skipped-set UX in this slice. This is only summary behavior for data that may already exist.

## Unlogged Set Placeholders

For each prescribed set number without a matching log, include a placeholder in `setBreakdown`:

```typescript
{
  setNumber: N,
  prescribedReps: exercisePrescription.repMax,
  actualReps: 0,
  prescribedWeightKg: exercisePrescription.weightKg,
  actualWeightKg: null,
  rpeActual: null,
  painReported: false,
  skipped: false,
  logged: false,
}
```

## Pure Calculation Function

**Location**: `packages/training-core/src/session-summary.ts`

**Input**:

```typescript
interface SessionSummaryInput {
  sessionId: string;
  sessionStatus: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
  prescriptions: ExercisePrescription[];
  setLogs: SetLog[];
}
```

**Behavior**:

1. Group `setLogs` by `exercisePrescriptionId`.
2. Dedup within each group by `setNumber` (latest `createdAt` wins).
3. For each prescription, build `setBreakdown`:
   - One entry per prescribed set number (1..prescribedSets).
   - Additional entries for extra logged sets beyond prescribedSets.
   - Logged sets get `logged: true` with actual values.
   - Unlogged sets get placeholder with `logged: false`.
4. Compute exercise-level aggregates and status.
5. Compute session-level aggregates.

**Pure function. No I/O, no side effects.**

Exported from `packages/training-core/src/index.ts`.

## API Route

### `GET /api/workout-sessions/:sessionId/summary`

**Registered in**: `apps/api/src/routes/workout-sessions.ts`

**Behavior**:

1. Validate `sessionId` with `sessionByIdParamsSchema`.
2. Fetch session from DB. Return 404 if not found.
3. If session has a `scheduledWorkoutId`, resolve workout template and fetch exercise prescriptions.
4. If no `scheduledWorkoutId`, use empty prescriptions array.
5. Fetch all set logs for the session.
6. Map DB rows to domain types (decimal-to-number conversions).
7. Call `computeSessionSummary()` from `@setwise/training-core`.
8. Return 200 with the `SessionPerformanceSummary`.

**Responses**:

- `200`: summary object (including for no-logs and no-prescriptions cases).
- `404`: session does not exist.

**Not included in `GET /api/workout-sessions/:sessionId`**. Summary is a separate endpoint.

## Tests

### Unit Tests: `packages/training-core/tests/session-summary.test.ts`

Pure function tests with constructed inputs:

1. Fully completed workout — all sets logged, reps meet/exceed targets.
2. Partially completed workout — mix of completed and partial exercises.
3. No set logs — all `"not_started"`, zeros, completionRate 0.
4. Pain reported — pain on some sets propagates to exercise and session level.
5. Reps below prescribed — all sets logged but actualReps < prescribedReps.
6. Extra logged sets — beyond prescribed count, visible in breakdown/actuals but not in prescribed totals.
7. Duplicate set logs (latest wins) — dedup by prescription+setNumber.
8. No prescriptions (ad-hoc session) — empty exercises, zeroed aggregates.
9. Skipped sets — `skipped: true` sets are `logged: true` with their actualReps.
10. Unlogged sets in breakdown — placeholder entries with `logged: false`.

### Integration Tests: `apps/api/tests/session-summary.test.ts`

HTTP endpoint tests with real DB:

1. 200 with full summary — log all sets, verify shape.
2. 200 with no logs — session exists, no sets logged.
3. 200 for in-progress session — not completed, some logs.
4. 404 for missing session.
5. 200 for session without scheduled workout — empty exercises.
6. Snapshot vs live prescription — mutate prescription after logging, verify summary uses logged `prescribedReps`.

## Web

**Location**: `apps/web/src/app/workouts/[id]/workout-execution.tsx`

In `CompletedView`, after existing duration/notes display:

1. Fetch `GET /api/workout-sessions/:sessionId/summary` on completion or on page load if already completed.
2. If fetch fails, still render the completed view. Show a small error message or omit the summary panel.
3. Show session overview: exercises completed, sets completed, reps completed, completion rate %, pain flag.
4. Show per-exercise breakdown table: name, status badge, sets ratio, reps ratio, pain flag.
5. Show per-set breakdown: set number, prescribed/actual reps, weight, pain.

**Not shown for in-progress sessions.** Only rendered when `sessionStatus === "completed"`.

No charts, trends, recommendations, or dashboards.

## README

Document the new endpoint in existing API docs:

- Endpoint, method, response shape.
- Single-session analysis only.
- Long-term trend analysis and plan adjustment are out of scope.
