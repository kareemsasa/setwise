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
