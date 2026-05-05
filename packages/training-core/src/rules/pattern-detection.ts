import type {
  ExercisePerformanceSummary,
  DetectedPattern,
  DetectedPatternType,
  PatternSeverity,
} from "@setwise/domain";

export interface SessionExerciseRecord {
  sessionId: string;
  exercises: ExercisePerformanceSummary[];
}

interface ExerciseSessionEntry {
  sessionId: string;
  completionRate: number;
  painReported: boolean;
}

export function detectProgressionPatterns(
  records: SessionExerciseRecord[],
): DetectedPattern[] {
  if (records.length < 2) {
    return [];
  }

  // Collect per-exercise data across all sessions, skipping "not_started"
  const exerciseMap = new Map<string, ExerciseSessionEntry[]>();

  for (const record of records) {
    for (const exercise of record.exercises) {
      if (exercise.status === "not_started") {
        continue;
      }

      const existing = exerciseMap.get(exercise.exerciseName) ?? [];
      existing.push({
        sessionId: record.sessionId,
        completionRate: exercise.completionRate,
        painReported: exercise.painReported,
      });
      exerciseMap.set(exercise.exerciseName, existing);
    }
  }

  const patterns: DetectedPattern[] = [];
  const totalSessions = records.length;

  for (const [exerciseName, entries] of exerciseMap) {
    const total = entries.length;

    if (total < 2) {
      continue;
    }

    // rep_shortfall: completionRate < 0.9
    const shortfallEntries = entries.filter((e) => e.completionRate < 0.9);
    const shortfallCount = shortfallEntries.length;
    if (shortfallCount >= 2 && shortfallCount / total >= 0.5) {
      const severity: PatternSeverity = shortfallCount >= 3 ? "warning" : "info";
      patterns.push({
        patternType: "rep_shortfall" as DetectedPatternType,
        exerciseName,
        severity,
        evidence: {
          sessionsAnalyzed: totalSessions,
          occurrences: shortfallCount,
          sessionIds: shortfallEntries.map((e) => e.sessionId),
        },
        summary: `${exerciseName}: missed rep target in ${shortfallCount} of ${total} recent sessions`,
      });
    }

    // consistent_completion: completionRate >= 1.0
    const completionEntries = entries.filter((e) => e.completionRate >= 1.0);
    const completionCount = completionEntries.length;
    if (completionCount >= 2 && completionCount / total >= 0.5) {
      patterns.push({
        patternType: "consistent_completion" as DetectedPatternType,
        exerciseName,
        severity: "info" as PatternSeverity,
        evidence: {
          sessionsAnalyzed: totalSessions,
          occurrences: completionCount,
          sessionIds: completionEntries.map((e) => e.sessionId),
        },
        summary: `${exerciseName}: completed rep target in ${completionCount} of ${total} recent sessions`,
      });
    }

    // pain_recurrence: painReported === true
    const painEntries = entries.filter((e) => e.painReported);
    const painCount = painEntries.length;
    if (painCount >= 2) {
      patterns.push({
        patternType: "pain_recurrence" as DetectedPatternType,
        exerciseName,
        severity: "action_needed" as PatternSeverity,
        evidence: {
          sessionsAnalyzed: totalSessions,
          occurrences: painCount,
          sessionIds: painEntries.map((e) => e.sessionId),
        },
        summary: `${exerciseName}: pain reported in ${painCount} of ${total} recent sessions`,
      });
    }
  }

  return patterns;
}
