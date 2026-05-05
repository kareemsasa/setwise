import { describe, it, expect } from "vitest";
import {
  detectProgressionPatterns,
  type SessionExerciseRecord,
} from "../src/rules/pattern-detection.js";
import type {
  ExercisePerformanceSummary,
  ExerciseCompletionStatus,
  DetectedPattern,
} from "@setwise/domain";

function makeExerciseSummary(
  overrides: Partial<ExercisePerformanceSummary> & {
    exerciseName: string;
    completionRate: number;
    status: ExerciseCompletionStatus;
  },
): ExercisePerformanceSummary {
  return {
    exercisePrescriptionId: "rx-1",
    prescribedSets: 3,
    loggedSets: 3,
    prescribedRepsPerSet: 10,
    completedReps: Math.round(overrides.completionRate * 30),
    totalPrescribedReps: 30,
    painReported: false,
    setBreakdown: [],
    ...overrides,
  };
}

describe("detectProgressionPatterns", () => {
  it("returns empty array when fewer than 2 sessions", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Bench Press",
            completionRate: 0.7,
            status: "partial",
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    expect(result).toEqual([]);
  });

  it("detects repeated rep shortfall across 3 sessions", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Bench Press",
            completionRate: 0.7,
            status: "partial",
          }),
        ],
      },
      {
        sessionId: "session-2",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Bench Press",
            completionRate: 0.75,
            status: "partial",
          }),
        ],
      },
      {
        sessionId: "session-3",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Bench Press",
            completionRate: 0.8,
            status: "partial",
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    const pattern = result.find(
      (p) =>
        p.patternType === "rep_shortfall" && p.exerciseName === "Bench Press",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.severity).toBe("warning");
    expect(pattern!.evidence.occurrences).toBe(3);
  });

  it("detects repeated consistent completion across 3 sessions", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Squat",
            completionRate: 1.0,
            status: "completed",
          }),
        ],
      },
      {
        sessionId: "session-2",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Squat",
            completionRate: 1.1,
            status: "completed",
          }),
        ],
      },
      {
        sessionId: "session-3",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Squat",
            completionRate: 1.0,
            status: "completed",
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    const pattern = result.find(
      (p) =>
        p.patternType === "consistent_completion" && p.exerciseName === "Squat",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.severity).toBe("info");
  });

  it("detects repeated pain recurrence across 2 sessions", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Deadlift",
            completionRate: 0.9,
            status: "partial",
            painReported: true,
          }),
        ],
      },
      {
        sessionId: "session-2",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Deadlift",
            completionRate: 1.0,
            status: "completed",
            painReported: true,
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    const pattern = result.find(
      (p) =>
        p.patternType === "pain_recurrence" && p.exerciseName === "Deadlift",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.severity).toBe("action_needed");
  });

  it("does not flag pain_recurrence when only 1 of 2 sessions has pain", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Deadlift",
            completionRate: 1.0,
            status: "completed",
            painReported: true,
          }),
        ],
      },
      {
        sessionId: "session-2",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Deadlift",
            completionRate: 1.0,
            status: "completed",
            painReported: false,
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    const pattern = result.find(
      (p) =>
        p.patternType === "pain_recurrence" && p.exerciseName === "Deadlift",
    );
    expect(pattern).toBeUndefined();
  });

  it("flags rep_shortfall when 2 of 3 sessions are below threshold", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Overhead Press",
            completionRate: 0.7,
            status: "partial",
          }),
        ],
      },
      {
        sessionId: "session-2",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Overhead Press",
            completionRate: 1.0,
            status: "completed",
          }),
        ],
      },
      {
        sessionId: "session-3",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Overhead Press",
            completionRate: 0.8,
            status: "partial",
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    const pattern = result.find(
      (p) =>
        p.patternType === "rep_shortfall" &&
        p.exerciseName === "Overhead Press",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.evidence.occurrences).toBe(2);
  });

  it("handles multiple exercises across sessions — bench partial and squat complete both detected", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Bench Press",
            completionRate: 0.7,
            status: "partial",
          }),
          makeExerciseSummary({
            exercisePrescriptionId: "rx-2",
            exerciseName: "Squat",
            completionRate: 1.0,
            status: "completed",
          }),
        ],
      },
      {
        sessionId: "session-2",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Bench Press",
            completionRate: 0.75,
            status: "partial",
          }),
          makeExerciseSummary({
            exercisePrescriptionId: "rx-2",
            exerciseName: "Squat",
            completionRate: 1.1,
            status: "completed",
          }),
        ],
      },
      {
        sessionId: "session-3",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Bench Press",
            completionRate: 0.8,
            status: "partial",
          }),
          makeExerciseSummary({
            exercisePrescriptionId: "rx-2",
            exerciseName: "Squat",
            completionRate: 1.0,
            status: "completed",
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    const benchPattern = result.find(
      (p) =>
        p.patternType === "rep_shortfall" && p.exerciseName === "Bench Press",
    );
    const squatPattern = result.find(
      (p) =>
        p.patternType === "consistent_completion" && p.exerciseName === "Squat",
    );

    expect(benchPattern).toBeDefined();
    expect(squatPattern).toBeDefined();
  });

  it("ignores exercises with status not_started and loggedSets=0", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Cable Row",
            completionRate: 0.0,
            status: "not_started",
            loggedSets: 0,
            completedReps: 0,
          }),
        ],
      },
      {
        sessionId: "session-2",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Cable Row",
            completionRate: 0.0,
            status: "not_started",
            loggedSets: 0,
            completedReps: 0,
          }),
        ],
      },
      {
        sessionId: "session-3",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Cable Row",
            completionRate: 0.0,
            status: "not_started",
            loggedSets: 0,
            completedReps: 0,
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    const pattern = result.find((p) => p.exerciseName === "Cable Row");
    expect(pattern).toBeUndefined();
  });

  it("handles exercise appearing in subset of sessions with correct sessionsAnalyzed and occurrences", () => {
    const sessions: SessionExerciseRecord[] = [
      {
        sessionId: "session-1",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Pull-up",
            completionRate: 1.0,
            status: "completed",
          }),
        ],
      },
      {
        sessionId: "session-2",
        exercises: [
          makeExerciseSummary({
            exerciseName: "Pull-up",
            completionRate: 1.0,
            status: "completed",
          }),
        ],
      },
      {
        sessionId: "session-3",
        exercises: [
          // Pull-up not present in this session
          makeExerciseSummary({
            exercisePrescriptionId: "rx-other",
            exerciseName: "Dip",
            completionRate: 1.0,
            status: "completed",
          }),
        ],
      },
    ];

    const result = detectProgressionPatterns(sessions);

    const pattern = result.find(
      (p) =>
        p.patternType === "consistent_completion" && p.exerciseName === "Pull-up",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.evidence.sessionsAnalyzed).toBe(3);
    expect(pattern!.evidence.occurrences).toBe(2);
  });
});
