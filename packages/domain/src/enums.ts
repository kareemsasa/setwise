// --- Lifecycle and status enums ---

export const ConsultationStatus = {
  InProgress: "in_progress",
  Completed: "completed",
  Abandoned: "abandoned",
} as const;
export type ConsultationStatus =
  (typeof ConsultationStatus)[keyof typeof ConsultationStatus];

export const AssessmentStatus = {
  Pending: "pending",
  Processing: "processing",
  Completed: "completed",
  Failed: "failed",
} as const;
export type AssessmentStatus =
  (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

export const PlanStatus = {
  Draft: "draft",
  Approved: "approved",
  Active: "active",
  Archived: "archived",
} as const;
export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus];

export const PlanVersionStatus = {
  Draft: "draft",
  Approved: "approved",
  Superseded: "superseded",
  Rejected: "rejected",
} as const;
export type PlanVersionStatus =
  (typeof PlanVersionStatus)[keyof typeof PlanVersionStatus];

export const ScheduledWorkoutStatus = {
  Upcoming: "upcoming",
  Completed: "completed",
  Missed: "missed",
  Skipped: "skipped",
} as const;
export type ScheduledWorkoutStatus =
  (typeof ScheduledWorkoutStatus)[keyof typeof ScheduledWorkoutStatus];

export const WorkoutSessionStatus = {
  InProgress: "in_progress",
  Completed: "completed",
  Abandoned: "abandoned",
} as const;
export type WorkoutSessionStatus =
  (typeof WorkoutSessionStatus)[keyof typeof WorkoutSessionStatus];

export const AttendanceEventType = {
  ClockIn: "clock_in",
  ClockOut: "clock_out",
  Missed: "missed",
  Skipped: "skipped",
} as const;
export type AttendanceEventType =
  (typeof AttendanceEventType)[keyof typeof AttendanceEventType];

// --- Domain value enums ---

export const BiologicalSex = {
  Male: "male",
  Female: "female",
} as const;
export type BiologicalSex =
  (typeof BiologicalSex)[keyof typeof BiologicalSex];

export const ExperienceLevel = {
  Beginner: "beginner",
  Intermediate: "intermediate",
  Advanced: "advanced",
} as const;
export type ExperienceLevel =
  (typeof ExperienceLevel)[keyof typeof ExperienceLevel];

export const PrimaryGoal = {
  Strength: "strength",
  Hypertrophy: "hypertrophy",
  Endurance: "endurance",
  GeneralFitness: "general_fitness",
  SportSpecific: "sport_specific",
} as const;
export type PrimaryGoal = (typeof PrimaryGoal)[keyof typeof PrimaryGoal];

export const InjurySeverity = {
  Mild: "mild",
  Moderate: "moderate",
  Severe: "severe",
} as const;
export type InjurySeverity =
  (typeof InjurySeverity)[keyof typeof InjurySeverity];

export const TrainingLocation = {
  HomeGym: "home_gym",
  CommercialGym: "commercial_gym",
  Outdoor: "outdoor",
  Mixed: "mixed",
  Other: "other",
} as const;
export type TrainingLocation =
  (typeof TrainingLocation)[keyof typeof TrainingLocation];

export const TimePreference = {
  Morning: "morning",
  Afternoon: "afternoon",
  Evening: "evening",
  NoPreference: "no_preference",
} as const;
export type TimePreference =
  (typeof TimePreference)[keyof typeof TimePreference];

// --- Progression/analysis enums ---

export const PatternType = {
  RepShortfall: "rep_shortfall",
  Stall: "stall",
  ScheduleDrift: "schedule_drift",
  PainRecurrence: "pain_recurrence",
  ConsistencyDrop: "consistency_drop",
} as const;
export type PatternType = (typeof PatternType)[keyof typeof PatternType];

export const PatternSeverity = {
  Info: "info",
  Warning: "warning",
  ActionNeeded: "action_needed",
} as const;
export type PatternSeverity =
  (typeof PatternSeverity)[keyof typeof PatternSeverity];

export const RecommendationType = {
  ReduceWeight: "reduce_weight",
  ReduceVolume: "reduce_volume",
  IncreaseWeight: "increase_weight",
  DeloadWeek: "deload_week",
  Reschedule: "reschedule",
  SwapExercise: "swap_exercise",
  AdjustReps: "adjust_reps",
} as const;
export type RecommendationType =
  (typeof RecommendationType)[keyof typeof RecommendationType];

export const RecommendationStatus = {
  Pending: "pending",
  Accepted: "accepted",
  Dismissed: "dismissed",
  Expired: "expired",
} as const;
export type RecommendationStatus =
  (typeof RecommendationStatus)[keyof typeof RecommendationStatus];
