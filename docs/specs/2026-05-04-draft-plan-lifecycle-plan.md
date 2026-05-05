# Draft Plan Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create, fetch, approve, and reject draft training plans using the real TrainingPlan + PlanVersion model with deterministic mock generation.

**Architecture:** Assessment → mock generation → TrainingPlan + PlanVersion v1 (draft) → approve or reject via plan endpoints. Plan content lives in `plan_versions.structure` JSONB. No scheduled workouts, no AI, no revision loop.

**Tech Stack:** TypeScript, Fastify 5, Drizzle ORM, PostgreSQL, Zod, Vitest, Next.js 15

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/src/routes/assessment-plans.ts` | POST/GET routes for `/api/assessments/:assessmentId/plans` |
| Modify | `apps/api/src/routes/plans.ts` | Replace stub with GET /:planId, POST /:planId/approve, POST /:planId/reject |
| Create | `apps/api/src/mock-plan-generator.ts` | Pure function: StructuredIntakeOutput → plan structure JSON |
| Modify | `apps/api/src/app.ts:1-26` | Register new `assessmentPlanRoutes` |
| Modify | `packages/validation/src/plan.ts` | Replace `planReviewSchema` with `planByIdParamsSchema`, `rejectPlanBodySchema`; add `assessmentPlanParamsSchema` |
| Create | `apps/api/tests/plans.test.ts` | Integration tests for all plan endpoints |
| Modify | `apps/web/src/app/intake/page.tsx` | Add "Create Draft Plan" button, plan display, approve/reject UI |
| Modify | `README.md` | Document new plan endpoints |

---

### Task 1: Validation Schemas

**Files:**
- Modify: `packages/validation/src/plan.ts`

- [ ] **Step 1: Write the new validation schemas**

Replace the contents of `packages/validation/src/plan.ts` with:

```typescript
import { z } from "zod";

export const assessmentPlanParamsSchema = z.object({
  assessmentId: z.string().uuid(),
});

export type AssessmentPlanParams = z.infer<typeof assessmentPlanParamsSchema>;

export const planByIdParamsSchema = z.object({
  planId: z.string().uuid(),
});

export type PlanByIdParams = z.infer<typeof planByIdParamsSchema>;

export const rejectPlanBodySchema = z.object({
  feedback: z.string().min(1),
});

export type RejectPlanBody = z.infer<typeof rejectPlanBodySchema>;

export const exercisePrescriptionSchema = z.object({
  exerciseName: z.string().min(1).max(255),
  orderInWorkout: z.number().int().nonnegative(),
  sets: z.number().int().positive(),
  repMin: z.number().int().positive(),
  repMax: z.number().int().positive(),
  weightKg: z.number().nonnegative().nullable(),
  rpeTarget: z.number().min(1).max(10).nullable(),
  restSeconds: z.number().int().nonnegative(),
  notes: z.string().nullable(),
});

export type ExercisePrescriptionInput = z.infer<
  typeof exercisePrescriptionSchema
>;

export const logSetSchema = z.object({
  exerciseName: z.string().min(1),
  setNumber: z.number().int().positive(),
  prescribedReps: z.number().int().nonnegative(),
  actualReps: z.number().int().nonnegative(),
  prescribedWeightKg: z.number().nonnegative().nullable(),
  actualWeightKg: z.number().nonnegative().nullable(),
  rpeActual: z.number().min(1).max(10).nullable(),
  painReported: z.boolean().default(false),
  painNotes: z.string().nullable().default(null),
  skipped: z.boolean().default(false),
  skipReason: z.string().nullable().default(null),
});

export type LogSetInput = z.infer<typeof logSetSchema>;
```

This removes `planReviewSchema` and `PlanReviewInput`, and adds `assessmentPlanParamsSchema`, `planByIdParamsSchema`, and `rejectPlanBodySchema`.

- [ ] **Step 2: Verify the build passes**

Run: `pnpm --filter @setwise/validation build`
Expected: Clean build with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/validation/src/plan.ts
git commit -m "feat(validation): add plan param and reject body schemas, remove planReviewSchema"
```

---

### Task 2: Mock Plan Generator

**Files:**
- Create: `apps/api/src/mock-plan-generator.ts`

- [ ] **Step 1: Create the mock plan generator**

Create `apps/api/src/mock-plan-generator.ts`:

```typescript
import type { StructuredIntakeOutput } from "@setwise/domain";

export interface MockPlanStructure {
  goalSummary: string;
  weeklySchedule: {
    daysPerWeek: number;
    sessionLengthMinutes: number;
    sessions: Array<{
      dayOfWeek: string;
      sessionType: string;
      focus: string;
    }>;
  };
  safetyNotes: string[];
  progressionRules: string;
  generatedAt: string;
  generationMethod: "deterministic-mock";
}

const SESSION_TYPES: Record<string, string[]> = {
  strength: ["Heavy Compound", "Accessory Strength", "Power Development"],
  hypertrophy: ["Upper Hypertrophy", "Lower Hypertrophy", "Full Body Volume"],
  endurance: ["Endurance Circuit", "Tempo Work", "Conditioning"],
  general_fitness: ["Full Body", "Upper Focus", "Lower Focus"],
  sport_specific: ["Sport Skill", "Strength Support", "Conditioning"],
};

const FOCUS_MAP: Record<string, string[]> = {
  strength: [
    "Squat and press variations",
    "Deadlift and row variations",
    "Bench and overhead variations",
  ],
  hypertrophy: [
    "Chest, shoulders, triceps",
    "Back, biceps, rear delts",
    "Quads, hamstrings, glutes",
  ],
  endurance: [
    "Sustained effort compound movements",
    "Tempo-controlled accessory work",
    "Mixed modal conditioning",
  ],
  general_fitness: [
    "Compound pushing and pulling",
    "Lower body and core",
    "Full body functional movements",
  ],
  sport_specific: [
    "Sport-specific movement patterns",
    "General strength foundation",
    "Aerobic and anaerobic capacity",
  ],
};

export function generateMockPlan(
  input: StructuredIntakeOutput,
): MockPlanStructure {
  const goal = input.goals.primaryGoal || "general_fitness";
  const daysPerWeek = input.schedule.daysPerWeek;
  const availableDays = input.schedule.availableDays;
  const sessionLength = input.schedule.sessionLengthMinutes;

  const sessionTypes = SESSION_TYPES[goal] ?? SESSION_TYPES["general_fitness"];
  const focuses = FOCUS_MAP[goal] ?? FOCUS_MAP["general_fitness"];

  const sessions = availableDays.slice(0, daysPerWeek).map((day, i) => ({
    dayOfWeek: day,
    sessionType: sessionTypes[i % sessionTypes.length],
    focus: focuses[i % focuses.length],
  }));

  const safetyNotes = input.safetyFlags.map((f) => f.recommendation);
  if (input.injuriesAndRestrictions.length > 0) {
    safetyNotes.push(
      "Modifications applied for reported injuries/restrictions. Monitor closely and reduce load if discomfort increases.",
    );
  }

  const targets = input.goals.specificTargets;
  const targetSummary =
    targets.length > 0 ? ` Targets: ${targets.join(", ")}.` : "";
  const goalSummary = `${goal.replace(/_/g, " ")} program, ${daysPerWeek} days/week, ${sessionLength} min sessions.${targetSummary}`;

  return {
    goalSummary,
    weeklySchedule: {
      daysPerWeek,
      sessionLengthMinutes: sessionLength,
      sessions,
    },
    safetyNotes,
    progressionRules:
      "Linear progression with conservative load increases. Deload after 3 consecutive sessions with incomplete prescribed reps.",
    generatedAt: new Date().toISOString(),
    generationMethod: "deterministic-mock",
  };
}
```

- [ ] **Step 2: Verify the build passes**

Run: `pnpm --filter api build`
Expected: Clean build with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/mock-plan-generator.ts
git commit -m "feat(api): add deterministic mock plan generator"
```

---

### Task 3: Assessment-Plan Routes (POST and GET)

**Files:**
- Create: `apps/api/src/routes/assessment-plans.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Create the assessment-plans route file**

Create `apps/api/src/routes/assessment-plans.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { assessmentPlanParamsSchema } from "@setwise/validation";
import {
  db,
  eq,
  and,
  desc,
  assessments,
  consultations,
  trainingPlans,
  planVersions,
} from "@setwise/db";
import { generateMockPlan } from "../mock-plan-generator.js";

export const assessmentPlanRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/assessments/:assessmentId/plans
  app.post("/", async (request, reply) => {
    const parsed = assessmentPlanParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { assessmentId } = parsed.data;

    // Fetch assessment
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return reply.status(404).send({ error: "Assessment not found" });
    }

    // Check assessment status
    if (assessment.status === "processing") {
      return reply.status(409).send({
        error: "Assessment is currently processing",
        status: assessment.status,
      });
    }

    if (assessment.status === "failed") {
      return reply.status(422).send({
        error: "Assessment has failed",
        status: assessment.status,
      });
    }

    // Check for existing draft plan for this assessment
    const existingPlans = await db
      .select({ planId: trainingPlans.id })
      .from(trainingPlans)
      .where(eq(trainingPlans.assessmentId, assessmentId));

    for (const ep of existingPlans) {
      const [draftVersion] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(
          and(
            eq(planVersions.planId, ep.planId),
            eq(planVersions.status, "draft"),
          ),
        )
        .limit(1);

      if (draftVersion) {
        // Return the existing draft plan
        const [existingPlan] = await db
          .select()
          .from(trainingPlans)
          .where(eq(trainingPlans.id, ep.planId))
          .limit(1);

        const [existingVersion] = await db
          .select()
          .from(planVersions)
          .where(eq(planVersions.id, draftVersion.id))
          .limit(1);

        return reply.status(409).send({
          error:
            "A draft plan already exists for this assessment",
          plan: {
            id: existingPlan.id,
            userId: existingPlan.userId,
            assessmentId: existingPlan.assessmentId,
            name: existingPlan.name,
            status: existingPlan.status,
            createdAt: existingPlan.createdAt,
            currentVersion: {
              id: existingVersion.id,
              versionNumber: existingVersion.versionNumber,
              status: existingVersion.status,
              structure: existingVersion.structure,
              rejectionFeedback: existingVersion.rejectionFeedback,
              createdAt: existingVersion.createdAt,
            },
          },
        });
      }
    }

    // Look up userId via consultation
    const [consultation] = await db
      .select({ userId: consultations.userId })
      .from(consultations)
      .where(eq(consultations.id, assessment.consultationId))
      .limit(1);

    if (!consultation) {
      return reply.status(500).send({ error: "Consultation not found for assessment" });
    }

    // Generate mock plan
    const inputSnapshot = assessment.inputSnapshot as import("@setwise/domain").StructuredIntakeOutput;
    const structure = generateMockPlan(inputSnapshot);

    const goal = inputSnapshot.goals.primaryGoal || "general fitness";
    const planName = `${goal.replace(/_/g, " ")} plan`;

    // Insert plan and version
    const [plan] = await db
      .insert(trainingPlans)
      .values({
        userId: consultation.userId,
        assessmentId,
        name: planName,
        status: "draft",
      })
      .returning();

    const [version] = await db
      .insert(planVersions)
      .values({
        planId: plan.id,
        versionNumber: 1,
        status: "draft",
        structure,
      })
      .returning();

    return reply.status(201).send({
      id: plan.id,
      userId: plan.userId,
      assessmentId: plan.assessmentId,
      name: plan.name,
      status: plan.status,
      createdAt: plan.createdAt,
      currentVersion: {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        structure: version.structure,
        rejectionFeedback: version.rejectionFeedback,
        createdAt: version.createdAt,
      },
    });
  });

  // GET /api/assessments/:assessmentId/plans
  app.get("/", async (request, reply) => {
    const parsed = assessmentPlanParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { assessmentId } = parsed.data;

    // Verify assessment exists
    const [assessment] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return reply.status(404).send({ error: "Assessment not found" });
    }

    // Fetch plans for this assessment
    const plans = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.assessmentId, assessmentId))
      .orderBy(desc(trainingPlans.createdAt));

    const result = await Promise.all(
      plans.map(async (plan) => {
        const [latestVersion] = await db
          .select()
          .from(planVersions)
          .where(eq(planVersions.planId, plan.id))
          .orderBy(desc(planVersions.versionNumber))
          .limit(1);

        return {
          id: plan.id,
          userId: plan.userId,
          assessmentId: plan.assessmentId,
          name: plan.name,
          status: plan.status,
          createdAt: plan.createdAt,
          currentVersion: latestVersion
            ? {
                id: latestVersion.id,
                versionNumber: latestVersion.versionNumber,
                status: latestVersion.status,
                structure: latestVersion.structure,
                rejectionFeedback: latestVersion.rejectionFeedback,
                createdAt: latestVersion.createdAt,
              }
            : null,
        };
      }),
    );

    return reply.status(200).send(result);
  });
};
```

- [ ] **Step 2: Register the new route in app.ts**

In `apps/api/src/app.ts`, add the import and registration. The file should become:

```typescript
import Fastify from "fastify";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profile.js";
import { consultationRoutes } from "./routes/consultations.js";
import { assessmentRoutes } from "./routes/assessments.js";
import { consultationAssessmentRoutes } from "./routes/consultation-assessments.js";
import { assessmentPlanRoutes } from "./routes/assessment-plans.js";
import { planRoutes } from "./routes/plans.js";
import { scheduledWorkoutRoutes } from "./routes/scheduled-workouts.js";
import { workoutSessionRoutes } from "./routes/workout-sessions.js";
import { progressionRoutes } from "./routes/progression.js";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.register(healthRoutes);
  app.register(profileRoutes, { prefix: "/api/profiles" });
  app.register(consultationRoutes, { prefix: "/api/profiles/:profileId/consultations" });
  app.register(consultationAssessmentRoutes, { prefix: "/api/consultations/:consultationId/assessments" });
  app.register(assessmentRoutes, { prefix: "/api/assessments" });
  app.register(assessmentPlanRoutes, { prefix: "/api/assessments/:assessmentId/plans" });
  app.register(planRoutes, { prefix: "/api/plans" });
  app.register(scheduledWorkoutRoutes, { prefix: "/api/scheduled-workouts" });
  app.register(workoutSessionRoutes, { prefix: "/api/workout-sessions" });
  app.register(progressionRoutes, { prefix: "/api/progression" });

  return app;
}
```

- [ ] **Step 3: Verify the build passes**

Run: `pnpm --filter api build`
Expected: Clean build with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/assessment-plans.ts apps/api/src/app.ts
git commit -m "feat(api): add POST and GET for assessment plans"
```

---

### Task 4: Plan Routes (GET, Approve, Reject)

**Files:**
- Modify: `apps/api/src/routes/plans.ts`

- [ ] **Step 1: Replace the plan routes stub**

Replace the contents of `apps/api/src/routes/plans.ts` with:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { planByIdParamsSchema, rejectPlanBodySchema } from "@setwise/validation";
import { db, eq, desc, trainingPlans, planVersions } from "@setwise/db";

export const planRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/plans/:planId
  app.get("/:planId", async (request, reply) => {
    const parsed = planByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { planId } = parsed.data;

    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const [latestVersion] = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);

    return reply.status(200).send({
      id: plan.id,
      userId: plan.userId,
      assessmentId: plan.assessmentId,
      name: plan.name,
      status: plan.status,
      createdAt: plan.createdAt,
      currentVersion: latestVersion
        ? {
            id: latestVersion.id,
            versionNumber: latestVersion.versionNumber,
            status: latestVersion.status,
            structure: latestVersion.structure,
            rejectionFeedback: latestVersion.rejectionFeedback,
            createdAt: latestVersion.createdAt,
          }
        : null,
    });
  });

  // POST /api/plans/:planId/approve
  app.post("/:planId/approve", async (request, reply) => {
    const parsed = planByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { planId } = parsed.data;

    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const [latestVersion] = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);

    if (!latestVersion || latestVersion.status !== "draft") {
      return reply.status(409).send({
        error: "Only draft plans can be approved",
        currentStatus: latestVersion?.status ?? "no version",
      });
    }

    // Update version status to approved
    const [updatedVersion] = await db
      .update(planVersions)
      .set({ status: "approved" })
      .where(eq(planVersions.id, latestVersion.id))
      .returning();

    // Update plan status to approved
    const [updatedPlan] = await db
      .update(trainingPlans)
      .set({ status: "approved" })
      .where(eq(trainingPlans.id, planId))
      .returning();

    return reply.status(200).send({
      id: updatedPlan.id,
      userId: updatedPlan.userId,
      assessmentId: updatedPlan.assessmentId,
      name: updatedPlan.name,
      status: updatedPlan.status,
      createdAt: updatedPlan.createdAt,
      currentVersion: {
        id: updatedVersion.id,
        versionNumber: updatedVersion.versionNumber,
        status: updatedVersion.status,
        structure: updatedVersion.structure,
        rejectionFeedback: updatedVersion.rejectionFeedback,
        createdAt: updatedVersion.createdAt,
      },
    });
  });

  // POST /api/plans/:planId/reject
  app.post("/:planId/reject", async (request, reply) => {
    const paramsParsed = planByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const bodyParsed = rejectPlanBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: bodyParsed.error.flatten().fieldErrors,
      });
    }

    const { planId } = paramsParsed.data;
    const { feedback } = bodyParsed.data;

    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const [latestVersion] = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);

    if (!latestVersion || latestVersion.status !== "draft") {
      return reply.status(409).send({
        error: "Only draft plans can be rejected",
        currentStatus: latestVersion?.status ?? "no version",
      });
    }

    // Update version status to rejected with feedback
    const [updatedVersion] = await db
      .update(planVersions)
      .set({ status: "rejected", rejectionFeedback: feedback })
      .where(eq(planVersions.id, latestVersion.id))
      .returning();

    // Plan status remains draft — awaiting future revision
    return reply.status(200).send({
      id: plan.id,
      userId: plan.userId,
      assessmentId: plan.assessmentId,
      name: plan.name,
      status: plan.status,
      createdAt: plan.createdAt,
      currentVersion: {
        id: updatedVersion.id,
        versionNumber: updatedVersion.versionNumber,
        status: updatedVersion.status,
        structure: updatedVersion.structure,
        rejectionFeedback: updatedVersion.rejectionFeedback,
        createdAt: updatedVersion.createdAt,
      },
    });
  });
};
```

- [ ] **Step 2: Verify the build passes**

Run: `pnpm --filter api build`
Expected: Clean build with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/plans.ts
git commit -m "feat(api): implement GET, approve, and reject plan routes"
```

---

### Task 5: DB Exports

**Files:**
- Modify: `packages/db/src/index.ts` (only if `trainingPlans` and `planVersions` are not already re-exported)

- [ ] **Step 1: Check if plan tables are exported**

The schema file `packages/db/src/schema/plans.ts` exports `trainingPlans` and `planVersions`. The barrel `packages/db/src/schema/index.ts` does `export * from "./plans.js"`. And `packages/db/src/index.ts` does `export * from "./schema/index.js"`. So `trainingPlans` and `planVersions` should already be available from `@setwise/db`.

Verify by running: `pnpm --filter api build`

If the build succeeds with the routes from Tasks 3 and 4, no changes are needed here. If imports fail, add explicit re-exports.

- [ ] **Step 2: Commit (only if changes were needed)**

```bash
git add packages/db/src/index.ts
git commit -m "fix(db): export plan tables from package barrel"
```

---

### Task 6: Integration Tests

**Files:**
- Create: `apps/api/tests/plans.test.ts`

- [ ] **Step 1: Write the integration tests**

Create `apps/api/tests/plans.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import {
  db,
  eq,
  assessments,
  consultations,
  userProfiles,
  trainingPlans,
  planVersions,
} from "@setwise/db";

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

async function createAssessment(): Promise<{
  profileId: string;
  consultationId: string;
  assessmentId: string;
}> {
  const profileRes = await app.inject({
    method: "POST",
    url: "/api/profiles",
    payload: {
      name: "Plan Tester",
      email: `plan-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
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

  return { profileId, consultationId, assessmentId };
}

describe("POST /api/assessments/:assessmentId/plans", () => {
  it("creates a draft plan from a pending assessment (201)", async () => {
    const { assessmentId } = await createAssessment();

    const res = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.assessmentId).toBe(assessmentId);
    expect(body.status).toBe("draft");
    expect(body.name).toBe("strength plan");
    expect(body.currentVersion).toBeDefined();
    expect(body.currentVersion.versionNumber).toBe(1);
    expect(body.currentVersion.status).toBe("draft");
    expect(body.currentVersion.structure).toBeDefined();
    expect(body.currentVersion.structure.generationMethod).toBe(
      "deterministic-mock",
    );
    expect(body.currentVersion.structure.goalSummary).toContain("strength");
  });

  it("returns 404 for a non-existent assessment", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "POST",
      url: `/api/assessments/${fakeId}/plans`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Assessment not found");
  });

  it("returns 400 for an invalid assessment ID", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assessments/not-a-uuid/plans`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });

  it("returns 409 when assessment is processing", async () => {
    const { assessmentId } = await createAssessment();

    await db
      .update(assessments)
      .set({ status: "processing" })
      .where(eq(assessments.id, assessmentId));

    const res = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Assessment is currently processing");
  });

  it("returns 422 when assessment has failed", async () => {
    const { assessmentId } = await createAssessment();

    await db
      .update(assessments)
      .set({ status: "failed" })
      .where(eq(assessments.id, assessmentId));

    const res = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("Assessment has failed");
  });

  it("returns 409 when a draft plan already exists (duplicate)", async () => {
    const { assessmentId } = await createAssessment();

    const first = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error).toContain("draft plan already exists");
    expect(second.json().plan.id).toBe(first.json().id);
  });

  it("allows a new plan after prior plan was rejected", async () => {
    const { assessmentId } = await createAssessment();

    // Create and reject a plan
    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    expect(createRes.statusCode).toBe(201);
    const planId = createRes.json().id;

    const rejectRes = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/reject`,
      payload: { feedback: "Too much volume" },
    });
    expect(rejectRes.statusCode).toBe(200);

    // Create a new plan from the same assessment
    const newRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });

    expect(newRes.statusCode).toBe(201);
    expect(newRes.json().id).not.toBe(planId);
    expect(newRes.json().currentVersion.versionNumber).toBe(1);
  });
});

describe("GET /api/assessments/:assessmentId/plans", () => {
  it("lists plans for an assessment", async () => {
    const { assessmentId } = await createAssessment();

    await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/assessments/${assessmentId}/plans`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].assessmentId).toBe(assessmentId);
    expect(body[0].currentVersion).toBeDefined();
  });

  it("returns 404 for a non-existent assessment", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "GET",
      url: `/api/assessments/${fakeId}/plans`,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/plans/:planId", () => {
  it("fetches a plan by ID", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    const res = await app.inject({
      method: "GET",
      url: `/api/plans/${planId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(planId);
    expect(body.currentVersion).toBeDefined();
    expect(body.currentVersion.structure.generationMethod).toBe(
      "deterministic-mock",
    );
  });

  it("returns 404 for a non-existent plan", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "GET",
      url: `/api/plans/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Plan not found");
  });

  it("returns 400 for an invalid plan ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/plans/not-a-uuid`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });
});

describe("POST /api/plans/:planId/approve", () => {
  it("approves a draft plan", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/approve`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("approved");
    expect(body.currentVersion.status).toBe("approved");
  });

  it("returns 409 when approving an already-approved plan", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/approve`,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/approve`,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Only draft plans can be approved");
  });

  it("returns 409 when approving a rejected plan", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/reject`,
      payload: { feedback: "Not enough rest days" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/approve`,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Only draft plans can be approved");
  });

  it("returns 404 for a non-existent plan", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${fakeId}/approve`,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/plans/:planId/reject", () => {
  it("rejects a draft plan with feedback", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/reject`,
      payload: { feedback: "Too much volume for a beginner" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("draft"); // plan stays draft
    expect(body.currentVersion.status).toBe("rejected");
    expect(body.currentVersion.rejectionFeedback).toBe(
      "Too much volume for a beginner",
    );
  });

  it("returns 400 when feedback is missing", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/reject`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });

  it("returns 400 when feedback is empty string", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/reject`,
      payload: { feedback: "" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 409 when rejecting an already-rejected plan", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/reject`,
      payload: { feedback: "First rejection" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/reject`,
      payload: { feedback: "Second rejection" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Only draft plans can be rejected");
  });

  it("returns 409 when rejecting an approved plan", async () => {
    const { assessmentId } = await createAssessment();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/assessments/${assessmentId}/plans`,
    });
    const planId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/approve`,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/reject`,
      payload: { feedback: "Changed my mind" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Only draft plans can be rejected");
  });

  it("returns 404 for a non-existent plan", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${fakeId}/reject`,
      payload: { feedback: "Some feedback" },
    });

    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm --filter api test`
Expected: All plan tests pass. All existing assessment tests still pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/plans.test.ts
git commit -m "test(api): add draft plan lifecycle integration tests"
```

---

### Task 7: Web — Plan Creation and Review UI

**Files:**
- Modify: `apps/web/src/app/intake/page.tsx`

- [ ] **Step 1: Add plan creation, display, and approve/reject to the intake page**

The "done" phase of the intake page currently shows an assessment submission button. After the assessment is created, add:
1. A "Create Draft Plan" button
2. Plan structure display when the plan exists
3. Approve and reject buttons with a feedback textarea for rejection

Replace the `if (phase === "done")` block (starting around line 177) and the state declarations at the top. The full updated file:

```tsx
"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const API = "http://localhost:4000";

const style = { display: "block", width: "100%" } as const;
const containerStyle = {
  maxWidth: 480,
  margin: "2rem auto",
  fontFamily: "system-ui",
} as const;

interface PlanVersion {
  id: string;
  versionNumber: number;
  status: string;
  structure: {
    goalSummary: string;
    weeklySchedule: {
      daysPerWeek: number;
      sessionLengthMinutes: number;
      sessions: Array<{
        dayOfWeek: string;
        sessionType: string;
        focus: string;
      }>;
    };
    safetyNotes: string[];
    progressionRules: string;
    generationMethod: string;
  };
  rejectionFeedback: string | null;
}

interface Plan {
  id: string;
  name: string;
  status: string;
  currentVersion: PlanVersion;
}

export default function IntakePage() {
  const [phase, setPhase] = useState<"profile" | "consultation" | "done">(
    "profile",
  );
  const [profileId, setProfileId] = useState("");
  const [consultationId, setConsultationId] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [assessmentStatus, setAssessmentStatus] = useState<
    "idle" | "submitting" | "created" | "conflict" | "error"
  >("idle");
  const [assessmentId, setAssessmentId] = useState("");

  // Plan state
  const [planStatus, setPlanStatus] = useState<
    "idle" | "creating" | "created" | "conflict" | "error"
  >("idle");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reviewStatus, setReviewStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");
  const [rejectFeedback, setRejectFeedback] = useState("");

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      heightCm: Number(form.get("heightCm")),
      weightKg: Number(form.get("weightKg")),
      dateOfBirth: form.get("dateOfBirth"),
      biologicalSex: form.get("biologicalSex"),
      experienceLevel: form.get("experienceLevel"),
    };

    try {
      const res = await fetch(`${API}/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Request failed");
        setStatus("error");
        return;
      }

      const body = await res.json();
      setProfileId(body.id);
      setStatus("idle");
      setPhase("consultation");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setStatus("error");
    }
  }

  async function handleConsultationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const form = new FormData(e.currentTarget);

    const payload = {
      injuriesAndRestrictions: [],
      equipment: {
        location: form.get("location"),
        locationNotes: "",
        availableEquipment: (form.get("equipment") as string)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        equipmentLimitations: "",
      },
      goals: {
        primaryGoal: form.get("primaryGoal"),
        secondaryGoals: [],
        specificTargets: [],
        timeline: form.get("timeline") || "",
      },
      schedule: {
        daysPerWeek: Number(form.get("daysPerWeek")),
        availableDays: Array.from(form.getAll("availableDays")),
        preferredTime: form.get("preferredTime"),
        sessionLengthMinutes: Number(form.get("sessionLength")),
        upcomingDisruptions: "",
      },
      trainingHistory: {
        experienceDuration: form.get("experienceDuration") || "",
        recentProgram: form.get("recentProgram") || "",
        familiarExercises: [],
        recentWorkingWeights: [],
        pastObservations: "",
      },
      preferences: {
        likedExercises: [],
        dislikedExercises: [],
        trainingStyle: "",
        cardioPreference: "",
        otherNotes: form.get("notes") || "",
      },
      safetyFlags: [],
      agentNotes: "",
    };

    try {
      const res = await fetch(
        `${API}/api/profiles/${profileId}/consultations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Request failed");
        setStatus("error");
        return;
      }

      const body = await res.json();
      setConsultationId(body.id);
      setStatus("idle");
      setPhase("done");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setStatus("error");
    }
  }

  async function handleAssessmentSubmit() {
    setAssessmentStatus("submitting");
    setError("");

    try {
      const res = await fetch(
        `${API}/api/consultations/${consultationId}/assessments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (res.status === 201) {
        const body = await res.json();
        setAssessmentId(body.id);
        setAssessmentStatus("created");
        return;
      }

      if (res.status === 409) {
        setAssessmentStatus("conflict");
        return;
      }

      const body = await res.json();
      setError(body.error || "Request failed");
      setAssessmentStatus("error");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setAssessmentStatus("error");
    }
  }

  async function handleCreatePlan() {
    setPlanStatus("creating");
    setError("");

    try {
      const res = await fetch(
        `${API}/api/assessments/${assessmentId}/plans`,
        { method: "POST" },
      );

      if (res.status === 201) {
        const body = await res.json();
        setPlan(body);
        setPlanStatus("created");
        return;
      }

      if (res.status === 409) {
        const body = await res.json();
        if (body.plan) setPlan(body.plan);
        setPlanStatus("conflict");
        return;
      }

      const body = await res.json();
      setError(body.error || "Request failed");
      setPlanStatus("error");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setPlanStatus("error");
    }
  }

  async function handleApprove() {
    if (!plan) return;
    setReviewStatus("submitting");
    setError("");

    try {
      const res = await fetch(`${API}/api/plans/${plan.id}/approve`, {
        method: "POST",
      });

      if (res.ok) {
        const body = await res.json();
        setPlan(body);
        setReviewStatus("done");
        return;
      }

      const body = await res.json();
      setError(body.error || "Request failed");
      setReviewStatus("error");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setReviewStatus("error");
    }
  }

  async function handleReject() {
    if (!plan || !rejectFeedback.trim()) return;
    setReviewStatus("submitting");
    setError("");

    try {
      const res = await fetch(`${API}/api/plans/${plan.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: rejectFeedback }),
      });

      if (res.ok) {
        const body = await res.json();
        setPlan(body);
        setReviewStatus("done");
        return;
      }

      const body = await res.json();
      setError(body.error || "Request failed");
      setReviewStatus("error");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setReviewStatus("error");
    }
  }

  if (phase === "done") {
    return (
      <main style={containerStyle}>
        <h1>Intake Complete</h1>
        <p>Your profile and consultation data have been saved.</p>

        {/* Assessment submission */}
        {assessmentStatus === "idle" && (
          <button onClick={handleAssessmentSubmit} disabled={!consultationId}>
            Submit for Assessment
          </button>
        )}

        {assessmentStatus === "submitting" && <p>Submitting assessment...</p>}

        {assessmentStatus === "conflict" && (
          <p>An assessment is already in progress for this consultation.</p>
        )}

        {assessmentStatus === "error" && (
          <p style={{ color: "red" }}>{error}</p>
        )}

        {/* Plan creation */}
        {assessmentStatus === "created" && !plan && planStatus === "idle" && (
          <div style={{ marginTop: "1rem" }}>
            <p>
              Assessment created (status: <strong>pending</strong>).
            </p>
            <button onClick={handleCreatePlan}>Create Draft Plan</button>
          </div>
        )}

        {planStatus === "creating" && <p>Generating draft plan...</p>}

        {planStatus === "conflict" && !plan && (
          <p>A draft plan already exists for this assessment.</p>
        )}

        {planStatus === "error" && <p style={{ color: "red" }}>{error}</p>}

        {/* Plan display */}
        {plan && (
          <div style={{ marginTop: "1rem" }}>
            <h2>{plan.name}</h2>
            <p>
              Plan status: <strong>{plan.status}</strong> | Version{" "}
              {plan.currentVersion.versionNumber} (
              {plan.currentVersion.status})
            </p>

            <div
              style={{
                background: "#f5f5f5",
                padding: "1rem",
                borderRadius: 4,
                marginTop: "0.5rem",
              }}
            >
              <p>
                <strong>Goal:</strong>{" "}
                {plan.currentVersion.structure.goalSummary}
              </p>
              <p>
                <strong>Schedule:</strong>{" "}
                {plan.currentVersion.structure.weeklySchedule.daysPerWeek}{" "}
                days/week,{" "}
                {
                  plan.currentVersion.structure.weeklySchedule
                    .sessionLengthMinutes
                }{" "}
                min sessions
              </p>
              <ul>
                {plan.currentVersion.structure.weeklySchedule.sessions.map(
                  (s, i) => (
                    <li key={i}>
                      <strong>{s.dayOfWeek}:</strong> {s.sessionType} -{" "}
                      {s.focus}
                    </li>
                  ),
                )}
              </ul>
              {plan.currentVersion.structure.safetyNotes.length > 0 && (
                <>
                  <p>
                    <strong>Safety notes:</strong>
                  </p>
                  <ul>
                    {plan.currentVersion.structure.safetyNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
              <p>
                <em>{plan.currentVersion.structure.progressionRules}</em>
              </p>
              <p style={{ fontSize: "0.8em", color: "#888" }}>
                Generation: {plan.currentVersion.structure.generationMethod}
              </p>
            </div>

            {plan.currentVersion.rejectionFeedback && (
              <p style={{ marginTop: "0.5rem", color: "#c00" }}>
                Rejection feedback: {plan.currentVersion.rejectionFeedback}
              </p>
            )}

            {/* Approve/reject controls */}
            {plan.currentVersion.status === "draft" &&
              reviewStatus !== "done" && (
                <div style={{ marginTop: "1rem" }}>
                  <button
                    onClick={handleApprove}
                    disabled={reviewStatus === "submitting"}
                    style={{ marginRight: "0.5rem" }}
                  >
                    Approve Plan
                  </button>
                  <div style={{ marginTop: "0.5rem" }}>
                    <textarea
                      placeholder="Rejection feedback (required)"
                      value={rejectFeedback}
                      onChange={(e) => setRejectFeedback(e.target.value)}
                      rows={2}
                      style={style}
                    />
                    <button
                      onClick={handleReject}
                      disabled={
                        reviewStatus === "submitting" ||
                        !rejectFeedback.trim()
                      }
                    >
                      Reject Plan
                    </button>
                  </div>
                </div>
              )}

            {reviewStatus === "done" && (
              <p style={{ marginTop: "0.5rem", color: "green" }}>
                Plan review submitted. Status:{" "}
                <strong>{plan.currentVersion.status}</strong>.
                {plan.currentVersion.status === "approved" &&
                  " Scheduled workout generation is not yet implemented."}
              </p>
            )}

            {reviewStatus === "error" && (
              <p style={{ color: "red" }}>{error}</p>
            )}
          </div>
        )}
      </main>
    );
  }

  if (phase === "consultation") {
    return (
      <main style={containerStyle}>
        <h1>Training Intake</h1>
        <p>Step 2: Tell us about your training context.</p>

        <form
          onSubmit={handleConsultationSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <fieldset>
            <legend>Equipment</legend>
            <label>
              Training location
              <select name="location" required style={style}>
                <option value="">Select...</option>
                <option value="commercial_gym">Commercial gym</option>
                <option value="home_gym">Home gym</option>
                <option value="outdoor">Outdoor</option>
                <option value="mixed">Mixed</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Available equipment (comma-separated)
              <input
                name="equipment"
                type="text"
                placeholder="barbell, dumbbells, cables"
                style={style}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Goals</legend>
            <label>
              Primary goal
              <select name="primaryGoal" required style={style}>
                <option value="">Select...</option>
                <option value="strength">Strength</option>
                <option value="hypertrophy">Hypertrophy</option>
                <option value="endurance">Endurance</option>
                <option value="general_fitness">General fitness</option>
                <option value="sport_specific">Sport-specific</option>
              </select>
            </label>
            <label>
              Timeline
              <input
                name="timeline"
                type="text"
                placeholder="e.g. 6 months"
                style={style}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Schedule</legend>
            <label>
              Days per week
              <input
                name="daysPerWeek"
                type="number"
                min="1"
                max="7"
                required
                style={style}
              />
            </label>
            <label>
              Available days
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginTop: "0.25rem",
                }}
              >
                {[
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                  "sunday",
                ].map((day) => (
                  <label key={day} style={{ display: "flex", gap: "0.25rem" }}>
                    <input type="checkbox" name="availableDays" value={day} />
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </label>
                ))}
              </div>
            </label>
            <label>
              Preferred time
              <select name="preferredTime" required style={style}>
                <option value="no_preference">No preference</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </label>
            <label>
              Session length (minutes)
              <input
                name="sessionLength"
                type="number"
                min="15"
                max="180"
                defaultValue={60}
                required
                style={style}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Training History</legend>
            <label>
              How long have you been training?
              <input
                name="experienceDuration"
                type="text"
                placeholder="e.g. 2 years"
                style={style}
              />
            </label>
            <label>
              Recent program
              <input
                name="recentProgram"
                type="text"
                placeholder="e.g. PPL, Starting Strength"
                style={style}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Other</legend>
            <label>
              Notes
              <textarea name="notes" rows={3} style={style} />
            </label>
          </fieldset>

          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Saving..." : "Submit Intake"}
          </button>

          {status === "error" && <p style={{ color: "red" }}>{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      <h1>Create Your Profile</h1>
      <p>Step 1 of the intake process. Fill in your basic info to get started.</p>

      <form
        onSubmit={handleProfileSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <label>
          Name
          <input name="name" type="text" required style={style} />
        </label>

        <label>
          Email
          <input name="email" type="email" required style={style} />
        </label>

        <label>
          Height (cm)
          <input
            name="heightCm"
            type="number"
            step="0.1"
            min="1"
            max="300"
            required
            style={style}
          />
        </label>

        <label>
          Weight (kg)
          <input
            name="weightKg"
            type="number"
            step="0.1"
            min="1"
            max="500"
            required
            style={style}
          />
        </label>

        <label>
          Date of Birth
          <input name="dateOfBirth" type="date" required style={style} />
        </label>

        <label>
          Biological Sex
          <select name="biologicalSex" required style={style}>
            <option value="">Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>

        <label>
          Experience Level
          <select name="experienceLevel" required style={style}>
            <option value="">Select...</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Saving..." : "Create Profile"}
        </button>

        {status === "error" && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verify the web app builds**

Run: `pnpm --filter web build`
Expected: Clean build with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/intake/page.tsx
git commit -m "feat(web): add draft plan creation, display, and approve/reject UI"
```

---

### Task 8: README Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add plan endpoint documentation**

In `README.md`, after the `GET /api/assessments/:assessmentId` section (before `## Running Tests`), add the following content:

```markdown
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

**Note:** Approved plans do not yet generate scheduled workouts.

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
```

Also update the `## Status` section near the top of README.md from:

```
**Phase: Assessment Handoff** -- profile creation, consultation intake, and assessment handoff are wired up. Assessment is a status record only; plan generation is not yet implemented. No real AI calls yet.
```

to:

```
**Phase: Draft Plan Lifecycle** -- profile creation, consultation intake, assessment handoff, and draft plan lifecycle are wired up. Plan generation is deterministic/mock. Approved plans do not yet generate scheduled workouts. No real AI calls yet.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document plan endpoints in README"
```

---

### Task 9: Full Build and Test Verification

- [ ] **Step 1: Run the full build**

Run: `pnpm build`
Expected: All packages and apps build successfully.

- [ ] **Step 2: Run all tests**

Run: `DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm test`
Expected: All tests pass (both existing assessment tests and new plan tests).

- [ ] **Step 3: Verify typecheck (if separate)**

Run: `pnpm typecheck` (or `pnpm exec tsc --noEmit` if there's no typecheck script)
Expected: No type errors.
