import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";

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

interface ExerciseInfo {
  id: string;
  exerciseName: string;
  sets: number;
  repMax: number;
  weightKg: number | null;
}

interface ScheduledWorkoutDetail {
  scheduledWorkoutId: string;
  exercises: ExerciseInfo[];
}

interface MultiWorkoutFixture {
  profileId: string;
  planId: string;
  planVersionId: string;
  workouts: ScheduledWorkoutDetail[];
}

/**
 * Creates a profile + plan + generates scheduled workouts (1 week = 4 workouts).
 * Returns all scheduled workouts with their exercises so tests can pick which ones to use.
 */
async function createMultiWorkoutFixture(opts?: {
  startDate?: string;
  weeks?: number;
}): Promise<MultiWorkoutFixture> {
  const profileRes = await app.inject({
    method: "POST",
    url: "/api/profiles",
    payload: {
      name: "Pattern Tester",
      email: `pattern-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
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

  const startDate = opts?.startDate ?? "2026-07-01";
  const weeks = opts?.weeks ?? 1;

  const genRes = await app.inject({
    method: "POST",
    url: `/api/plans/${planId}/scheduled-workouts`,
    payload: { startDate, weeks },
  });
  const genBody = genRes.json();
  const scheduledWorkoutIds: string[] = genBody.scheduledWorkouts.map(
    (sw: any) => sw.id,
  );

  // Fetch exercise details for each scheduled workout
  const workouts: ScheduledWorkoutDetail[] = [];
  for (const swId of scheduledWorkoutIds) {
    const detailRes = await app.inject({
      method: "GET",
      url: `/api/scheduled-workouts/${swId}`,
    });
    const detail = detailRes.json();
    workouts.push({
      scheduledWorkoutId: swId,
      exercises: detail.template.exercises.map((ex: any) => ({
        id: ex.id,
        exerciseName: ex.exerciseName,
        sets: ex.sets,
        repMax: ex.repMax,
        weightKg: ex.weightKg,
      })),
    });
  }

  return { profileId, planId, planVersionId, workouts };
}

/**
 * Find two workouts from the fixture that share at least one exercise name.
 * Returns { w1, w2, sharedExerciseName }.
 */
function findWorkoutPairWithSharedExercise(workouts: ScheduledWorkoutDetail[]): {
  w1: ScheduledWorkoutDetail;
  w2: ScheduledWorkoutDetail;
  sharedExerciseName: string;
} {
  for (let i = 0; i < workouts.length; i++) {
    const namesI = new Set(workouts[i].exercises.map((e) => e.exerciseName));
    for (let j = i + 1; j < workouts.length; j++) {
      const shared = workouts[j].exercises.find((e) => namesI.has(e.exerciseName));
      if (shared) {
        return {
          w1: workouts[i],
          w2: workouts[j],
          sharedExerciseName: shared.exerciseName,
        };
      }
    }
  }
  throw new Error("No two workouts share an exercise name");
}

async function startSession(scheduledWorkoutId: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: `/api/scheduled-workouts/${scheduledWorkoutId}/start`,
  });
  return res.json().session.id;
}

/**
 * Log all sets for a single exercise in a session. Does NOT complete the session.
 */
async function logExerciseSets(
  sessionId: string,
  exercise: ExerciseInfo,
  repsPerSet: number,
  opts?: { painReported?: boolean },
): Promise<void> {
  for (let i = 1; i <= exercise.sets; i++) {
    await app.inject({
      method: "POST",
      url: `/api/workout-sessions/${sessionId}/set-logs`,
      payload: {
        exercisePrescriptionId: exercise.id,
        setNumber: i,
        repsCompleted: repsPerSet,
        painReported: opts?.painReported ?? false,
        weightKg: exercise.weightKg,
      },
    });
  }
}

async function completeSession(sessionId: string): Promise<void> {
  await app.inject({
    method: "POST",
    url: `/api/workout-sessions/${sessionId}/complete`,
  });
}

describe("GET /api/profiles/:profileId/progression-patterns", () => {
  it("returns 400 when profileId is not a valid UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/profiles/not-a-uuid/progression-patterns",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 404 for non-existent profile", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/profiles/00000000-0000-0000-0000-000000000000/progression-patterns",
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe("Profile not found");
  });

  it("returns empty array for profile with no completed sessions", async () => {
    const profileRes = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: {
        name: "No Sessions",
        email: `nosessions-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        heightCm: 170,
        weightKg: 70,
        dateOfBirth: "1995-01-01",
        biologicalSex: "female",
        experienceLevel: "beginner",
      },
    });
    const profileId = profileRes.json().id;

    const res = await app.inject({
      method: "GET",
      url: `/api/profiles/${profileId}/progression-patterns`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns empty array for profile with only one completed session", async () => {
    const fixture = await createMultiWorkoutFixture();
    const workout = fixture.workouts[0];
    const sessionId = await startSession(workout.scheduledWorkoutId);
    const ex = workout.exercises[0];

    await logExerciseSets(sessionId, ex, ex.repMax);
    await completeSession(sessionId);

    const res = await app.inject({
      method: "GET",
      url: `/api/profiles/${fixture.profileId}/progression-patterns`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("detects rep_shortfall pattern across multiple completed sessions", async () => {
    const fixture = await createMultiWorkoutFixture();
    const { w1, w2, sharedExerciseName } = findWorkoutPairWithSharedExercise(
      fixture.workouts,
    );

    const ex1 = w1.exercises.find((e) => e.exerciseName === sharedExerciseName)!;
    const ex2 = w2.exercises.find((e) => e.exerciseName === sharedExerciseName)!;
    const lowReps = Math.floor(ex1.repMax * 0.6);

    // Complete first session with low reps on the shared exercise
    const session1Id = await startSession(w1.scheduledWorkoutId);
    await logExerciseSets(session1Id, ex1, lowReps);
    await completeSession(session1Id);

    // Complete second session with low reps on the shared exercise
    const session2Id = await startSession(w2.scheduledWorkoutId);
    await logExerciseSets(session2Id, ex2, lowReps);
    await completeSession(session2Id);

    const res = await app.inject({
      method: "GET",
      url: `/api/profiles/${fixture.profileId}/progression-patterns`,
    });

    expect(res.statusCode).toBe(200);
    const patterns = res.json();

    const shortfall = patterns.find(
      (p: any) =>
        p.patternType === "rep_shortfall" &&
        p.exerciseName === sharedExerciseName,
    );
    expect(shortfall).toBeDefined();
    expect(shortfall.evidence.occurrences).toBeGreaterThanOrEqual(2);
    expect(shortfall.evidence.sessionIds).toContain(session1Id);
    expect(shortfall.evidence.sessionIds).toContain(session2Id);
  });

  it("filters patterns by exerciseName query param", async () => {
    const fixture = await createMultiWorkoutFixture();
    const { w1, w2, sharedExerciseName } = findWorkoutPairWithSharedExercise(
      fixture.workouts,
    );

    // Complete both sessions logging ALL exercises at full reps so that
    // consistent_completion patterns are produced for every exercise name.
    const session1Id = await startSession(w1.scheduledWorkoutId);
    for (const ex of w1.exercises) {
      await logExerciseSets(session1Id, ex, ex.repMax);
    }
    await completeSession(session1Id);

    const session2Id = await startSession(w2.scheduledWorkoutId);
    for (const ex of w2.exercises) {
      await logExerciseSets(session2Id, ex, ex.repMax);
    }
    await completeSession(session2Id);

    // Unfiltered request
    const unfilteredRes = await app.inject({
      method: "GET",
      url: `/api/profiles/${fixture.profileId}/progression-patterns`,
    });
    expect(unfilteredRes.statusCode).toBe(200);
    const unfilteredPatterns = unfilteredRes.json();

    // Filtered request — filter by the shared exercise name
    const filteredRes = await app.inject({
      method: "GET",
      url: `/api/profiles/${fixture.profileId}/progression-patterns?exerciseName=${encodeURIComponent(sharedExerciseName)}`,
    });
    expect(filteredRes.statusCode).toBe(200);
    const filteredPatterns = filteredRes.json();

    // All returned patterns must match the filtered exercise name
    for (const p of filteredPatterns) {
      expect(p.exerciseName).toBe(sharedExerciseName);
    }

    // Unfiltered should have patterns for multiple exercises; filtered is a subset
    expect(unfilteredPatterns.length).toBeGreaterThan(0);
    expect(filteredPatterns.length).toBeLessThanOrEqual(unfilteredPatterns.length);
  });

  it("respects limit parameter", async () => {
    const fixture = await createMultiWorkoutFixture();
    const { w1, w2, sharedExerciseName } = findWorkoutPairWithSharedExercise(
      fixture.workouts,
    );

    const ex1 = w1.exercises.find((e) => e.exerciseName === sharedExerciseName)!;
    const ex2 = w2.exercises.find((e) => e.exerciseName === sharedExerciseName)!;
    const lowReps = Math.floor(ex1.repMax * 0.6);

    // Complete two sessions with low reps
    const session1Id = await startSession(w1.scheduledWorkoutId);
    await logExerciseSets(session1Id, ex1, lowReps);
    await completeSession(session1Id);

    const session2Id = await startSession(w2.scheduledWorkoutId);
    await logExerciseSets(session2Id, ex2, lowReps);
    await completeSession(session2Id);

    // limit=1 → only 1 session fetched → detectProgressionPatterns returns []
    const limitedRes = await app.inject({
      method: "GET",
      url: `/api/profiles/${fixture.profileId}/progression-patterns?limit=1`,
    });
    expect(limitedRes.statusCode).toBe(200);
    expect(limitedRes.json()).toEqual([]);

    // Without limit restriction, patterns should be detected
    const unlimitedRes = await app.inject({
      method: "GET",
      url: `/api/profiles/${fixture.profileId}/progression-patterns`,
    });
    expect(unlimitedRes.statusCode).toBe(200);
    const patterns = unlimitedRes.json();
    const shortfall = patterns.find(
      (p: any) => p.patternType === "rep_shortfall",
    );
    expect(shortfall).toBeDefined();
  });
});
