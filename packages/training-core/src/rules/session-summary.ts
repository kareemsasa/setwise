import type {
  ExercisePrescription,
  SetLog,
  WorkoutSessionStatus,
  SetPerformance,
  ExercisePerformanceSummary,
  ExerciseCompletionStatus,
  SessionPerformanceSummary,
} from "@setwise/domain";

export interface SessionSummaryInput {
  sessionId: string;
  sessionStatus: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
  prescriptions: ExercisePrescription[];
  setLogs: SetLog[];
}

/**
 * Dedup set logs by exercisePrescriptionId + setNumber.
 * When duplicates exist, keep the last occurrence in the array
 * (the API fetches in insertion order, so last = most recent).
 */
function dedupSetLogs(logs: SetLog[]): SetLog[] {
  const map = new Map<string, SetLog>();
  for (const log of logs) {
    const key = `${log.exercisePrescriptionId ?? "null"}:${log.setNumber}`;
    map.set(key, log);
  }
  return Array.from(map.values());
}

function buildSetBreakdown(
  prescription: ExercisePrescription,
  logs: SetLog[],
): SetPerformance[] {
  const logsBySetNumber = new Map<number, SetLog>();
  for (const log of logs) {
    logsBySetNumber.set(log.setNumber, log);
  }

  const breakdown: SetPerformance[] = [];

  // Prescribed sets (1..prescribedSets)
  for (let i = 1; i <= prescription.sets; i++) {
    const log = logsBySetNumber.get(i);
    if (log) {
      breakdown.push({
        setNumber: i,
        prescribedReps: log.prescribedReps,
        actualReps: log.actualReps,
        prescribedWeightKg: prescription.weightKg,
        actualWeightKg: log.actualWeightKg,
        rpeActual: log.rpeActual,
        painReported: log.painReported,
        skipped: log.skipped,
        logged: true,
      });
      logsBySetNumber.delete(i);
    } else {
      breakdown.push({
        setNumber: i,
        prescribedReps: prescription.repMax,
        actualReps: 0,
        prescribedWeightKg: prescription.weightKg,
        actualWeightKg: null,
        rpeActual: null,
        painReported: false,
        skipped: false,
        logged: false,
      });
    }
  }

  // Extra sets beyond prescription (sorted by set number)
  const extras = Array.from(logsBySetNumber.entries()).sort(
    ([a], [b]) => a - b,
  );
  for (const [setNumber, log] of extras) {
    breakdown.push({
      setNumber,
      prescribedReps: log.prescribedReps,
      actualReps: log.actualReps,
      prescribedWeightKg: prescription.weightKg,
      actualWeightKg: log.actualWeightKg,
      rpeActual: log.rpeActual,
      painReported: log.painReported,
      skipped: log.skipped,
      logged: true,
    });
  }

  return breakdown;
}

function computeExerciseSummary(
  prescription: ExercisePrescription,
  logs: SetLog[],
): ExercisePerformanceSummary {
  const breakdown = buildSetBreakdown(prescription, logs);
  const loggedSets = breakdown.filter((s) => s.logged).length;
  const completedReps = breakdown
    .filter((s) => s.logged)
    .reduce((sum, s) => sum + s.actualReps, 0);
  const totalPrescribedReps = prescription.repMax * prescription.sets;
  const completionRate =
    totalPrescribedReps > 0 ? completedReps / totalPrescribedReps : 0;
  const painReported = breakdown.some((s) => s.painReported);

  let status: ExerciseCompletionStatus;
  if (loggedSets === 0) {
    status = "not_started";
  } else if (
    loggedSets >= prescription.sets &&
    completedReps >= totalPrescribedReps
  ) {
    status = "completed";
  } else {
    status = "partial";
  }

  return {
    exercisePrescriptionId: prescription.id,
    exerciseName: prescription.exerciseName,
    prescribedSets: prescription.sets,
    loggedSets,
    prescribedRepsPerSet: prescription.repMax,
    completedReps,
    totalPrescribedReps,
    completionRate,
    status,
    painReported,
    setBreakdown: breakdown,
  };
}

export function computeSessionSummary(
  input: SessionSummaryInput,
): SessionPerformanceSummary {
  const deduped = dedupSetLogs(input.setLogs);

  // Group logs by exercisePrescriptionId
  const logsByPrescription = new Map<string, SetLog[]>();
  for (const log of deduped) {
    if (log.exercisePrescriptionId == null) continue;
    const existing = logsByPrescription.get(log.exercisePrescriptionId) ?? [];
    existing.push(log);
    logsByPrescription.set(log.exercisePrescriptionId, existing);
  }

  const exercises = input.prescriptions.map((p) => {
    const logs = logsByPrescription.get(p.id) ?? [];
    return computeExerciseSummary(p, logs);
  });

  const totalPrescribedSets = exercises.reduce(
    (sum, e) => sum + e.prescribedSets,
    0,
  );
  const totalLoggedSets = exercises.reduce((sum, e) => sum + e.loggedSets, 0);
  const totalPrescribedReps = exercises.reduce(
    (sum, e) => sum + e.totalPrescribedReps,
    0,
  );
  const totalCompletedReps = exercises.reduce(
    (sum, e) => sum + e.completedReps,
    0,
  );

  return {
    sessionId: input.sessionId,
    sessionStatus: input.sessionStatus,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    totalExercises: input.prescriptions.length,
    completedExercises: exercises.filter((e) => e.status === "completed").length,
    totalPrescribedSets,
    totalLoggedSets,
    totalPrescribedReps,
    totalCompletedReps,
    completionRate:
      totalPrescribedReps > 0 ? totalCompletedReps / totalPrescribedReps : 0,
    painReported: exercises.some((e) => e.painReported),
    exercises,
  };
}
