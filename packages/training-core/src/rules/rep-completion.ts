import type { SetLog, RecommendationType } from "@setwise/domain";

export interface RepCompletionInput {
  exerciseName: string;
  /** Set logs for this exercise across recent sessions, grouped by session. */
  sessionSets: SetLog[][];
  /** Number of consecutive sessions required to trigger. Default: 2. */
  consecutiveSessionsRequired?: number;
}

export interface WeightIncreaseRecommendation {
  type: typeof INCREASE_WEIGHT;
  exerciseName: string;
  reason: string;
  sessionsAnalyzed: number;
}

const INCREASE_WEIGHT: RecommendationType = "increase_weight";

/**
 * Check if a user consistently completes all sets at or above rep_max
 * for an exercise across consecutive sessions.
 *
 * Rule: if actual_reps >= rep_max on every set for N consecutive sessions,
 * recommend a weight increase.
 */
export function checkRepCompletion(
  input: RepCompletionInput,
): WeightIncreaseRecommendation | null {
  const threshold = input.consecutiveSessionsRequired ?? 2;
  const sessions = input.sessionSets;

  if (sessions.length < threshold) {
    return null;
  }

  // Check the most recent N sessions
  const recentSessions = sessions.slice(-threshold);

  const allComplete = recentSessions.every((sets) => {
    if (sets.length === 0) return false;
    return sets.every(
      (set) => !set.skipped && set.actualReps >= set.prescribedReps,
    );
  });

  if (!allComplete) {
    return null;
  }

  return {
    type: INCREASE_WEIGHT,
    exerciseName: input.exerciseName,
    reason: `Completed all prescribed reps for ${threshold} consecutive sessions`,
    sessionsAnalyzed: threshold,
  };
}
