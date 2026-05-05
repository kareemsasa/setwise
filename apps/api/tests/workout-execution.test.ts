import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import {
  db,
  eq,
  scheduledWorkouts,
  workoutSessions,
  attendanceEvents,
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

const START_DATE = "2026-06-01";

interface ScheduledWorkoutFixture {
  profileId: string;
  planId: string;
  planVersionId: string;
  scheduledWorkoutId: string;
  exercises: Array<{ id: string; exerciseName: string; sets: number; repMax: number; weightKg: number | null }>;
}

async function createScheduledWorkoutFixture(): Promise<ScheduledWorkoutFixture> {
  const profileRes = await app.inject({
    method: "POST",
    url: "/api/profiles",
    payload: {
      name: "Execution Tester",
      email: `exec-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
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
    payload: { startDate: START_DATE, weeks: 1 },
  });
  const scheduledWorkoutId = genRes.json().scheduledWorkouts[0].id;

  // Fetch exercises for the first workout's template
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

interface StartedSessionFixture extends ScheduledWorkoutFixture {
  sessionId: string;
}

async function createStartedSessionFixture(): Promise<StartedSessionFixture> {
  const fixture = await createScheduledWorkoutFixture();
  const res = await app.inject({
    method: "POST",
    url: `/api/scheduled-workouts/${fixture.scheduledWorkoutId}/start`,
  });
  const sessionId = res.json().session.id;
  return { ...fixture, sessionId };
}

async function createCompletedSessionFixture(): Promise<StartedSessionFixture> {
  const fixture = await createStartedSessionFixture();
  // The complete route isn't implemented yet, so mark completed directly via DB
  await db
    .update(workoutSessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(workoutSessions.id, fixture.sessionId));
  return fixture;
}

describe("POST /api/scheduled-workouts/:scheduledWorkoutId/start", () => {
  it("creates a new session for an upcoming scheduled workout (201)", async () => {
    const { scheduledWorkoutId } = await createScheduledWorkoutFixture();

    const res = await app.inject({
      method: "POST",
      url: `/api/scheduled-workouts/${scheduledWorkoutId}/start`,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.created).toBe(true);
    expect(body.session.id).toBeDefined();
    expect(body.session.scheduledWorkoutId).toBe(scheduledWorkoutId);
    expect(body.session.status).toBe("in_progress");
    expect(body.session.startedAt).toBeDefined();
  });

  it("returns existing in_progress session on duplicate start (200)", async () => {
    const { scheduledWorkoutId, sessionId } =
      await createStartedSessionFixture();

    const res = await app.inject({
      method: "POST",
      url: `/api/scheduled-workouts/${scheduledWorkoutId}/start`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.created).toBe(false);
    expect(body.session.id).toBe(sessionId);
  });

  it("returns 409 if a completed session already exists", async () => {
    const { scheduledWorkoutId } = await createCompletedSessionFixture();

    const res = await app.inject({
      method: "POST",
      url: `/api/scheduled-workouts/${scheduledWorkoutId}/start`,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBeDefined();
  });

  it("returns 404 for non-existent scheduled workout", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/scheduled-workouts/00000000-0000-0000-0000-000000000000/start",
    });

    expect(res.statusCode).toBe(404);
  });

  it("creates a clock_in attendance event on start", async () => {
    const { scheduledWorkoutId } = await createScheduledWorkoutFixture();

    const res = await app.inject({
      method: "POST",
      url: `/api/scheduled-workouts/${scheduledWorkoutId}/start`,
    });
    expect(res.statusCode).toBe(201);

    const events = await db
      .select()
      .from(attendanceEvents)
      .where(eq(attendanceEvents.scheduledWorkoutId, scheduledWorkoutId));

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("clock_in");
    expect(events[0].actualTime).toBeDefined();
    // scheduledTime is null because generated workouts have no scheduled_time
    expect(events[0].scheduledTime).toBeNull();
    expect(events[0].varianceMinutes).toBeNull();
  });
});

describe("GET /api/scheduled-workouts/:scheduledWorkoutId/session", () => {
  it("returns the session for a scheduled workout (200)", async () => {
    const { scheduledWorkoutId, sessionId } =
      await createStartedSessionFixture();

    const res = await app.inject({
      method: "GET",
      url: `/api/scheduled-workouts/${scheduledWorkoutId}/session`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.session.id).toBe(sessionId);
  });

  it("returns 404 when no session exists", async () => {
    const { scheduledWorkoutId } = await createScheduledWorkoutFixture();

    const res = await app.inject({
      method: "GET",
      url: `/api/scheduled-workouts/${scheduledWorkoutId}/session`,
    });

    expect(res.statusCode).toBe(404);
  });
});
