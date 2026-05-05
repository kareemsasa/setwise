# Assessment Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a completed consultation, allow creating an assessment handoff record that tracks the (future) background review step.

**Architecture:** New `consultationAssessmentRoutes` plugin for POST/GET under `/api/consultations/:consultationId/assessments`. Existing `assessmentRoutes` stub replaced with real GET by ID. Validation schema added for UUID params. No domain/DB schema changes needed.

**Tech Stack:** TypeScript, Fastify 5, Drizzle ORM, Zod, Vitest, Next.js 15

---

### Task 1: Add drizzle-orm operator re-exports

**Files:**
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add `and`, `inArray`, `desc` exports**

```typescript
export { eq, and, inArray, desc } from "drizzle-orm";
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @setwise/db build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): export and, inArray, desc from drizzle-orm"
```

---

### Task 2: Add assessment validation schema

**Files:**
- Create: `packages/validation/src/assessment.ts`
- Modify: `packages/validation/src/index.ts`

- [ ] **Step 1: Create assessment validation schema**

Create `packages/validation/src/assessment.ts`:

```typescript
import { z } from "zod";

export const assessmentParamsSchema = z.object({
  consultationId: z.string().uuid(),
});

export const assessmentByIdParamsSchema = z.object({
  assessmentId: z.string().uuid(),
});
```

- [ ] **Step 2: Export from index**

Add to `packages/validation/src/index.ts`:

```typescript
export * from "./assessment.js";
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @setwise/validation build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/validation/src/assessment.ts packages/validation/src/index.ts
git commit -m "feat(validation): add assessment param schemas"
```

---

### Task 3: Implement consultation assessment routes (POST + GET)

**Files:**
- Create: `apps/api/src/routes/consultation-assessments.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Create the route plugin**

Create `apps/api/src/routes/consultation-assessments.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { assessmentParamsSchema } from "@setwise/validation";
import { db, eq, and, inArray, desc, consultations, assessments } from "@setwise/db";

export const consultationAssessmentRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parsed = assessmentParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { consultationId } = parsed.data;

    const [consultation] = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, consultationId))
      .limit(1);

    if (!consultation) {
      return reply.status(404).send({ error: "Consultation not found" });
    }

    if (consultation.status !== "completed") {
      return reply.status(422).send({
        error: "Consultation is not completed",
        status: consultation.status,
      });
    }

    const [existing] = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.consultationId, consultationId),
          inArray(assessments.status, ["pending", "processing"]),
        ),
      )
      .limit(1);

    if (existing) {
      return reply.status(409).send({
        error: "An active assessment already exists for this consultation",
        assessment: {
          id: existing.id,
          consultationId: existing.consultationId,
          status: existing.status,
          inputSnapshot: existing.inputSnapshot,
          result: existing.result,
          createdAt: existing.createdAt,
          completedAt: existing.completedAt,
        },
      });
    }

    const [assessment] = await db
      .insert(assessments)
      .values({
        consultationId,
        status: "pending",
        inputSnapshot: consultation.structuredOutput,
      })
      .returning();

    return reply.status(201).send({
      id: assessment.id,
      consultationId: assessment.consultationId,
      status: assessment.status,
      inputSnapshot: assessment.inputSnapshot,
      result: assessment.result,
      createdAt: assessment.createdAt,
      completedAt: assessment.completedAt,
    });
  });

  app.get("/", async (request, reply) => {
    const parsed = assessmentParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { consultationId } = parsed.data;

    const [consultation] = await db
      .select({ id: consultations.id })
      .from(consultations)
      .where(eq(consultations.id, consultationId))
      .limit(1);

    if (!consultation) {
      return reply.status(404).send({ error: "Consultation not found" });
    }

    const rows = await db
      .select()
      .from(assessments)
      .where(eq(assessments.consultationId, consultationId))
      .orderBy(desc(assessments.createdAt));

    const result = rows.map((a) => ({
      id: a.id,
      consultationId: a.consultationId,
      status: a.status,
      inputSnapshot: a.inputSnapshot,
      result: a.result,
      createdAt: a.createdAt,
      completedAt: a.completedAt,
    }));

    return reply.status(200).send(result);
  });
};
```

- [ ] **Step 2: Register the route plugin in app.ts**

Add import and registration in `apps/api/src/app.ts`:

```typescript
import { consultationAssessmentRoutes } from "./routes/consultation-assessments.js";
```

Register:

```typescript
app.register(consultationAssessmentRoutes, { prefix: "/api/consultations/:consultationId/assessments" });
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter api build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/consultation-assessments.ts apps/api/src/app.ts
git commit -m "feat(api): add POST and GET for consultation assessments"
```

---

### Task 4: Replace assessment route stub with real GET by ID

**Files:**
- Modify: `apps/api/src/routes/assessments.ts`

- [ ] **Step 1: Replace the stub**

Replace `apps/api/src/routes/assessments.ts` with:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { assessmentByIdParamsSchema } from "@setwise/validation";
import { db, eq, assessments } from "@setwise/db";

export const assessmentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:assessmentId", async (request, reply) => {
    const parsed = assessmentByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { assessmentId } = parsed.data;

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return reply.status(404).send({ error: "Assessment not found" });
    }

    return reply.status(200).send({
      id: assessment.id,
      consultationId: assessment.consultationId,
      status: assessment.status,
      inputSnapshot: assessment.inputSnapshot,
      result: assessment.result,
      createdAt: assessment.createdAt,
      completedAt: assessment.completedAt,
    });
  });
};
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter api build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/assessments.ts
git commit -m "feat(api): implement GET /api/assessments/:assessmentId"
```

---

### Task 5: Write integration tests

**Files:**
- Create: `apps/api/tests/assessments.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/api/tests/assessments.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { db, eq, assessments } from "@setwise/db";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const validProfile = {
  name: "Assessment Tester",
  email: `assess-${Date.now()}@example.com`,
  heightCm: 175,
  weightKg: 80,
  dateOfBirth: "1992-03-10",
  biologicalSex: "male",
  experienceLevel: "intermediate",
};

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
    specificTargets: [],
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

async function createProfileAndConsultation(): Promise<{
  profileId: string;
  consultationId: string;
}> {
  const profileRes = await app.inject({
    method: "POST",
    url: "/api/profiles",
    payload: {
      ...validProfile,
      email: `assess-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    },
  });
  const profileId = profileRes.json().id;

  const consultRes = await app.inject({
    method: "POST",
    url: `/api/profiles/${profileId}/consultations`,
    payload: validIntake,
  });
  const consultationId = consultRes.json().id;

  return { profileId, consultationId };
}

describe("POST /api/consultations/:consultationId/assessments", () => {
  it("creates an assessment from a completed consultation", async () => {
    const { consultationId } = await createProfileAndConsultation();

    const res = await app.inject({
      method: "POST",
      url: `/api/consultations/${consultationId}/assessments`,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.consultationId).toBe(consultationId);
    expect(body.status).toBe("pending");
    expect(body.inputSnapshot).toBeDefined();
    expect(body.inputSnapshot.goals.primaryGoal).toBe("strength");
    expect(body.result).toBeNull();
    expect(body.createdAt).toBeDefined();
    expect(body.completedAt).toBeNull();
  });

  it("returns 404 for a non-existent consultation", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "POST",
      url: `/api/consultations/${fakeId}/assessments`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Consultation not found");
  });

  it("returns 400 for an invalid consultation ID", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/consultations/not-a-uuid/assessments`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });

  it("returns 409 when a pending assessment already exists", async () => {
    const { consultationId } = await createProfileAndConsultation();

    const first = await app.inject({
      method: "POST",
      url: `/api/consultations/${consultationId}/assessments`,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: `/api/consultations/${consultationId}/assessments`,
    });
    expect(second.statusCode).toBe(409);
    const body = second.json();
    expect(body.error).toContain("active assessment already exists");
    expect(body.assessment.id).toBe(first.json().id);
  });

  it("allows a new assessment after a previous one failed", async () => {
    const { consultationId } = await createProfileAndConsultation();

    const first = await app.inject({
      method: "POST",
      url: `/api/consultations/${consultationId}/assessments`,
    });
    expect(first.statusCode).toBe(201);
    const firstId = first.json().id;

    // Manually mark the assessment as failed
    await db
      .update(assessments)
      .set({ status: "failed" })
      .where(eq(assessments.id, firstId));

    const second = await app.inject({
      method: "POST",
      url: `/api/consultations/${consultationId}/assessments`,
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().id).not.toBe(firstId);
    expect(second.json().status).toBe("pending");
  });
});

describe("GET /api/consultations/:consultationId/assessments", () => {
  it("lists assessments for a consultation", async () => {
    const { consultationId } = await createProfileAndConsultation();

    await app.inject({
      method: "POST",
      url: `/api/consultations/${consultationId}/assessments`,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/consultations/${consultationId}/assessments`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].consultationId).toBe(consultationId);
    expect(body[0].status).toBe("pending");
  });

  it("returns an empty array when no assessments exist", async () => {
    const { consultationId } = await createProfileAndConsultation();

    const res = await app.inject({
      method: "GET",
      url: `/api/consultations/${consultationId}/assessments`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns 404 for a non-existent consultation", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "GET",
      url: `/api/consultations/${fakeId}/assessments`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Consultation not found");
  });
});

describe("GET /api/assessments/:assessmentId", () => {
  it("fetches a single assessment by ID", async () => {
    const { consultationId } = await createProfileAndConsultation();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/consultations/${consultationId}/assessments`,
    });
    const assessmentId = createRes.json().id;

    const res = await app.inject({
      method: "GET",
      url: `/api/assessments/${assessmentId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(assessmentId);
    expect(body.consultationId).toBe(consultationId);
    expect(body.status).toBe("pending");
  });

  it("returns 404 for a non-existent assessment", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "GET",
      url: `/api/assessments/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Assessment not found");
  });

  it("returns 400 for an invalid assessment ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assessments/not-a-uuid`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm --filter api test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/assessments.test.ts
git commit -m "test(api): add assessment integration tests"
```

---

### Task 6: Add "Submit for Assessment" to web intake completion

**Files:**
- Modify: `apps/web/src/app/intake/page.tsx`

- [ ] **Step 1: Update the intake page**

The "done" phase currently shows a static message. Update it to include the consultation ID in state, and add a "Submit for Assessment" button.

Changes to `apps/web/src/app/intake/page.tsx`:

1. Add `consultationId` state alongside `profileId`.
2. Save the consultation ID from the consultation POST response.
3. Add `assessmentStatus` state (`idle`, `submitting`, `created`, `conflict`, `error`).
4. Replace the "done" phase with:

```tsx
if (phase === "done") {
  return (
    <main style={containerStyle}>
      <h1>Intake Complete</h1>
      <p>
        Your profile and consultation data have been saved.
      </p>

      {assessmentStatus === "idle" && (
        <button
          onClick={handleAssessmentSubmit}
          disabled={!consultationId}
        >
          Submit for Assessment
        </button>
      )}

      {assessmentStatus === "submitting" && <p>Submitting...</p>}

      {assessmentStatus === "created" && (
        <p>
          Assessment created with status: <strong>pending</strong>.
          Plan generation is not yet implemented.
        </p>
      )}

      {assessmentStatus === "conflict" && (
        <p>An assessment is already in progress for this consultation.</p>
      )}

      {assessmentStatus === "error" && (
        <p style={{ color: "red" }}>{error}</p>
      )}
    </main>
  );
}
```

The `handleAssessmentSubmit` function:

```typescript
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
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/intake/page.tsx
git commit -m "feat(web): add submit for assessment action on intake completion"
```

---

### Task 7: Update README with assessment endpoints

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add after the existing consultation endpoint docs:

```markdown
### POST /api/consultations/:consultationId/assessments

Create an assessment from a completed consultation. The assessment is a status record only — no plan generation occurs yet.

**Response (201):**

```json
{
  "id": "uuid",
  "consultationId": "uuid",
  "status": "pending",
  "inputSnapshot": { ... },
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
    "inputSnapshot": { ... },
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
  "inputSnapshot": { ... },
  "result": null,
  "createdAt": "2026-05-04T...",
  "completedAt": null
}
```

**Error responses:**

- `400` — Invalid assessment ID (not a UUID)
- `404` — Assessment not found
```

Update the Status section from "Consultation Intake" to "Assessment Handoff".

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document assessment endpoints"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (if script exists, otherwise `pnpm tsc --noEmit` across packages)

- [ ] **Step 3: Run all tests**

Run: `DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm test`
Expected: All tests pass

- [ ] **Step 4: Final commit if any cleanup needed**
