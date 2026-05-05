# Session Performance Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement single-session performance summaries that compare actual workout execution against prescribed exercises.

**Architecture:** Pure summary calculation in `packages/training-core`. Thin API route in `apps/api` that fetches data and delegates to the pure function. Web UI in the existing `CompletedView` component. Domain types in `packages/domain`.

**Tech Stack:** TypeScript, Vitest, Fastify, Drizzle, React (Next.js client component)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `packages/domain/src/entities.ts` | Add summary type interfaces |
| Create | `packages/training-core/src/rules/session-summary.ts` | Pure summary calculation function |
| Modify | `packages/training-core/src/rules/index.ts` | Re-export session-summary |
| Create | `packages/training-core/tests/session-summary.test.ts` | Unit tests for pure function |
| Modify | `apps/api/src/routes/workout-sessions.ts` | Add GET /:sessionId/summary route |
| Create | `apps/api/tests/session-summary.test.ts` | Integration tests for summary endpoint |
| Modify | `apps/web/src/app/workouts/[id]/workout-execution.tsx` | Show summary in CompletedView |
| Modify | `docs/specs/2026-05-04-workout-execution-logging-design.md` | Document new endpoint |

---

## Note: Duplicate Set Log Dedup

The `set_logs` table has no `created_at` column. For the "latest wins" dedup rule (multiple logs for the same `exercisePrescriptionId + setNumber`), the pure function will take the **last occurrence** in the input array. The API route will fetch set logs in default insertion order (ordered by `setLogs.id` ascending), so the last array element for a given key is the most recently inserted.

---

### Task 1: Add Domain Types

**Files:**
- Modify: `packages/domain/src/entities.ts` (append after line 132, after the `SetLog` interface)

- [ ] **Step 1: Add summary type interfaces to entities.ts**

Append these interfaces after the `SetLog` interface (after line 132):

```typescript
// --- Session performance summary ---

export type ExerciseCompletionStatus = "completed" | "partial" | "not_started";

export interface SetPerformance {
  setNumber: number;
  prescribedReps: number;
  actualReps: number;
  prescribedWeightKg: number | null;
  actualWeightKg: number | null;
  rpeActual: number | null;
  painReported: boolean;
  skipped: boolean;
  logged: boolean;
}

export interface ExercisePerformanceSummary {
  exercisePrescriptionId: string;
  exerciseName: string;
  prescribedSets: number;
  loggedSets: number;
  prescribedRepsPerSet: number;
  completedReps: number;
  totalPrescribedReps: number;
  completionRate: number;
  status: ExerciseCompletionStatus;
  painReported: boolean;
  setBreakdown: SetPerformance[];
}

export interface SessionPerformanceSummary {
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
  completionRate: number;
  painReported: boolean;
  exercises: ExercisePerformanceSummary[];
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /home/kareem/code/personal/setwise && pnpm --filter @setwise/domain run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/entities.ts
git commit -m "feat(domain): add session performance summary types"
```

---

### Task 2: Implement Pure Summary Calculation

**Files:**
- Create: `packages/training-core/src/rules/session-summary.ts`
- Modify: `packages/training-core/src/rules/index.ts`

- [ ] **Step 1: Create session-summary.ts with the pure function**

Create `packages/training-core/src/rules/session-summary.ts`:

```typescript
import type {
  ExercisePrescription,
  SetLog,
  WorkoutSessionStatus,
  SetPerformance,
  ExercisePerformanceSummary,
  ExerciseCompletionStatus,
  SessionPerformanceSummary,
} from "@setwise/domain";

export interface SessionSummaryInput {
  sessionId: string;
  sessionStatus: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
  prescriptions: ExercisePrescription[];
  setLogs: SetLog[];
}

/**
 * Dedup set logs by exercisePrescriptionId + setNumber.
 * When duplicates exist, keep the last occurrence in the array
 * (the API fetches in insertion order, so last = most recent).
 */
function dedupSetLogs(logs: SetLog[]): SetLog[] {
  const map = new Map<string, SetLog>();
  for (const log of logs) {
    const key = `${log.exercisePrescriptionId ?? "null"}:${log.setNumber}`;
    map.set(key, log);
  }
  return Array.from(map.values());
}

function buildSetBreakdown(
  prescription: ExercisePrescription,
  logs: SetLog[],
): SetPerformance[] {
  const logsBySetNumber = new Map<number, SetLog>();
  for (const log of logs) {
    logsBySetNumber.set(log.setNumber, log);
  }

  const breakdown: SetPerformance[] = [];

  // Prescribed sets (1..prescribedSets)
  for (let i = 1; i <= prescription.sets; i++) {
    const log = logsBySetNumber.get(i);
    if (log) {
      breakdown.push({
        setNumber: i,
        prescribedReps: log.prescribedReps,
        actualReps: log.actualReps,
        prescribedWeightKg: prescription.weightKg,
        actualWeightKg: log.actualWeightKg,
        rpeActual: log.rpeActual,
        painReported: log.painReported,
        skipped: log.skipped,
        logged: true,
      });
      logsBySetNumber.delete(i);
    } else {
      breakdown.push({
        setNumber: i,
        prescribedReps: prescription.repMax,
        actualReps: 0,
        prescribedWeightKg: prescription.weightKg,
        actualWeightKg: null,
        rpeActual: null,
        painReported: false,
        skipped: false,
        logged: false,
      });
    }
  }

  // Extra sets beyond prescription (sorted by set number)
  const extras = Array.from(logsBySetNumber.entries()).sort(
    ([a], [b]) => a - b,
  );
  for (const [setNumber, log] of extras) {
    breakdown.push({
      setNumber,
      prescribedReps: log.prescribedReps,
      actualReps: log.actualReps,
      prescribedWeightKg: prescription.weightKg,
      actualWeightKg: log.actualWeightKg,
      rpeActual: log.rpeActual,
      painReported: log.painReported,
      skipped: log.skipped,
      logged: true,
    });
  }

  return breakdown;
}

function computeExerciseSummary(
  prescription: ExercisePrescription,
  logs: SetLog[],
): ExercisePerformanceSummary {
  const breakdown = buildSetBreakdown(prescription, logs);
  const loggedSets = breakdown.filter((s) => s.logged).length;
  const completedReps = breakdown
    .filter((s) => s.logged)
    .reduce((sum, s) => sum + s.actualReps, 0);
  const totalPrescribedReps = prescription.repMax * prescription.sets;
  const completionRate =
    totalPrescribedReps > 0 ? completedReps / totalPrescribedReps : 0;
  const painReported = breakdown.some((s) => s.painReported);

  let status: ExerciseCompletionStatus;
  if (loggedSets === 0) {
    status = "not_started";
  } else if (
    loggedSets >= prescription.sets &&
    completedReps >= totalPrescribedReps
  ) {
    status = "completed";
  } else {
    status = "partial";
  }

  return {
    exercisePrescriptionId: prescription.id,
    exerciseName: prescription.exerciseName,
    prescribedSets: prescription.sets,
    loggedSets,
    prescribedRepsPerSet: prescription.repMax,
    completedReps,
    totalPrescribedReps,
    completionRate,
    status,
    painReported,
    setBreakdown: breakdown,
  };
}

export function computeSessionSummary(
  input: SessionSummaryInput,
): SessionPerformanceSummary {
  const deduped = dedupSetLogs(input.setLogs);

  // Group logs by exercisePrescriptionId
  const logsByPrescription = new Map<string, SetLog[]>();
  for (const log of deduped) {
    if (log.exercisePrescriptionId == null) continue;
    const existing = logsByPrescription.get(log.exercisePrescriptionId) ?? [];
    existing.push(log);
    logsByPrescription.set(log.exercisePrescriptionId, existing);
  }

  const exercises = input.prescriptions.map((p) => {
    const logs = logsByPrescription.get(p.id) ?? [];
    return computeExerciseSummary(p, logs);
  });

  const totalPrescribedSets = exercises.reduce(
    (sum, e) => sum + e.prescribedSets,
    0,
  );
  const totalLoggedSets = exercises.reduce((sum, e) => sum + e.loggedSets, 0);
  const totalPrescribedReps = exercises.reduce(
    (sum, e) => sum + e.totalPrescribedReps,
    0,
  );
  const totalCompletedReps = exercises.reduce(
    (sum, e) => sum + e.completedReps,
    0,
  );

  return {
    sessionId: input.sessionId,
    sessionStatus: input.sessionStatus,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    totalExercises: input.prescriptions.length,
    completedExercises: exercises.filter((e) => e.status === "completed").length,
    totalPrescribedSets,
    totalLoggedSets,
    totalPrescribedReps,
    totalCompletedReps,
    completionRate:
      totalPrescribedReps > 0 ? totalCompletedReps / totalPrescribedReps : 0,
    painReported: exercises.some((e) => e.painReported),
    exercises,
  };
}
```

- [ ] **Step 2: Export from rules/index.ts**

Add to `packages/training-core/src/rules/index.ts`:

```typescript
export { computeSessionSummary } from "./session-summary.js";
export type { SessionSummaryInput } from "./session-summary.js";
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd /home/kareem/code/personal/setwise && pnpm --filter @setwise/training-core run typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/training-core/src/rules/session-summary.ts packages/training-core/src/rules/index.ts
git commit -m "feat(training-core): add pure session summary calculation"
```

---

### Task 3: Unit Tests for Pure Summary Function

**Files:**
- Create: `packages/training-core/tests/session-summary.test.ts`

- [ ] **Step 1: Write all unit tests**

Create `packages/training-core/tests/session-summary.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeSessionSummary } from "../src/rules/session-summary.js";
import type {
  SessionSummaryInput,
  ExercisePrescription,
  SetLog,
} from "@setwise/domain";

function makePrescription(
  overrides: Partial<ExercisePrescription> & {
    id: string;
    exerciseName: string;
  },
): ExercisePrescription {
  return {
    workoutTemplateId: "template-1",
    orderInWorkout: 1,
    sets: 3,
    repMin: 8,
    repMax: 10,
    weightKg: 60,
    rpeTarget: 7,
    restSeconds: 90,
    notes: null,
    ...overrides,
  };
}

function makeSetLog(
  overrides: Partial<SetLog> & {
    exercisePrescriptionId: string;
    setNumber: number;
    actualReps: number;
  },
): SetLog {
  return {
    id: `log-${overrides.exercisePrescriptionId}-${overrides.setNumber}`,
    sessionId: "session-1",
    exerciseName: "Bench Press",
    prescribedReps: 10,
    prescribedWeightKg: 60,
    actualWeightKg: 60,
    rpeActual: null,
    painReported: false,
    painNotes: null,
    skipped: false,
    skipReason: null,
    ...overrides,
  };
}

function makeInput(
  overrides?: Partial<SessionSummaryInput>,
): SessionSummaryInput {
  return {
    sessionId: "session-1",
    sessionStatus: "completed",
    startedAt: "2026-05-05T10:00:00Z",
    completedAt: "2026-05-05T11:00:00Z",
    prescriptions: [],
    setLogs: [],
    ...overrides,
  };
}

describe("computeSessionSummary", () => {
  it("fully completed workout", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 3,
        actualReps: 11,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.totalExercises).toBe(1);
    expect(result.completedExercises).toBe(1);
    expect(result.totalPrescribedSets).toBe(3);
    expect(result.totalLoggedSets).toBe(3);
    expect(result.totalPrescribedReps).toBe(30);
    expect(result.totalCompletedReps).toBe(31);
    expect(result.completionRate).toBeGreaterThanOrEqual(1);
    expect(result.painReported).toBe(false);
    expect(result.exercises[0].status).toBe("completed");
  });

  it("partially completed workout", () => {
    const rx1 = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
    });
    const rx2 = makePrescription({
      id: "rx-2",
      exerciseName: "Squat",
      sets: 3,
      repMax: 8,
      orderInWorkout: 2,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 3,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-2",
        exerciseName: "Squat",
        setNumber: 1,
        prescribedReps: 8,
        actualReps: 6,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx1, rx2], setLogs: logs }),
    );

    expect(result.totalExercises).toBe(2);
    expect(result.completedExercises).toBe(1);
    expect(result.exercises[0].status).toBe("completed");
    expect(result.exercises[1].status).toBe("partial");
    expect(result.exercises[1].loggedSets).toBe(1);
    expect(result.exercises[1].completedReps).toBe(6);
  });

  it("no set logs — all not_started", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
    });

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: [] }),
    );

    expect(result.totalExercises).toBe(1);
    expect(result.completedExercises).toBe(0);
    expect(result.totalLoggedSets).toBe(0);
    expect(result.totalCompletedReps).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.exercises[0].status).toBe("not_started");
    expect(result.exercises[0].setBreakdown).toHaveLength(3);
    expect(result.exercises[0].setBreakdown[0].logged).toBe(false);
  });

  it("pain reported propagates to exercise and session", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 2,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
        painReported: false,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 8,
        painReported: true,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.painReported).toBe(true);
    expect(result.exercises[0].painReported).toBe(true);
    expect(result.exercises[0].setBreakdown[0].painReported).toBe(false);
    expect(result.exercises[0].setBreakdown[1].painReported).toBe(true);
  });

  it("reps below prescribed — status partial", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 8,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 7,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 3,
        actualReps: 6,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].status).toBe("partial");
    expect(result.exercises[0].loggedSets).toBe(3);
    expect(result.exercises[0].completedReps).toBe(21);
    expect(result.exercises[0].totalPrescribedReps).toBe(30);
    expect(result.exercises[0].completionRate).toBeCloseTo(0.7);
  });

  it("extra logged sets appear in breakdown but not prescribed totals", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 2,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 3,
        actualReps: 8,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].setBreakdown).toHaveLength(3);
    expect(result.exercises[0].loggedSets).toBe(3);
    expect(result.exercises[0].prescribedSets).toBe(2);
    expect(result.exercises[0].totalPrescribedReps).toBe(20);
    expect(result.exercises[0].completedReps).toBe(28);
    expect(result.exercises[0].completionRate).toBe(1.4);
    expect(result.exercises[0].status).toBe("completed");
  });

  it("duplicate set logs — last occurrence wins", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 1,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        id: "log-first",
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 5,
      }),
      makeSetLog({
        id: "log-second",
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].completedReps).toBe(10);
    expect(result.exercises[0].setBreakdown[0].actualReps).toBe(10);
  });

  it("no prescriptions (ad-hoc session) — empty exercises", () => {
    const result = computeSessionSummary(
      makeInput({ prescriptions: [], setLogs: [] }),
    );

    expect(result.totalExercises).toBe(0);
    expect(result.completedExercises).toBe(0);
    expect(result.totalPrescribedSets).toBe(0);
    expect(result.totalLoggedSets).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.exercises).toEqual([]);
  });

  it("skipped sets count as logged but do not add reps", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 2,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 0,
        skipped: true,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].loggedSets).toBe(2);
    expect(result.exercises[0].completedReps).toBe(10);
    expect(result.exercises[0].status).toBe("partial");
    expect(result.exercises[0].setBreakdown[1].logged).toBe(true);
    expect(result.exercises[0].setBreakdown[1].skipped).toBe(true);
  });

  it("unlogged sets appear in breakdown with logged: false", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
      weightKg: 60,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].setBreakdown).toHaveLength(3);

    const unlogged = result.exercises[0].setBreakdown[1];
    expect(unlogged.logged).toBe(false);
    expect(unlogged.setNumber).toBe(2);
    expect(unlogged.prescribedReps).toBe(10);
    expect(unlogged.actualReps).toBe(0);
    expect(unlogged.prescribedWeightKg).toBe(60);
    expect(unlogged.actualWeightKg).toBeNull();
    expect(unlogged.painReported).toBe(false);
    expect(unlogged.skipped).toBe(false);
  });

  it("skipped sets can carry painReported", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 1,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 0,
        skipped: true,
        painReported: true,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].painReported).toBe(true);
    expect(result.painReported).toBe(true);
    expect(result.exercises[0].setBreakdown[0].skipped).toBe(true);
    expect(result.exercises[0].setBreakdown[0].painReported).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/kareem/code/personal/setwise && pnpm --filter @setwise/training-core run test`
Expected: all tests PASS (the implementation was written in Task 2)

- [ ] **Step 3: Commit**

```bash
git add packages/training-core/tests/session-summary.test.ts
git commit -m "test(training-core): add unit tests for session summary calculation"
```

---

### Task 4: API Summary Route

**Files:**
- Modify: `apps/api/src/routes/workout-sessions.ts` (add new route after the GET /:sessionId route, around line 277)

- [ ] **Step 1: Add the summary route**

Add this route inside the `workoutSessionRoutes` plugin, after the existing `GET /:sessionId` handler (before the closing `};`):

```typescript
  // GET /api/workout-sessions/:sessionId/summary
  app.get("/:sessionId/summary", async (request, reply) => {
    const paramsParsed = sessionByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId } = paramsParsed.data;

    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return reply.status(404).send({ error: "Workout session not found" });
    }

    // Resolve prescriptions via scheduled workout's template
    let prescriptionRows: typeof exercisePrescriptionRows = [];
    if (session.scheduledWorkoutId) {
      const [sw] = await db
        .select()
        .from(scheduledWorkouts)
        .where(eq(scheduledWorkouts.id, session.scheduledWorkoutId))
        .limit(1);

      if (sw) {
        prescriptionRows = await db
          .select()
          .from(exercisePrescriptions)
          .where(
            eq(
              exercisePrescriptions.workoutTemplateId,
              sw.workoutTemplateId,
            ),
          )
          .orderBy(asc(exercisePrescriptions.orderInWorkout));
      }
    }

    // Fetch all set logs for this session, ordered by id (insertion order)
    const logRows = await db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionId, sessionId))
      .orderBy(asc(setLogs.id));

    // Map DB rows to domain types
    const prescriptions = prescriptionRows.map((p) => ({
      id: p.id,
      workoutTemplateId: p.workoutTemplateId,
      exerciseName: p.exerciseName,
      orderInWorkout: p.orderInWorkout,
      sets: p.sets,
      repMin: p.repMin,
      repMax: p.repMax,
      weightKg: p.weightKg ? Number(p.weightKg) : null,
      rpeTarget: p.rpeTarget,
      restSeconds: p.restSeconds,
      notes: p.notes,
    }));

    const logs = logRows.map((log) => ({
      id: log.id,
      sessionId: log.sessionId,
      exercisePrescriptionId: log.exercisePrescriptionId,
      exerciseName: log.exerciseName,
      setNumber: log.setNumber,
      prescribedReps: log.prescribedReps,
      actualReps: log.actualReps,
      prescribedWeightKg: log.prescribedWeightKg
        ? Number(log.prescribedWeightKg)
        : null,
      actualWeightKg: log.actualWeightKg ? Number(log.actualWeightKg) : null,
      rpeActual: log.rpeActual ? Number(log.rpeActual) : null,
      painReported: log.painReported,
      painNotes: log.painNotes,
      skipped: log.skipped,
      skipReason: log.skipReason,
    }));

    const summary = computeSessionSummary({
      sessionId,
      sessionStatus: session.status,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      prescriptions,
      setLogs: logs,
    });

    return reply.status(200).send(summary);
  });
```

Note: The variable `prescriptionRows` needs a type. Use a local query first and assign to `let`:

```typescript
let prescriptionRows: Awaited<
  ReturnType<typeof db.select<typeof exercisePrescriptions>>
> = [];
```

Actually, the simplest approach is to use a conditional pattern. Here is the complete route code that avoids the type issue:

```typescript
  // GET /api/workout-sessions/:sessionId/summary
  app.get("/:sessionId/summary", async (request, reply) => {
    const paramsParsed = sessionByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId } = paramsParsed.data;

    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return reply.status(404).send({ error: "Workout session not found" });
    }

    // Resolve prescriptions via scheduled workout's template
    let prescriptionRows: {
      id: string;
      workoutTemplateId: string;
      exerciseName: string;
      orderInWorkout: number;
      sets: number;
      repMin: number;
      repMax: number;
      weightKg: string | null;
      rpeTarget: number | null;
      restSeconds: number;
      notes: string | null;
    }[] = [];

    if (session.scheduledWorkoutId) {
      const [sw] = await db
        .select()
        .from(scheduledWorkouts)
        .where(eq(scheduledWorkouts.id, session.scheduledWorkoutId))
        .limit(1);

      if (sw) {
        prescriptionRows = await db
          .select()
          .from(exercisePrescriptions)
          .where(
            eq(
              exercisePrescriptions.workoutTemplateId,
              sw.workoutTemplateId,
            ),
          )
          .orderBy(asc(exercisePrescriptions.orderInWorkout));
      }
    }

    // Fetch all set logs for this session, ordered by id (insertion order)
    const logRows = await db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionId, sessionId))
      .orderBy(asc(setLogs.id));

    // Map DB rows to domain types for the pure function
    const prescriptions = prescriptionRows.map((p) => ({
      id: p.id,
      workoutTemplateId: p.workoutTemplateId,
      exerciseName: p.exerciseName,
      orderInWorkout: p.orderInWorkout,
      sets: p.sets,
      repMin: p.repMin,
      repMax: p.repMax,
      weightKg: p.weightKg ? Number(p.weightKg) : null,
      rpeTarget: p.rpeTarget,
      restSeconds: p.restSeconds,
      notes: p.notes,
    }));

    const mappedLogs = logRows.map((log) => ({
      id: log.id,
      sessionId: log.sessionId,
      exercisePrescriptionId: log.exercisePrescriptionId,
      exerciseName: log.exerciseName,
      setNumber: log.setNumber,
      prescribedReps: log.prescribedReps,
      actualReps: log.actualReps,
      prescribedWeightKg: log.prescribedWeightKg
        ? Number(log.prescribedWeightKg)
        : null,
      actualWeightKg: log.actualWeightKg ? Number(log.actualWeightKg) : null,
      rpeActual: log.rpeActual ? Number(log.rpeActual) : null,
      painReported: log.painReported,
      painNotes: log.painNotes,
      skipped: log.skipped,
      skipReason: log.skipReason,
    }));

    const summary = computeSessionSummary({
      sessionId,
      sessionStatus: session.status,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      prescriptions,
      setLogs: mappedLogs,
    });

    return reply.status(200).send(summary);
  });
```

Also add the import at the top of the file:

```typescript
import { computeSessionSummary } from "@setwise/training-core";
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /home/kareem/code/personal/setwise && pnpm --filter api run typecheck`

If the `@setwise/training-core` build output is needed, first run:
`cd /home/kareem/code/personal/setwise && pnpm --filter @setwise/training-core run build`

Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/workout-sessions.ts
git commit -m "feat(api): add GET /workout-sessions/:sessionId/summary route"
```

---

### Task 5: Integration Tests for Summary Endpoint

**Files:**
- Create: `apps/api/tests/session-summary.test.ts`

- [ ] **Step 1: Write all integration tests**

Create `apps/api/tests/session-summary.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { db, eq, exercisePrescriptions } from "@setwise/db";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const validIntake = {
  injuriesAndRestrictions: [],
  equipment: {
    location: "commercial_gym",
    locationNotes: "",
    availableEquipment: ["barbell", "dumbbells"],
    equipmentLimitations: "",
  },
  goals: {
    primaryGoal: "strength",
    secondaryGoals: [],
    specificTargets: ["bench 100kg"],
    timeline: "6 months",
  },
  schedule: {
    daysPerWeek: 4,
    availableDays: ["monday", "tuesday", "thursday", "friday"],
    preferredTime: "morning",
    sessionLengthMinutes: 60,
    upcomingDisruptions: "",
  },
  trainingHistory: {
    experienceDuration: "2 years",
    recentProgram: "PPL",
    familiarExercises: [],
    recentWorkingWeights: [],
    pastObservations: "",
  },
  preferences: {
    likedExercises: [],
    dislikedExercises: [],
    trainingStyle: "",
    cardioPreference: "",
    otherNotes: "",
  },
  safetyFlags: [],
  agentNotes: "",
};

interface ScheduledWorkoutFixture {
  profileId: string;
  planId: string;
  planVersionId: string;
  scheduledWorkoutId: string;
  exercises: Array<{
    id: string;
    exerciseName: string;
    sets: number;
    repMax: number;
    weightKg: number | null;
  }>;
}

async function createScheduledWorkoutFixture(): Promise<ScheduledWorkoutFixture> {
  const profileRes = await app.inject({
    method: "POST",
    url: "/api/profiles",
    payload: {
      name: "Summary Tester",
      email: `summary-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      heightCm: 175,
      weightKg: 80,
      dateOfBirth: "1992-03-10",
      biologicalSex: "male",
      experienceLevel: "intermediate",
    },
  });
  const profileId = profileRes.json().id;

  const consultRes = await app.inject({
    method: "POST",
    url: `/api/profiles/${profileId}/consultations`,
    payload: validIntake,
  });
  const consultationId = consultRes.json().id;

  const assessRes = await app.inject({
    method: "POST",
    url: `/api/consultations/${consultationId}/assessments`,
  });
  const assessmentId = assessRes.json().id;

  const planRes = await app.inject({
    method: "POST",
    url: `/api/assessments/${assessmentId}/plans`,
  });
  const planId = planRes.json().id;

  const approveRes = await app.inject({
    method: "POST",
    url: `/api/plans/${planId}/approve`,
  });
  const planVersionId = approveRes.json().currentVersion.id;

  const genRes = await app.inject({
    method: "POST",
    url: `/api/plans/${planId}/scheduled-workouts`,
    payload: { startDate: "2026-06-01", weeks: 1 },
  });
  const scheduledWorkoutId = genRes.json().scheduledWorkouts[0].id;

  const detailRes = await app.inject({
    method: "GET",
    url: `/api/scheduled-workouts/${scheduledWorkoutId}`,
  });
  const detail = detailRes.json();
  const exercises = detail.template.exercises.map((ex: any) => ({
    id: ex.id,
    exerciseName: ex.exerciseName,
    sets: ex.sets,
    repMax: ex.repMax,
    weightKg: ex.weightKg,
  }));

  return { profileId, planId, planVersionId, scheduledWorkoutId, exercises };
}

async function createStartedSession(
  fixture: ScheduledWorkoutFixture,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: `/api/scheduled-workouts/${fixture.scheduledWorkoutId}/start`,
  });
  return res.json().session.id;
}

async function logSet(
  sessionId: string,
  exercisePrescriptionId: string,
  setNumber: number,
  repsCompleted: number,
  opts?: { painReported?: boolean; weightKg?: number },
): Promise<void> {
  await app.inject({
    method: "POST",
    url: `/api/workout-sessions/${sessionId}/set-logs`,
    payload: {
      exercisePrescriptionId,
      setNumber,
      repsCompleted,
      painReported: opts?.painReported ?? false,
      weightKg: opts?.weightKg,
    },
  });
}

async function completeSession(sessionId: string): Promise<void> {
  await app.inject({
    method: "POST",
    url: `/api/workout-sessions/${sessionId}/complete`,
  });
}

describe("GET /api/workout-sessions/:sessionId/summary", () => {
  it("returns 200 with full summary for a completed session", async () => {
    const fixture = await createScheduledWorkoutFixture();
    const sessionId = await createStartedSession(fixture);
    const ex = fixture.exercises[0];

    for (let i = 1; i <= ex.sets; i++) {
      await logSet(sessionId, ex.id, i, ex.repMax);
    }
    await completeSession(sessionId);

    const res = await app.inject({
      method: "GET",
      url: `/api/workout-sessions/${sessionId}/summary`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sessionId).toBe(sessionId);
    expect(body.sessionStatus).toBe("completed");
    expect(body.totalExercises).toBeGreaterThan(0);
    expect(body.exercises.length).toBeGreaterThan(0);

    const exSummary = body.exercises.find(
      (e: any) => e.exercisePrescriptionId === ex.id,
    );
    expect(exSummary).toBeDefined();
    expect(exSummary.status).toBe("completed");
    expect(exSummary.loggedSets).toBe(ex.sets);
    expect(exSummary.setBreakdown.length).toBeGreaterThanOrEqual(ex.sets);
  });

  it("returns 200 with all not_started when no sets logged", async () => {
    const fixture = await createScheduledWorkoutFixture();
    const sessionId = await createStartedSession(fixture);

    const res = await app.inject({
      method: "GET",
      url: `/api/workout-sessions/${sessionId}/summary`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalLoggedSets).toBe(0);
    expect(body.totalCompletedReps).toBe(0);
    expect(body.completionRate).toBe(0);
    expect(
      body.exercises.every((e: any) => e.status === "not_started"),
    ).toBe(true);
  });

  it("returns 200 for an in-progress session", async () => {
    const fixture = await createScheduledWorkoutFixture();
    const sessionId = await createStartedSession(fixture);
    const ex = fixture.exercises[0];

    await logSet(sessionId, ex.id, 1, ex.repMax);

    const res = await app.inject({
      method: "GET",
      url: `/api/workout-sessions/${sessionId}/summary`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sessionStatus).toBe("in_progress");
    expect(body.totalLoggedSets).toBe(1);
  });

  it("returns 404 for a non-existent session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workout-sessions/00000000-0000-0000-0000-000000000000/summary",
    });

    expect(res.statusCode).toBe(404);
  });

  it("uses set log snapshot values, not live prescription values", async () => {
    const fixture = await createScheduledWorkoutFixture();
    const sessionId = await createStartedSession(fixture);
    const ex = fixture.exercises[0];
    const originalRepMax = ex.repMax;

    // Log set 1 — snapshots prescribedReps = originalRepMax
    await logSet(sessionId, ex.id, 1, originalRepMax);

    // Mutate the live exercise prescription
    await db
      .update(exercisePrescriptions)
      .set({ repMax: originalRepMax + 2 })
      .where(eq(exercisePrescriptions.id, ex.id));

    const res = await app.inject({
      method: "GET",
      url: `/api/workout-sessions/${sessionId}/summary`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const exSummary = body.exercises.find(
      (e: any) => e.exercisePrescriptionId === ex.id,
    );

    // Logged set should still use the snapshot value
    const loggedSet = exSummary.setBreakdown.find(
      (s: any) => s.logged && s.setNumber === 1,
    );
    expect(loggedSet.prescribedReps).toBe(originalRepMax);

    // Unlogged sets should use current prescription repMax
    const unloggedSet = exSummary.setBreakdown.find(
      (s: any) => !s.logged,
    );
    if (unloggedSet) {
      expect(unloggedSet.prescribedReps).toBe(originalRepMax + 2);
    }

    // Restore original value to avoid polluting other tests
    await db
      .update(exercisePrescriptions)
      .set({ repMax: originalRepMax })
      .where(eq(exercisePrescriptions.id, ex.id));
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd /home/kareem/code/personal/setwise && pnpm --filter api run test`
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/session-summary.test.ts
git commit -m "test(api): add integration tests for session summary endpoint"
```

---

### Task 6: Web — Performance Summary in CompletedView

**Files:**
- Modify: `apps/web/src/app/workouts/[id]/workout-execution.tsx`

- [ ] **Step 1: Add summary types and fetch logic to CompletedView**

In `apps/web/src/app/workouts/[id]/workout-execution.tsx`, add the summary interfaces near the top (after the existing interfaces around line 47):

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
  logged: boolean;
}

interface ExercisePerformanceSummary {
  exercisePrescriptionId: string;
  exerciseName: string;
  prescribedSets: number;
  loggedSets: number;
  prescribedRepsPerSet: number;
  completedReps: number;
  totalPrescribedReps: number;
  completionRate: number;
  status: "completed" | "partial" | "not_started";
  painReported: boolean;
  setBreakdown: SetPerformance[];
}

interface SessionPerformanceSummary {
  sessionId: string;
  sessionStatus: string;
  startedAt: string;
  completedAt: string | null;
  totalExercises: number;
  completedExercises: number;
  totalPrescribedSets: number;
  totalLoggedSets: number;
  totalPrescribedReps: number;
  totalCompletedReps: number;
  completionRate: number;
  painReported: boolean;
  exercises: ExercisePerformanceSummary[];
}
```

- [ ] **Step 2: Update CompletedView to fetch and display the summary**

Replace the `CompletedView` function (currently at lines 367-440) with:

```typescript
function CompletedView({
  session,
  exercises,
  setLogs,
}: {
  session: Session;
  exercises: Exercise[];
  setLogs: SetLogEntry[];
}) {
  const [summary, setSummary] = useState<SessionPerformanceSummary | null>(
    null,
  );
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/workout-sessions/${session.id}/summary`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch summary");
        return res.json();
      })
      .then(setSummary)
      .catch(() => setSummaryError(true));
  }, [session.id]);

  const startTime = new Date(session.startedAt);
  const endTime = session.completedAt ? new Date(session.completedAt) : null;
  const durationMin = endTime
    ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    : null;

  return (
    <div>
      <p>
        <strong>Completed</strong> — {startTime.toLocaleTimeString()} to{" "}
        {endTime?.toLocaleTimeString() ?? "—"}
        {durationMin != null ? ` (${durationMin} min)` : ""}
      </p>
      {session.notes && <p>Notes: {session.notes}</p>}

      {summary && <PerformanceSummaryPanel summary={summary} />}

      {summaryError && <RawCompletedView exercises={exercises} setLogs={setLogs} />}

      {!summary && !summaryError && (
        <p>Loading summary...</p>
      )}
    </div>
  );
}

function PerformanceSummaryPanel({
  summary,
}: {
  summary: SessionPerformanceSummary;
}) {
  const pct = (rate: number) => `${Math.round(rate * 100)}%`;

  return (
    <div style={{ marginTop: "1rem" }}>
      <h2>Performance Summary</h2>

      <div style={{ marginBottom: "1rem" }}>
        <p>
          <strong>Exercises:</strong> {summary.completedExercises}/
          {summary.totalExercises} completed
        </p>
        <p>
          <strong>Sets:</strong> {summary.totalLoggedSets}/
          {summary.totalPrescribedSets} logged
        </p>
        <p>
          <strong>Reps:</strong> {summary.totalCompletedReps}/
          {summary.totalPrescribedReps} completed ({pct(summary.completionRate)}
          )
        </p>
        {summary.painReported && (
          <p>
            <strong>Pain reported</strong> during this session
          </p>
        )}
      </div>

      {summary.exercises.map((ex) => (
        <div
          key={ex.exercisePrescriptionId}
          style={{ marginBottom: "1.5rem" }}
        >
          <h3>
            {ex.exerciseName}{" "}
            <span
              style={{
                fontSize: "0.85em",
                color:
                  ex.status === "completed"
                    ? "green"
                    : ex.status === "partial"
                      ? "orange"
                      : "#888",
              }}
            >
              [{ex.status}]
            </span>
          </h3>
          <p>
            Sets: {ex.loggedSets}/{ex.prescribedSets} — Reps:{" "}
            {ex.completedReps}/{ex.totalPrescribedReps} (
            {pct(ex.completionRate)})
            {ex.painReported && " — Pain reported"}
          </p>

          <table>
            <thead>
              <tr>
                <th>Set</th>
                <th>Prescribed</th>
                <th>Actual</th>
                <th>Weight</th>
                <th>RPE</th>
                <th>Pain</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ex.setBreakdown.map((s) => (
                <tr
                  key={s.setNumber}
                  style={{ color: s.logged ? "inherit" : "#aaa" }}
                >
                  <td>{s.setNumber}</td>
                  <td>{s.prescribedReps}</td>
                  <td>{s.logged ? s.actualReps : "—"}</td>
                  <td>
                    {s.logged && s.actualWeightKg != null
                      ? `${s.actualWeightKg}kg`
                      : "—"}
                  </td>
                  <td>{s.logged && s.rpeActual != null ? s.rpeActual : "—"}</td>
                  <td>{s.painReported ? "Yes" : "—"}</td>
                  <td>
                    {s.skipped
                      ? "Skipped"
                      : s.logged
                        ? "Logged"
                        : "Not logged"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function RawCompletedView({
  exercises,
  setLogs,
}: {
  exercises: Exercise[];
  setLogs: SetLogEntry[];
}) {
  return (
    <div>
      <p style={{ color: "#888" }}>
        <em>Could not load performance summary.</em>
      </p>
      {exercises.map((ex) => {
        const logs = setLogs.filter(
          (log) => log.exercisePrescriptionId === ex.id,
        );
        return (
          <div key={ex.id} style={{ marginBottom: "1rem" }}>
            <h3>
              {ex.orderInWorkout}. {ex.exerciseName}
            </h3>
            <p>
              Planned: {ex.sets} x{" "}
              {ex.repMin === ex.repMax
                ? ex.repMin
                : `${ex.repMin}-${ex.repMax}`}
              {ex.weightKg ? ` @ ${ex.weightKg}kg` : ""}
            </p>
            {logs.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>Planned Reps</th>
                    <th>Actual Reps</th>
                    <th>Weight</th>
                    <th>RPE</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.setNumber}</td>
                      <td>{log.prescribedReps}</td>
                      <td>{log.actualReps}</td>
                      <td>{log.actualWeightKg ?? "—"}</td>
                      <td>{log.rpeActual ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>
                <em>No sets logged.</em>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd /home/kareem/code/personal/setwise && pnpm --filter web run build`
Expected: build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/workouts/[id]/workout-execution.tsx
git commit -m "feat(web): add performance summary to completed workout view"
```

---

### Task 7: Document the New Endpoint

**Files:**
- Modify: `docs/specs/2026-05-04-workout-execution-logging-design.md`

- [ ] **Step 1: Add summary endpoint documentation**

Append to the end of `docs/specs/2026-05-04-workout-execution-logging-design.md`:

```markdown

---

## Session Performance Summary (Added 2026-05-05)

### `GET /api/workout-sessions/:sessionId/summary`

Returns a derived performance summary comparing actual execution against prescribed exercises for a single session.

**Response (200):**
```json
{
  "sessionId": "uuid",
  "sessionStatus": "completed",
  "startedAt": "ISO timestamp",
  "completedAt": "ISO timestamp | null",
  "totalExercises": 3,
  "completedExercises": 2,
  "totalPrescribedSets": 9,
  "totalLoggedSets": 7,
  "totalPrescribedReps": 90,
  "totalCompletedReps": 72,
  "completionRate": 0.8,
  "painReported": false,
  "exercises": [
    {
      "exercisePrescriptionId": "uuid",
      "exerciseName": "Bench Press",
      "prescribedSets": 3,
      "loggedSets": 3,
      "prescribedRepsPerSet": 10,
      "completedReps": 28,
      "totalPrescribedReps": 30,
      "completionRate": 0.93,
      "status": "partial",
      "painReported": false,
      "setBreakdown": [
        {
          "setNumber": 1,
          "prescribedReps": 10,
          "actualReps": 10,
          "prescribedWeightKg": 60,
          "actualWeightKg": 60,
          "rpeActual": 7,
          "painReported": false,
          "skipped": false,
          "logged": true
        }
      ]
    }
  ]
}
```

**Error responses:**
- `404`: Session not found.

**Notes:**
- This is single-session analysis only.
- Long-term trend analysis and plan adjustment are out of scope.
- Summary is read-only and derived from set log data.
- `completionRate` may exceed 1.0 when extra reps or sets are logged.
- Works for both in-progress and completed sessions.
- Returns valid summary with empty exercises for sessions without a scheduled workout.
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/2026-05-04-workout-execution-logging-design.md
git commit -m "docs: document session performance summary endpoint"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Build all packages**

Run: `cd /home/kareem/code/personal/setwise && pnpm run build`
Expected: all packages build successfully

- [ ] **Step 2: Run all tests**

Run: `cd /home/kareem/code/personal/setwise && pnpm run test`
Expected: all tests pass

- [ ] **Step 3: Run typecheck**

Run: `cd /home/kareem/code/personal/setwise && pnpm run typecheck`
Expected: no type errors

- [ ] **Step 4: Review and verify**

Check that:
- Pure function in training-core has no I/O dependencies
- API route is thin (fetch, map, delegate, return)
- Web component handles summary fetch failure gracefully
- No mutations to existing data
- Domain types are exported correctly
