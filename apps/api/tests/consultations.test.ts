import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const validProfile = {
  name: "Consult Tester",
  email: `consult-${Date.now()}@example.com`,
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
    availableEquipment: ["barbell", "dumbbells", "cables", "pull-up bar"],
    equipmentLimitations: "",
  },
  goals: {
    primaryGoal: "strength",
    secondaryGoals: ["hypertrophy"],
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
    familiarExercises: ["squat", "bench press", "deadlift"],
    recentWorkingWeights: [
      { exercise: "bench press", weightKg: 80, reps: 5, notes: "" },
    ],
    pastObservations: "",
  },
  preferences: {
    likedExercises: ["squat", "overhead press"],
    dislikedExercises: ["leg press"],
    trainingStyle: "compound-focused",
    cardioPreference: "minimal",
    otherNotes: "",
  },
  safetyFlags: [],
  agentNotes: "Test consultation",
};

async function createProfile(
  overrides: Partial<typeof validProfile> = {},
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/profiles",
    payload: { ...validProfile, ...overrides },
  });
  return res.json().id;
}

describe("POST /api/profiles/:profileId/consultations", () => {
  it("creates a consultation with valid intake data", async () => {
    const profileId = await createProfile({
      email: `c-create-${Date.now()}@example.com`,
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/profiles/${profileId}/consultations`,
      payload: validIntake,
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.id).toBeDefined();
    expect(body.profileId).toBe(profileId);
    expect(body.status).toBe("completed");
    expect(body.startedAt).toBeDefined();
    expect(body.completedAt).toBeDefined();
    expect(body.structuredOutput).toBeDefined();
    expect(body.structuredOutput.goals.primaryGoal).toBe("strength");
  });

  it("returns 404 for a non-existent profile", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const response = await app.inject({
      method: "POST",
      url: `/api/profiles/${fakeId}/consultations`,
      payload: validIntake,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("Profile not found");
  });

  it("returns 400 for an invalid payload", async () => {
    const profileId = await createProfile({
      email: `c-invalid-${Date.now()}@example.com`,
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/profiles/${profileId}/consultations`,
      payload: { goals: { primaryGoal: "flying" } },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
  });

  it("returns 400 for an empty payload", async () => {
    const profileId = await createProfile({
      email: `c-empty-${Date.now()}@example.com`,
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/profiles/${profileId}/consultations`,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Validation failed");
  });
});

describe("GET /api/profiles/:profileId/consultations", () => {
  it("returns consultations for a profile", async () => {
    const profileId = await createProfile({
      email: `c-list-${Date.now()}@example.com`,
    });

    await app.inject({
      method: "POST",
      url: `/api/profiles/${profileId}/consultations`,
      payload: validIntake,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/profiles/${profileId}/consultations`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].profileId).toBe(profileId);
    expect(body[0].status).toBe("completed");
  });

  it("returns an empty array for a profile with no consultations", async () => {
    const profileId = await createProfile({
      email: `c-empty-list-${Date.now()}@example.com`,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/profiles/${profileId}/consultations`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("returns 404 for a non-existent profile", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const response = await app.inject({
      method: "GET",
      url: `/api/profiles/${fakeId}/consultations`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("Profile not found");
  });
});
