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
