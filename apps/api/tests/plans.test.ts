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
