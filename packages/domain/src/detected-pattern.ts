import type { PatternSeverity } from "./enums.js";

export type DetectedPatternType =
  | "rep_shortfall"
  | "consistent_completion"
  | "pain_recurrence";

export interface PatternEvidence {
  sessionsAnalyzed: number;
  occurrences: number;
  sessionIds: string[];
}

export interface DetectedPattern {
  patternType: DetectedPatternType;
  exerciseName: string;
  severity: PatternSeverity;
  evidence: PatternEvidence;
  summary: string;
}
