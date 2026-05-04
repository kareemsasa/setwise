import { describe, it, expect } from "vitest";
import { checkRepCompletion } from "../src/rules/rep-completion.js";
import type { SetLog } from "@setwise/domain";

function makeSetLog(
  overrides: Partial<SetLog> & { prescribedReps: number; actualReps: number },
): SetLog {
  return {
    id: "set-1",
    sessionId: "session-1",
    exerciseName: "Bench Press",
    setNumber: 1,
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

describe("checkRepCompletion", () => {
  it("returns null when not enough sessions", () => {
    const result = checkRepCompletion({
      exerciseName: "Bench Press",
      sessionSets: [
        [makeSetLog({ prescribedReps: 10, actualReps: 10 })],
      ],
    });
    expect(result).toBeNull();
  });

  it("recommends weight increase when all sets complete for consecutive sessions", () => {
    const session = [
      makeSetLog({ prescribedReps: 10, actualReps: 10, setNumber: 1 }),
      makeSetLog({ prescribedReps: 10, actualReps: 11, setNumber: 2 }),
      makeSetLog({ prescribedReps: 10, actualReps: 10, setNumber: 3 }),
    ];

    const result = checkRepCompletion({
      exerciseName: "Bench Press",
      sessionSets: [session, session],
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe("increase_weight");
    expect(result!.exerciseName).toBe("Bench Press");
    expect(result!.sessionsAnalyzed).toBe(2);
  });

  it("returns null when reps fall short in any set", () => {
    const goodSession = [
      makeSetLog({ prescribedReps: 10, actualReps: 10, setNumber: 1 }),
      makeSetLog({ prescribedReps: 10, actualReps: 10, setNumber: 2 }),
    ];
    const badSession = [
      makeSetLog({ prescribedReps: 10, actualReps: 10, setNumber: 1 }),
      makeSetLog({ prescribedReps: 10, actualReps: 8, setNumber: 2 }),
    ];

    const result = checkRepCompletion({
      exerciseName: "Bench Press",
      sessionSets: [goodSession, badSession],
    });

    expect(result).toBeNull();
  });

  it("returns null when a set is skipped", () => {
    const session = [
      makeSetLog({ prescribedReps: 10, actualReps: 10, setNumber: 1 }),
      makeSetLog({
        prescribedReps: 10,
        actualReps: 0,
        setNumber: 2,
        skipped: true,
      }),
    ];

    const result = checkRepCompletion({
      exerciseName: "Bench Press",
      sessionSets: [session, session],
    });

    expect(result).toBeNull();
  });

  it("respects custom consecutive session threshold", () => {
    const session = [
      makeSetLog({ prescribedReps: 10, actualReps: 10 }),
    ];

    // 2 sessions but threshold is 3
    const result = checkRepCompletion({
      exerciseName: "Bench Press",
      sessionSets: [session, session],
      consecutiveSessionsRequired: 3,
    });

    expect(result).toBeNull();
  });

  it("only checks most recent N sessions", () => {
    const goodSession = [
      makeSetLog({ prescribedReps: 10, actualReps: 10 }),
    ];
    const badSession = [
      makeSetLog({ prescribedReps: 10, actualReps: 5 }),
    ];

    // Old bad session followed by 2 good sessions
    const result = checkRepCompletion({
      exerciseName: "Bench Press",
      sessionSets: [badSession, goodSession, goodSession],
    });

    expect(result).not.toBeNull();
  });
});
