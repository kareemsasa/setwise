# Scheduled Workout Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate scheduled workout instances from approved plans, creating the in-app calendar foundation.

**Architecture:** Explicit `POST /api/plans/:planId/scheduled-workouts` endpoint materializes workout templates, exercise prescriptions, and scheduled workout instances in a single DB transaction. Query endpoints serve the calendar and detail views. All generation is deterministic with conservative mock exercises.

**Tech Stack:** TypeScript, Fastify 5, Drizzle ORM (PostgreSQL), Zod, Vitest, Next.js 15

---

### Task 1: Validation Schemas and DB Exports

**Files:**
- Create: `packages/validation/src/scheduled-workout.ts`
- Modify: `packages/validation/src/index.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Create validation schemas**

```typescript
// packages/validation/src/scheduled-workout.ts
import { z } from "zod";

export const generateScheduledWorkoutsBodySchema = z.object({
  startDate: z.string().date().optional(),
  weeks: z.number().int().min(1).max(12).optional(),
});

export type GenerateScheduledWorkoutsBody = z.infer<
  typeof generateScheduledWorkoutsBodySchema
>;

export const scheduledWorkoutByIdParamsSchema = z.object({
  scheduledWorkoutId: z.string().uuid(),
});

export type ScheduledWorkoutByIdParams = z.infer<
  typeof scheduledWorkoutByIdParamsSchema
>;

export const scheduledWorkoutQuerySchema = z.object({
  start: z.string().date().optional(),
  end: z.string().date().optional(),
});

export type ScheduledWorkoutQuery = z.infer<typeof scheduledWorkoutQuerySchema>;
```

Note: `planByIdParamsSchema` already exists in `packages/validation/src/plan.ts` and is reused for the generation endpoint params. No need to duplicate it.

- [ ] **Step 2: Export from validation index**

Add to `packages/validation/src/index.ts`:

```typescript
export * from "./scheduled-workout.js";
```

- [ ] **Step 3: Add DB operator exports**

Add `gte`, `lte`, `asc` to `packages/db/src/index.ts`:

```typescript
export { eq, and, inArray, desc, gte, lte, asc } from "drizzle-orm";
```

- [ ] **Step 4: Verify build**

Run: `pnpm build --filter=@setwise/validation --filter=@setwise/db`
Expected: Clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/validation/src/scheduled-workout.ts packages/validation/src/index.ts packages/db/src/index.ts
git commit -m "feat: add scheduled workout validation schemas and DB operator exports"
```

---

### Task 2: Mock Exercise Generator

**Files:**
- Create: `apps/api/src/mock-exercise-generator.ts`

- [ ] **Step 1: Create mock exercise generator**

```typescript
// apps/api/src/mock-exercise-generator.ts

export interface MockExercise {
  exerciseName: string;
  orderInWorkout: number;
  sets: number;
  repMin: number;
  repMax: number;
  weightKg: null;
  rpeTarget: number;
  restSeconds: number;
  notes: null;
}

interface SessionParams {
  exercises: string[];
  sets: number;
  repMin: number;
  repMax: number;
  rpe: number;
  rest: number;
}

const SESSION_EXERCISES: Record<string, SessionParams> = {
  "Heavy Compound": {
    exercises: [
      "Goblet Squat",
      "Dumbbell Bench Press",
      "Dumbbell Row",
      "Romanian Deadlift",
    ],
    sets: 4,
    repMin: 4,
    repMax: 6,
    rpe: 8,
    rest: 180,
  },
  "Accessory Strength": {
    exercises: [
      "Split Squat",
      "Incline DB Press",
      "Cable Row",
      "Face Pull",
      "Lateral Raise",
    ],
    sets: 3,
    repMin: 8,
    repMax: 12,
    rpe: 7,
    rest: 90,
  },
  "Power Development": {
    exercises: [
      "DB Shoulder Press",
      "Split Squat",
      "Cable Row",
      "Farmer Carry",
    ],
    sets: 4,
    repMin: 5,
    repMax: 8,
    rpe: 7,
    rest: 120,
  },
  "Upper Hypertrophy": {
    exercises: [
      "Dumbbell Bench Press",
      "Cable Row",
      "DB Shoulder Press",
      "Cable Pressdown",
      "Face Pull",
    ],
    sets: 3,
    repMin: 10,
    repMax: 15,
    rpe: 7,
    rest: 60,
  },
  "Lower Hypertrophy": {
    exercises: [
      "Leg Press",
      "Split Squat",
      "Leg Curl",
      "Calf Raise",
      "Hip Thrust",
    ],
    sets: 3,
    repMin: 10,
    repMax: 15,
    rpe: 7,
    rest: 60,
  },
  "Full Body Volume": {
    exercises: [
      "Goblet Squat",
      "Dumbbell Bench Press",
      "Cable Row",
      "DB Shoulder Press",
      "Plank",
    ],
    sets: 3,
    repMin: 10,
    repMax: 12,
    rpe: 7,
    rest: 60,
  },
  "Endurance Circuit": {
    exercises: [
      "Farmer Carry",
      "Incline Walk",
      "Stationary Bike",
      "Goblet Squat",
      "Plank",
    ],
    sets: 3,
    repMin: 12,
    repMax: 20,
    rpe: 6,
    rest: 45,
  },
  "Tempo Work": {
    exercises: [
      "Goblet Squat",
      "Dumbbell Bench Press",
      "Cable Row",
      "Romanian Deadlift",
    ],
    sets: 3,
    repMin: 8,
    repMax: 10,
    rpe: 7,
    rest: 90,
  },
  "Conditioning": {
    exercises: [
      "Incline Walk",
      "Stationary Bike",
      "Farmer Carry",
      "Plank",
    ],
    sets: 3,
    repMin: 10,
    repMax: 15,
    rpe: 6,
    rest: 60,
  },
  "Full Body": {
    exercises: [
      "Goblet Squat",
      "Dumbbell Bench Press",
      "Dumbbell Row",
      "DB Shoulder Press",
      "Plank",
    ],
    sets: 3,
    repMin: 8,
    repMax: 12,
    rpe: 7,
    rest: 90,
  },
  "Upper Focus": {
    exercises: [
      "Dumbbell Bench Press",
      "Cable Row",
      "DB Shoulder Press",
      "Face Pull",
      "Cable Pressdown",
    ],
    sets: 3,
    repMin: 8,
    repMax: 12,
    rpe: 7,
    rest: 90,
  },
  "Lower Focus": {
    exercises: [
      "Goblet Squat",
      "Romanian Deadlift",
      "Leg Press",
      "Split Squat",
      "Calf Raise",
    ],
    sets: 3,
    repMin: 8,
    repMax: 12,
    rpe: 7,
    rest: 90,
  },
};

const DEFAULT_PARAMS: SessionParams = {
  exercises: [
    "Goblet Squat",
    "Dumbbell Bench Press",
    "Dumbbell Row",
    "Plank",
  ],
  sets: 3,
  repMin: 8,
  repMax: 12,
  rpe: 7,
  rest: 90,
};

export function generateMockExercises(sessionType: string): MockExercise[] {
  const params = SESSION_EXERCISES[sessionType] ?? DEFAULT_PARAMS;
  return params.exercises.map((name, i) => ({
    exerciseName: name,
    orderInWorkout: i + 1,
    sets: params.sets,
    repMin: params.repMin,
    repMax: params.repMax,
    weightKg: null,
    rpeTarget: params.rpe,
    restSeconds: params.rest,
    notes: null,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/mock-exercise-generator.ts
git commit -m "feat: add deterministic mock exercise generator"
```

---

### Task 3: Date Calculation Helper (TDD)

**Files:**
- Create: `apps/api/src/schedule-dates.ts`
- Create: `apps/api/tests/schedule-dates.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/tests/schedule-dates.test.ts
import { describe, it, expect } from "vitest";
import {
  dayNameToDbDay,
  generateScheduledDates,
} from "../src/schedule-dates.js";

describe("dayNameToDbDay", () => {
  it("maps monday to 0", () => {
    expect(dayNameToDbDay("monday")).toBe(0);
  });

  it("maps sunday to 6", () => {
    expect(dayNameToDbDay("sunday")).toBe(6);
  });

  it("is case-insensitive", () => {
    expect(dayNameToDbDay("Monday")).toBe(0);
    expect(dayNameToDbDay("FRIDAY")).toBe(4);
  });

  it("returns undefined for unknown day", () => {
    expect(dayNameToDbDay("notaday")).toBeUndefined();
  });
});

describe("generateScheduledDates", () => {
  // 2026-06-01 is a Monday
  const startDate = "2026-06-01";

  it("generates dates for a single day over 1 week", () => {
    const dates = generateScheduledDates(startDate, 1, [0]); // Monday
    expect(dates).toEqual([{ date: "2026-06-01", dayOfWeek: 0 }]);
  });

  it("generates dates for a single day over 4 weeks", () => {
    const dates = generateScheduledDates(startDate, 4, [0]); // Monday
    expect(dates).toEqual([
      { date: "2026-06-01", dayOfWeek: 0 },
      { date: "2026-06-08", dayOfWeek: 0 },
      { date: "2026-06-15", dayOfWeek: 0 },
      { date: "2026-06-22", dayOfWeek: 0 },
    ]);
  });

  it("includes startDate when it matches a template day", () => {
    // startDate is Monday (dbDay=0), template day is Monday
    const dates = generateScheduledDates(startDate, 1, [0]);
    expect(dates[0].date).toBe("2026-06-01");
  });

  it("uses next occurrence when template day has passed in start week", () => {
    // 2026-06-03 is Wednesday, template day is Monday (dbDay=0)
    const dates = generateScheduledDates("2026-06-03", 1, [0]);
    // Monday has passed in this week, next Monday is 2026-06-08
    expect(dates).toEqual([{ date: "2026-06-08", dayOfWeek: 0 }]);
  });

  it("generates multiple days per week sorted by date", () => {
    // Monday=0, Thursday=3
    const dates = generateScheduledDates(startDate, 2, [0, 3]);
    expect(dates).toEqual([
      { date: "2026-06-01", dayOfWeek: 0 },
      { date: "2026-06-04", dayOfWeek: 3 },
      { date: "2026-06-08", dayOfWeek: 0 },
      { date: "2026-06-11", dayOfWeek: 3 },
    ]);
  });

  it("generates 4 days/week over 4 weeks = 16 dates", () => {
    // Mon=0, Tue=1, Thu=3, Fri=4
    const dates = generateScheduledDates(startDate, 4, [0, 1, 3, 4]);
    expect(dates).toHaveLength(16);
    // First week
    expect(dates[0].date).toBe("2026-06-01"); // Mon
    expect(dates[1].date).toBe("2026-06-02"); // Tue
    expect(dates[2].date).toBe("2026-06-04"); // Thu
    expect(dates[3].date).toBe("2026-06-05"); // Fri
  });

  it("returns empty array when no template days", () => {
    const dates = generateScheduledDates(startDate, 4, []);
    expect(dates).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm vitest run tests/schedule-dates.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schedule-dates.ts**

```typescript
// apps/api/src/schedule-dates.ts

const DAY_NAME_TO_DB: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export function dayNameToDbDay(name: string): number | undefined {
  return DAY_NAME_TO_DB[name.toLowerCase()];
}

export function generateScheduledDates(
  startDate: string,
  weeks: number,
  templateDays: number[],
): { date: string; dayOfWeek: number }[] {
  const start = new Date(startDate + "T00:00:00");
  const endMs = start.getTime() + weeks * 7 * 24 * 60 * 60 * 1000;
  const results: { date: string; dayOfWeek: number }[] = [];

  for (const dbDay of templateDays) {
    // Convert DB day (0=Mon) to JS day (0=Sun): jsDay = (dbDay + 1) % 7
    const jsDay = (dbDay + 1) % 7;

    // Find first occurrence on or after start
    const startJsDay = start.getDay();
    const daysToAdd = (jsDay - startJsDay + 7) % 7;
    const firstMs = start.getTime() + daysToAdd * 24 * 60 * 60 * 1000;

    // Generate weekly occurrences within the window
    let currentMs = firstMs;
    while (currentMs < endMs) {
      const d = new Date(currentMs);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      results.push({ date: `${yyyy}-${mm}-${dd}`, dayOfWeek: dbDay });
      currentMs += 7 * 24 * 60 * 60 * 1000;
    }
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm vitest run tests/schedule-dates.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/schedule-dates.ts apps/api/tests/schedule-dates.test.ts
git commit -m "feat: add date calculation helper for scheduled workout generation"
```

---

### Task 4: Generation Route

**Files:**
- Create: `apps/api/src/routes/plan-scheduled-workouts.ts`

This is the `POST /api/plans/:planId/scheduled-workouts` endpoint. It will be registered in app.ts in a later task.

- [ ] **Step 1: Create the generation route**

```typescript
// apps/api/src/routes/plan-scheduled-workouts.ts
import type { FastifyPluginAsync } from "fastify";
import {
  planByIdParamsSchema,
  generateScheduledWorkoutsBodySchema,
} from "@setwise/validation";
import {
  db,
  eq,
  desc,
  asc,
  trainingPlans,
  planVersions,
  workoutTemplates,
  exercisePrescriptions,
  scheduledWorkouts,
} from "@setwise/db";
import type { MockPlanStructure } from "../mock-plan-generator.js";
import { generateMockExercises } from "../mock-exercise-generator.js";
import {
  dayNameToDbDay,
  generateScheduledDates,
} from "../schedule-dates.js";

export const planScheduledWorkoutRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/plans/:planId/scheduled-workouts
  app.post("/", async (request, reply) => {
    const paramsParsed = planByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const bodyParsed = generateScheduledWorkoutsBodySchema.safeParse(
      request.body ?? {},
    );
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: bodyParsed.error.flatten().fieldErrors,
      });
    }

    const { planId } = paramsParsed.data;
    const startDate =
      bodyParsed.data.startDate ?? new Date().toISOString().split("T")[0];
    const weeks = bodyParsed.data.weeks ?? 4;

    // 1. Fetch plan
    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    // 2. Check plan status
    if (plan.status !== "approved") {
      return reply.status(409).send({
        error: "Plan is not approved",
        currentStatus: plan.status,
      });
    }

    // 3. Fetch latest version
    const [latestVersion] = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);

    if (!latestVersion || latestVersion.status !== "approved") {
      return reply.status(409).send({
        error: "Latest plan version is not approved",
        currentStatus: latestVersion?.status ?? "no version",
      });
    }

    // 4. Check for existing scheduled workouts (duplicate detection)
    const existingWorkouts = await db
      .select({
        id: scheduledWorkouts.id,
        userId: scheduledWorkouts.userId,
        planVersionId: scheduledWorkouts.planVersionId,
        scheduledDate: scheduledWorkouts.scheduledDate,
        scheduledTime: scheduledWorkouts.scheduledTime,
        status: scheduledWorkouts.status,
        templateId: workoutTemplates.id,
        templateName: workoutTemplates.name,
        templateDayOfWeek: workoutTemplates.dayOfWeek,
        templateDuration: workoutTemplates.estimatedDurationMinutes,
      })
      .from(scheduledWorkouts)
      .innerJoin(
        workoutTemplates,
        eq(scheduledWorkouts.workoutTemplateId, workoutTemplates.id),
      )
      .where(eq(scheduledWorkouts.planVersionId, latestVersion.id))
      .orderBy(asc(scheduledWorkouts.scheduledDate));

    if (existingWorkouts.length > 0) {
      return reply.status(409).send({
        error: "Scheduled workouts already exist for this plan version",
        planId,
        planVersionId: latestVersion.id,
        existingCount: existingWorkouts.length,
        scheduledWorkouts: existingWorkouts.map((w) => ({
          id: w.id,
          profileId: w.userId,
          planVersionId: w.planVersionId,
          scheduledDate: w.scheduledDate,
          scheduledTime: w.scheduledTime,
          status: w.status,
          template: {
            id: w.templateId,
            name: w.templateName,
            dayOfWeek: w.templateDayOfWeek,
            estimatedDurationMinutes: w.templateDuration,
          },
        })),
      });
    }

    // 5. Parse plan structure
    const structure = latestVersion.structure as MockPlanStructure;
    const sessions = structure.weeklySchedule.sessions;

    // 6. Transaction: create templates, prescriptions, scheduled workouts
    const result = await db.transaction(async (tx) => {
      const createdTemplates: {
        id: string;
        name: string;
        dayOfWeek: number | null;
        estimatedDurationMinutes: number;
      }[] = [];

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const dbDay = dayNameToDbDay(session.dayOfWeek) ?? null;

        // Create workout template
        const [template] = await tx
          .insert(workoutTemplates)
          .values({
            planVersionId: latestVersion.id,
            name: session.sessionType,
            dayOfWeek: dbDay,
            orderInPlan: i + 1,
            estimatedDurationMinutes:
              structure.weeklySchedule.sessionLengthMinutes,
          })
          .returning();

        // Create exercise prescriptions
        const exercises = generateMockExercises(session.sessionType);
        if (exercises.length > 0) {
          await tx.insert(exercisePrescriptions).values(
            exercises.map((ex) => ({
              workoutTemplateId: template.id,
              exerciseName: ex.exerciseName,
              orderInWorkout: ex.orderInWorkout,
              sets: ex.sets,
              repMin: ex.repMin,
              repMax: ex.repMax,
              weightKg: ex.weightKg,
              rpeTarget: ex.rpeTarget,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
            })),
          );
        }

        createdTemplates.push({
          id: template.id,
          name: template.name,
          dayOfWeek: dbDay,
          estimatedDurationMinutes: template.estimatedDurationMinutes,
        });
      }

      // Generate scheduled dates
      const templateDaysWithIds = createdTemplates
        .filter((t) => t.dayOfWeek !== null)
        .map((t) => ({ templateId: t.id, dayOfWeek: t.dayOfWeek! }));

      const allDates: {
        templateId: string;
        date: string;
        dayOfWeek: number;
      }[] = [];

      for (const t of templateDaysWithIds) {
        const dates = generateScheduledDates(startDate, weeks, [t.dayOfWeek]);
        for (const d of dates) {
          allDates.push({ templateId: t.templateId, ...d });
        }
      }

      allDates.sort((a, b) => a.date.localeCompare(b.date));

      // Create scheduled workouts
      let createdWorkouts: {
        id: string;
        userId: string;
        planVersionId: string;
        scheduledDate: string;
        scheduledTime: string | null;
        status: string;
        workoutTemplateId: string;
      }[] = [];

      if (allDates.length > 0) {
        createdWorkouts = await tx
          .insert(scheduledWorkouts)
          .values(
            allDates.map((d) => ({
              userId: plan.userId,
              workoutTemplateId: d.templateId,
              planVersionId: latestVersion.id,
              scheduledDate: d.date,
            })),
          )
          .returning();
      }

      return { createdTemplates, createdWorkouts };
    });

    // 7. Build response
    const templateMap = new Map(
      result.createdTemplates.map((t) => [t.id, t]),
    );

    const responseWorkouts = result.createdWorkouts
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .map((w) => {
        const template = templateMap.get(w.workoutTemplateId)!;
        return {
          id: w.id,
          profileId: w.userId,
          planVersionId: w.planVersionId,
          scheduledDate: w.scheduledDate,
          scheduledTime: w.scheduledTime,
          status: w.status,
          template: {
            id: template.id,
            name: template.name,
            dayOfWeek: template.dayOfWeek,
            estimatedDurationMinutes: template.estimatedDurationMinutes,
          },
        };
      });

    return reply.status(201).send({
      planId,
      planVersionId: latestVersion.id,
      versionNumber: latestVersion.versionNumber,
      generatedCount: responseWorkouts.length,
      scheduledWorkouts: responseWorkouts,
    });
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/plan-scheduled-workouts.ts
git commit -m "feat: add scheduled workout generation route"
```

---

### Task 5: Query Routes

**Files:**
- Modify: `apps/api/src/routes/scheduled-workouts.ts`

Replace the existing stub with real query endpoints.

- [ ] **Step 1: Rewrite scheduled-workouts.ts**

```typescript
// apps/api/src/routes/scheduled-workouts.ts
import type { FastifyPluginAsync } from "fastify";
import {
  scheduledWorkoutByIdParamsSchema,
  scheduledWorkoutQuerySchema,
} from "@setwise/validation";
import {
  db,
  eq,
  and,
  asc,
  gte,
  lte,
  scheduledWorkouts,
  workoutTemplates,
  exercisePrescriptions,
} from "@setwise/db";

export const scheduledWorkoutRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/scheduled-workouts
  app.get("/", async (request, reply) => {
    const queryParsed = scheduledWorkoutQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: queryParsed.error.flatten().fieldErrors,
      });
    }

    const { start, end } = queryParsed.data;

    const conditions = [];
    if (start) {
      conditions.push(gte(scheduledWorkouts.scheduledDate, start));
    }
    if (end) {
      conditions.push(lte(scheduledWorkouts.scheduledDate, end));
    }

    const rows = await db
      .select({
        id: scheduledWorkouts.id,
        userId: scheduledWorkouts.userId,
        planVersionId: scheduledWorkouts.planVersionId,
        scheduledDate: scheduledWorkouts.scheduledDate,
        scheduledTime: scheduledWorkouts.scheduledTime,
        status: scheduledWorkouts.status,
        templateId: workoutTemplates.id,
        templateName: workoutTemplates.name,
        templateDayOfWeek: workoutTemplates.dayOfWeek,
        templateDuration: workoutTemplates.estimatedDurationMinutes,
      })
      .from(scheduledWorkouts)
      .innerJoin(
        workoutTemplates,
        eq(scheduledWorkouts.workoutTemplateId, workoutTemplates.id),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(scheduledWorkouts.scheduledDate));

    const result = rows.map((w) => ({
      id: w.id,
      profileId: w.userId,
      planVersionId: w.planVersionId,
      scheduledDate: w.scheduledDate,
      scheduledTime: w.scheduledTime,
      status: w.status,
      template: {
        id: w.templateId,
        name: w.templateName,
        dayOfWeek: w.templateDayOfWeek,
        estimatedDurationMinutes: w.templateDuration,
      },
    }));

    return reply.status(200).send(result);
  });

  // GET /api/scheduled-workouts/:scheduledWorkoutId
  app.get("/:scheduledWorkoutId", async (request, reply) => {
    const parsed = scheduledWorkoutByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { scheduledWorkoutId } = parsed.data;

    // Fetch workout with template
    const [row] = await db
      .select({
        id: scheduledWorkouts.id,
        userId: scheduledWorkouts.userId,
        planVersionId: scheduledWorkouts.planVersionId,
        scheduledDate: scheduledWorkouts.scheduledDate,
        scheduledTime: scheduledWorkouts.scheduledTime,
        status: scheduledWorkouts.status,
        workoutTemplateId: scheduledWorkouts.workoutTemplateId,
        templateId: workoutTemplates.id,
        templateName: workoutTemplates.name,
        templateDayOfWeek: workoutTemplates.dayOfWeek,
        templateDuration: workoutTemplates.estimatedDurationMinutes,
      })
      .from(scheduledWorkouts)
      .innerJoin(
        workoutTemplates,
        eq(scheduledWorkouts.workoutTemplateId, workoutTemplates.id),
      )
      .where(eq(scheduledWorkouts.id, scheduledWorkoutId))
      .limit(1);

    if (!row) {
      return reply
        .status(404)
        .send({ error: "Scheduled workout not found" });
    }

    // Fetch exercises for this template
    const exercises = await db
      .select()
      .from(exercisePrescriptions)
      .where(eq(exercisePrescriptions.workoutTemplateId, row.templateId))
      .orderBy(asc(exercisePrescriptions.orderInWorkout));

    return reply.status(200).send({
      id: row.id,
      profileId: row.userId,
      planVersionId: row.planVersionId,
      scheduledDate: row.scheduledDate,
      scheduledTime: row.scheduledTime,
      status: row.status,
      template: {
        id: row.templateId,
        name: row.templateName,
        dayOfWeek: row.templateDayOfWeek,
        estimatedDurationMinutes: row.templateDuration,
        exercises: exercises.map((ex) => ({
          id: ex.id,
          exerciseName: ex.exerciseName,
          orderInWorkout: ex.orderInWorkout,
          sets: ex.sets,
          repMin: ex.repMin,
          repMax: ex.repMax,
          weightKg: ex.weightKg ? Number(ex.weightKg) : null,
          rpeTarget: ex.rpeTarget,
          restSeconds: ex.restSeconds,
          notes: ex.notes,
        })),
      },
    });
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/scheduled-workouts.ts
git commit -m "feat: implement scheduled workout query endpoints"
```

---

### Task 6: Route Registration

**Files:**
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Register the generation route**

Add the import and registration in `apps/api/src/app.ts`:

Add import:
```typescript
import { planScheduledWorkoutRoutes } from "./routes/plan-scheduled-workouts.js";
```

Add registration after the `planRoutes` line:
```typescript
app.register(planScheduledWorkoutRoutes, { prefix: "/api/plans/:planId/scheduled-workouts" });
```

- [ ] **Step 2: Verify build**

Run: `pnpm build --filter=api`
Expected: Clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat: register scheduled workout generation route"
```

---

### Task 7: Integration Tests

**Files:**
- Create: `apps/api/tests/scheduled-workouts.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
// apps/api/tests/scheduled-workouts.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { db, eq, planVersions } from "@setwise/db";

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

async function createApprovedPlan(): Promise<{
  profileId: string;
  planId: string;
  planVersionId: string;
}> {
  const profileRes = await app.inject({
    method: "POST",
    url: "/api/profiles",
    payload: {
      name: "Workout Tester",
      email: `workout-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
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

  return { profileId, planId, planVersionId };
}

// Fixed start date for deterministic tests. 2026-06-01 is a Monday.
const START_DATE = "2026-06-01";

describe("POST /api/plans/:planId/scheduled-workouts", () => {
  it("generates workouts from an approved plan (201)", async () => {
    const { planId } = await createApprovedPlan();

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.planId).toBe(planId);
    expect(body.planVersionId).toBeDefined();
    expect(body.versionNumber).toBe(1);
    // 4 days/week * 4 weeks = 16
    expect(body.generatedCount).toBe(16);
    expect(body.scheduledWorkouts).toHaveLength(16);

    // Check first workout structure
    const first = body.scheduledWorkouts[0];
    expect(first.id).toBeDefined();
    expect(first.profileId).toBeDefined();
    expect(first.scheduledDate).toBe("2026-06-01");
    expect(first.status).toBe("upcoming");
    expect(first.template).toBeDefined();
    expect(first.template.name).toBeDefined();
    expect(first.template.estimatedDurationMinutes).toBe(60);

    // Workouts should be sorted by date
    const dates = body.scheduledWorkouts.map(
      (w: { scheduledDate: string }) => w.scheduledDate,
    );
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it("rejects unapproved plan (409)", async () => {
    // Create a plan but don't approve it
    const profileRes = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: {
        name: "Draft Tester",
        email: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        heightCm: 170,
        weightKg: 70,
        dateOfBirth: "1990-01-01",
        biologicalSex: "female",
        experienceLevel: "beginner",
      },
    });
    const profileId = profileRes.json().id;

    const consultRes = await app.inject({
      method: "POST",
      url: `/api/profiles/${profileId}/consultations`,
      payload: validIntake,
    });

    const assessRes = await app.inject({
      method: "POST",
      url: `/api/consultations/${consultRes.json().id}/assessments`,
    });

    const planRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessRes.json().id}/plans`,
    });
    const planId = planRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Plan is not approved");
  });

  it("rejects plan with non-approved latest version (409)", async () => {
    const { planId, planVersionId } = await createApprovedPlan();

    // Insert a new draft version directly to simulate a revision in progress
    await db.insert(planVersions).values({
      planId,
      versionNumber: 2,
      status: "draft",
      structure: {},
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Latest plan version is not approved");
  });

  it("returns 409 on duplicate generation", async () => {
    const { planId } = await createApprovedPlan();

    const first = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE },
    });

    expect(second.statusCode).toBe(409);
    const body = second.json();
    expect(body.error).toBe(
      "Scheduled workouts already exist for this plan version",
    );
    expect(body.existingCount).toBe(16);
    expect(body.scheduledWorkouts).toHaveLength(16);
  });

  it("returns 404 for non-existent plan", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${fakeId}/scheduled-workouts`,
      payload: { startDate: START_DATE },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Plan not found");
  });

  it("respects custom weeks parameter", async () => {
    const { planId } = await createApprovedPlan();

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 2 },
    });

    expect(res.statusCode).toBe(201);
    // 4 days/week * 2 weeks = 8
    expect(res.json().generatedCount).toBe(8);
    expect(res.json().scheduledWorkouts).toHaveLength(8);
  });
});

describe("GET /api/scheduled-workouts", () => {
  it("lists scheduled workouts ordered by date", async () => {
    const { planId } = await createApprovedPlan();

    await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 2 },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/scheduled-workouts",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    // Check structure
    const first = body[0];
    expect(first.profileId).toBeDefined();
    expect(first.scheduledDate).toBeDefined();
    expect(first.template).toBeDefined();
    expect(first.template.name).toBeDefined();

    // Sorted by date
    const dates = body.map(
      (w: { scheduledDate: string }) => w.scheduledDate,
    );
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it("filters by date range", async () => {
    const { planId } = await createApprovedPlan();

    await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
    });

    // Filter to first week only (Mon Jun 1 - Sun Jun 7)
    const res = await app.inject({
      method: "GET",
      url: "/api/scheduled-workouts?start=2026-06-01&end=2026-06-07",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Should only have workouts in the first week
    for (const w of body) {
      expect(w.scheduledDate >= "2026-06-01").toBe(true);
      expect(w.scheduledDate <= "2026-06-07").toBe(true);
    }
  });
});

describe("GET /api/scheduled-workouts/:scheduledWorkoutId", () => {
  it("fetches a scheduled workout with exercises", async () => {
    const { planId } = await createApprovedPlan();

    const genRes = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE },
    });
    const workoutId = genRes.json().scheduledWorkouts[0].id;

    const res = await app.inject({
      method: "GET",
      url: `/api/scheduled-workouts/${workoutId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(workoutId);
    expect(body.profileId).toBeDefined();
    expect(body.scheduledDate).toBeDefined();
    expect(body.status).toBe("upcoming");
    expect(body.template).toBeDefined();
    expect(body.template.name).toBeDefined();
    expect(body.template.exercises).toBeDefined();
    expect(body.template.exercises.length).toBeGreaterThan(0);

    // Check exercise structure
    const exercise = body.template.exercises[0];
    expect(exercise.exerciseName).toBeDefined();
    expect(exercise.sets).toBeGreaterThan(0);
    expect(exercise.repMin).toBeGreaterThan(0);
    expect(exercise.repMax).toBeGreaterThan(0);
    expect(exercise.rpeTarget).toBeGreaterThan(0);
    expect(exercise.restSeconds).toBeGreaterThan(0);
    expect(exercise.weightKg).toBeNull();
  });

  it("returns 404 for non-existent scheduled workout", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "GET",
      url: `/api/scheduled-workouts/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Scheduled workout not found");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm --filter=api test`
Expected: All tests PASS (both existing plan tests and new scheduled workout tests).

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/scheduled-workouts.test.ts
git commit -m "test: add scheduled workout generation integration tests"
```

---

### Task 8: Web Calendar Page

**Files:**
- Modify: `apps/web/src/app/calendar/page.tsx`

- [ ] **Step 1: Rewrite calendar page**

```tsx
// apps/web/src/app/calendar/page.tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ScheduledWorkout {
  id: string;
  profileId: string;
  planVersionId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  template: {
    id: string;
    name: string;
    dayOfWeek: number | null;
    estimatedDurationMinutes: number;
  };
}

async function fetchScheduledWorkouts(): Promise<ScheduledWorkout[]> {
  const res = await fetch(`${API_URL}/api/scheduled-workouts`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

function groupByDate(
  workouts: ScheduledWorkout[],
): Record<string, ScheduledWorkout[]> {
  const groups: Record<string, ScheduledWorkout[]> = {};
  for (const w of workouts) {
    if (!groups[w.scheduledDate]) {
      groups[w.scheduledDate] = [];
    }
    groups[w.scheduledDate].push(w);
  }
  return groups;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function CalendarPage() {
  const workouts = await fetchScheduledWorkouts();
  const grouped = groupByDate(workouts);
  const dates = Object.keys(grouped).sort();

  return (
    <main>
      <h1>Calendar</h1>
      {dates.length === 0 ? (
        <p>No scheduled workouts. Approve a plan and generate workouts to get started.</p>
      ) : (
        dates.map((date) => (
          <section key={date}>
            <h2>{formatDate(date)}</h2>
            <ul>
              {grouped[date].map((w) => (
                <li key={w.id}>
                  <a href={`/workouts/${w.id}`}>
                    {w.template.name} — {w.template.estimatedDurationMinutes} min
                  </a>
                  <span> ({w.status})</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/calendar/page.tsx
git commit -m "feat(web): implement calendar page with scheduled workout list"
```

---

### Task 9: Web Workout Detail Page

**Files:**
- Modify: `apps/web/src/app/workouts/[id]/page.tsx`

- [ ] **Step 1: Rewrite workout detail page**

```tsx
// apps/web/src/app/workouts/[id]/page.tsx
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Exercise {
  id: string;
  exerciseName: string;
  orderInWorkout: number;
  sets: number;
  repMin: number;
  repMax: number;
  weightKg: number | null;
  rpeTarget: number | null;
  restSeconds: number;
  notes: string | null;
}

interface ScheduledWorkoutDetail {
  id: string;
  profileId: string;
  planVersionId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  template: {
    id: string;
    name: string;
    dayOfWeek: number | null;
    estimatedDurationMinutes: number;
    exercises: Exercise[];
  };
}

async function fetchWorkout(
  id: string,
): Promise<ScheduledWorkoutDetail | null> {
  const res = await fetch(`${API_URL}/api/scheduled-workouts/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workout = await fetchWorkout(id);

  if (!workout) {
    notFound();
  }

  return (
    <main>
      <h1>{workout.template.name}</h1>
      <p>
        {formatDate(workout.scheduledDate)} —{" "}
        {workout.template.estimatedDurationMinutes} min — {workout.status}
      </p>

      <h2>Exercises</h2>
      {workout.template.exercises.length === 0 ? (
        <p>No exercises prescribed.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Exercise</th>
              <th>Sets</th>
              <th>Reps</th>
              <th>RPE</th>
              <th>Rest</th>
            </tr>
          </thead>
          <tbody>
            {workout.template.exercises.map((ex) => (
              <tr key={ex.id}>
                <td>{ex.orderInWorkout}</td>
                <td>{ex.exerciseName}</td>
                <td>{ex.sets}</td>
                <td>
                  {ex.repMin === ex.repMax
                    ? ex.repMin
                    : `${ex.repMin}-${ex.repMax}`}
                </td>
                <td>{ex.rpeTarget ?? "—"}</td>
                <td>{ex.restSeconds}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p>
        <a href="/calendar">Back to calendar</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/workouts/\[id\]/page.tsx
git commit -m "feat(web): implement workout detail page with exercise list"
```

---

### Task 10: README Updates

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update status section**

Replace the status line:

```markdown
**Phase: Scheduled Workout Generation** -- profile creation, consultation intake, assessment handoff, draft plan lifecycle, and scheduled workout generation are wired up. Plan generation and exercise prescriptions are deterministic/mock. No workout logging, clock-in, or missed detection yet. No real AI calls yet.
```

- [ ] **Step 2: Add endpoint documentation**

Add after the `POST /api/plans/:planId/reject` section:

```markdown
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

**Note:** Generated workouts are planned instances only. Workout execution and logging are not yet implemented.

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
```

- [ ] **Step 3: Update the plan approve note**

In the `POST /api/plans/:planId/approve` section, change:

```markdown
**Note:** Approved plans do not yet generate scheduled workouts.
```

to:

```markdown
**Note:** After approval, use `POST /api/plans/:planId/scheduled-workouts` to generate workout instances.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document scheduled workout endpoints in README"
```

---

### Task 11: Verification

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Clean build across all packages.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck` (or `pnpm build` if typecheck is part of build)
Expected: No type errors.

- [ ] **Step 3: Run all tests**

Run: `DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm test`
Expected: All tests pass (existing + new).

- [ ] **Step 4: Run unit tests specifically**

Run: `cd apps/api && pnpm vitest run tests/schedule-dates.test.ts`
Expected: All 8 date calculation tests pass.

- [ ] **Step 5: Run integration tests specifically**

Run: `DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm --filter=api test`
Expected: All scheduled workout integration tests pass.

- [ ] **Step 6: Final commit (if any fixes were needed)**

Only if verification required fixes. Use a descriptive message for what was fixed.
