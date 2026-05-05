import { describe, it, expect } from "vitest";
import { computeSessionSummary } from "../src/rules/session-summary.js";
import type {
  SessionSummaryInput,
  ExercisePrescription,
  SetLog,
} from "@setwise/domain";

function makePrescription(
  overrides: Partial<ExercisePrescription> & {
    id: string;
    exerciseName: string;
  },
): ExercisePrescription {
  return {
    workoutTemplateId: "template-1",
    orderInWorkout: 1,
    sets: 3,
    repMin: 8,
    repMax: 10,
    weightKg: 60,
    rpeTarget: 7,
    restSeconds: 90,
    notes: null,
    ...overrides,
  };
}

function makeSetLog(
  overrides: Partial<SetLog> & {
    exercisePrescriptionId: string;
    setNumber: number;
    actualReps: number;
  },
): SetLog {
  return {
    id: `log-${overrides.exercisePrescriptionId}-${overrides.setNumber}`,
    sessionId: "session-1",
    exerciseName: "Bench Press",
    prescribedReps: 10,
    prescribedWeightKg: 60,
    actualWeightKg: 60,
    rpeActual: null,
    painReported: false,
    painNotes: null,
    skipped: false,
    skipReason: null,
    ...overrides,
  };
}

function makeInput(
  overrides?: Partial<SessionSummaryInput>,
): SessionSummaryInput {
  return {
    sessionId: "session-1",
    sessionStatus: "completed",
    startedAt: "2026-05-05T10:00:00Z",
    completedAt: "2026-05-05T11:00:00Z",
    prescriptions: [],
    setLogs: [],
    ...overrides,
  };
}

describe("computeSessionSummary", () => {
  it("fully completed workout", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 3,
        actualReps: 11,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.totalExercises).toBe(1);
    expect(result.completedExercises).toBe(1);
    expect(result.totalPrescribedSets).toBe(3);
    expect(result.totalLoggedSets).toBe(3);
    expect(result.totalPrescribedReps).toBe(30);
    expect(result.totalCompletedReps).toBe(31);
    expect(result.completionRate).toBeGreaterThanOrEqual(1);
    expect(result.painReported).toBe(false);
    expect(result.exercises[0].status).toBe("completed");
  });

  it("partially completed workout", () => {
    const rx1 = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
    });
    const rx2 = makePrescription({
      id: "rx-2",
      exerciseName: "Squat",
      sets: 3,
      repMax: 8,
      orderInWorkout: 2,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 3,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-2",
        exerciseName: "Squat",
        setNumber: 1,
        prescribedReps: 8,
        actualReps: 6,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx1, rx2], setLogs: logs }),
    );

    expect(result.totalExercises).toBe(2);
    expect(result.completedExercises).toBe(1);
    expect(result.exercises[0].status).toBe("completed");
    expect(result.exercises[1].status).toBe("partial");
    expect(result.exercises[1].loggedSets).toBe(1);
    expect(result.exercises[1].completedReps).toBe(6);
  });

  it("no set logs — all not_started", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
    });

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: [] }),
    );

    expect(result.totalExercises).toBe(1);
    expect(result.completedExercises).toBe(0);
    expect(result.totalLoggedSets).toBe(0);
    expect(result.totalCompletedReps).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.exercises[0].status).toBe("not_started");
    expect(result.exercises[0].setBreakdown).toHaveLength(3);
    expect(result.exercises[0].setBreakdown[0].logged).toBe(false);
  });

  it("pain reported propagates to exercise and session", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 2,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
        painReported: false,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 8,
        painReported: true,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.painReported).toBe(true);
    expect(result.exercises[0].painReported).toBe(true);
    expect(result.exercises[0].setBreakdown[0].painReported).toBe(false);
    expect(result.exercises[0].setBreakdown[1].painReported).toBe(true);
  });

  it("reps below prescribed — status partial", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 8,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 7,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 3,
        actualReps: 6,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].status).toBe("partial");
    expect(result.exercises[0].loggedSets).toBe(3);
    expect(result.exercises[0].completedReps).toBe(21);
    expect(result.exercises[0].totalPrescribedReps).toBe(30);
    expect(result.exercises[0].completionRate).toBeCloseTo(0.7);
  });

  it("extra logged sets appear in breakdown but not prescribed totals", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 2,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 3,
        actualReps: 8,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].setBreakdown).toHaveLength(3);
    expect(result.exercises[0].loggedSets).toBe(3);
    expect(result.exercises[0].prescribedSets).toBe(2);
    expect(result.exercises[0].totalPrescribedReps).toBe(20);
    expect(result.exercises[0].completedReps).toBe(28);
    expect(result.exercises[0].completionRate).toBe(1.4);
    expect(result.exercises[0].status).toBe("completed");
  });

  it("duplicate set logs — last occurrence wins", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 1,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        id: "log-first",
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 5,
      }),
      makeSetLog({
        id: "log-second",
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].completedReps).toBe(10);
    expect(result.exercises[0].setBreakdown[0].actualReps).toBe(10);
  });

  it("no prescriptions (ad-hoc session) — empty exercises", () => {
    const result = computeSessionSummary(
      makeInput({ prescriptions: [], setLogs: [] }),
    );

    expect(result.totalExercises).toBe(0);
    expect(result.completedExercises).toBe(0);
    expect(result.totalPrescribedSets).toBe(0);
    expect(result.totalLoggedSets).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.exercises).toEqual([]);
  });

  it("skipped sets count as logged but do not add reps", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 2,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 2,
        actualReps: 0,
        skipped: true,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].loggedSets).toBe(2);
    expect(result.exercises[0].completedReps).toBe(10);
    expect(result.exercises[0].status).toBe("partial");
    expect(result.exercises[0].setBreakdown[1].logged).toBe(true);
    expect(result.exercises[0].setBreakdown[1].skipped).toBe(true);
  });

  it("unlogged sets appear in breakdown with logged: false", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 3,
      repMax: 10,
      weightKg: 60,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 10,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].setBreakdown).toHaveLength(3);

    const unlogged = result.exercises[0].setBreakdown[1];
    expect(unlogged.logged).toBe(false);
    expect(unlogged.setNumber).toBe(2);
    expect(unlogged.prescribedReps).toBe(10);
    expect(unlogged.actualReps).toBe(0);
    expect(unlogged.prescribedWeightKg).toBe(60);
    expect(unlogged.actualWeightKg).toBeNull();
    expect(unlogged.painReported).toBe(false);
    expect(unlogged.skipped).toBe(false);
  });

  it("skipped sets can carry painReported", () => {
    const rx = makePrescription({
      id: "rx-1",
      exerciseName: "Bench Press",
      sets: 1,
      repMax: 10,
    });
    const logs = [
      makeSetLog({
        exercisePrescriptionId: "rx-1",
        setNumber: 1,
        actualReps: 0,
        skipped: true,
        painReported: true,
      }),
    ];

    const result = computeSessionSummary(
      makeInput({ prescriptions: [rx], setLogs: logs }),
    );

    expect(result.exercises[0].painReported).toBe(true);
    expect(result.painReported).toBe(true);
    expect(result.exercises[0].setBreakdown[0].skipped).toBe(true);
    expect(result.exercises[0].setBreakdown[0].painReported).toBe(true);
  });
});
