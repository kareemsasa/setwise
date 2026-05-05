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
    const { profileId, planId, planVersionId } = await createApprovedPlan();

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.planId).toBe(planId);
    expect(body.planVersionId).toBe(planVersionId);
    expect(body.versionNumber).toBe(1);
    expect(body.generatedCount).toBe(16);
    expect(body.scheduledWorkouts).toHaveLength(16);

    // Check first workout shape
    const first = body.scheduledWorkouts[0];
    expect(first.id).toBeDefined();
    expect(first.profileId).toBe(profileId);
    expect(first.scheduledDate).toBe("2026-06-01");
    expect(first.status).toBe("upcoming");
    expect(first.template).toBeDefined();
    expect(first.template.name).toBeDefined();
    expect(first.template.estimatedDurationMinutes).toBe(60);

    // Assert workouts are sorted by date
    const dates = body.scheduledWorkouts.map(
      (w: { scheduledDate: string }) => w.scheduledDate,
    );
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it("rejects unapproved plan (409)", async () => {
    const profileRes = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: {
        name: "Unapproved Tester",
        email: `unapproved-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
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

    // Do NOT approve
    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Plan is not approved");
  });

  it("rejects plan with non-approved latest version (409)", async () => {
    const { planId } = await createApprovedPlan();

    // Insert a new draft version directly via DB
    await db.insert(planVersions).values({
      planId,
      versionNumber: 2,
      status: "draft",
      structure: {},
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Latest plan version is not approved");
  });

  it("returns 409 on duplicate generation", async () => {
    const { planId } = await createApprovedPlan();

    // First generation should succeed
    const first = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
    });
    expect(first.statusCode).toBe(201);

    // Second generation should fail
    const second = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe(
      "Scheduled workouts already exist for this plan version",
    );
    expect(second.json().existingCount).toBe(16);
    expect(second.json().scheduledWorkouts).toBeDefined();
  });

  it("returns 404 for non-existent plan", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/plans/00000000-0000-0000-0000-000000000000/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
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
    const body = res.json();
    expect(body.generatedCount).toBe(8);
    expect(body.scheduledWorkouts).toHaveLength(8);
  });
});

describe("GET /api/scheduled-workouts", () => {
  it("lists scheduled workouts ordered by date", async () => {
    const { profileId, planId } = await createApprovedPlan();

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

    // Check shape of first item
    const first = body[0];
    expect(first.profileId).toBeDefined();
    expect(first.scheduledDate).toBeDefined();
    expect(first.template).toBeDefined();
    expect(first.template.name).toBeDefined();

    // Assert dates are sorted ascending
    const dates = body.map((w: { scheduledDate: string }) => w.scheduledDate);
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

    const res = await app.inject({
      method: "GET",
      url: "/api/scheduled-workouts?start=2026-06-01&end=2026-06-07",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    // Assert all returned workouts have scheduledDate between 2026-06-01 and 2026-06-07
    for (const workout of body) {
      expect(workout.scheduledDate >= "2026-06-01").toBe(true);
      expect(workout.scheduledDate <= "2026-06-07").toBe(true);
    }
  });
});

describe("GET /api/scheduled-workouts/:scheduledWorkoutId", () => {
  it("fetches a scheduled workout with exercises", async () => {
    const { profileId, planId } = await createApprovedPlan();

    const genRes = await app.inject({
      method: "POST",
      url: `/api/plans/${planId}/scheduled-workouts`,
      payload: { startDate: START_DATE, weeks: 4 },
    });
    const workoutId = genRes.json().scheduledWorkouts[0].id;

    const res = await app.inject({
      method: "GET",
      url: `/api/scheduled-workouts/${workoutId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(workoutId);
    expect(body.profileId).toBe(profileId);
    expect(body.scheduledDate).toBeDefined();
    expect(body.status).toBe("upcoming");

    // Check template with exercises
    expect(body.template).toBeDefined();
    expect(body.template.name).toBeDefined();
    expect(body.template.exercises).toBeDefined();
    expect(body.template.exercises.length).toBeGreaterThan(0);

    // Check first exercise shape
    const firstExercise = body.template.exercises[0];
    expect(firstExercise.exerciseName).toBeDefined();
    expect(firstExercise.sets).toBeGreaterThan(0);
    expect(firstExercise.repMin).toBeGreaterThan(0);
    expect(firstExercise.repMax).toBeGreaterThan(0);
    expect(firstExercise.rpeTarget).toBeGreaterThan(0);
    expect(firstExercise.restSeconds).toBeGreaterThan(0);
    expect(firstExercise.weightKg).toBeNull();
  });

  it("returns 404 for non-existent scheduled workout", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/scheduled-workouts/00000000-0000-0000-0000-000000000000",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Scheduled workout not found");
  });
});
