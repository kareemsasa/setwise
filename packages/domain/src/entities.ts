import type {
  AssessmentStatus,
  AttendanceEventType,
  BiologicalSex,
  ConsultationStatus,
  ExperienceLevel,
  PatternSeverity,
  PatternType,
  PlanStatus,
  PlanVersionStatus,
  RecommendationStatus,
  RecommendationType,
  ScheduledWorkoutStatus,
  WorkoutSessionStatus,
} from "./enums.js";

// --- Core entities ---

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  heightCm: number;
  weightKg: number;
  dateOfBirth: string; // ISO date
  biologicalSex: BiologicalSex;
  experienceLevel: ExperienceLevel;
  createdAt: string;
  updatedAt: string;
}

export interface Consultation {
  id: string;
  userId: string;
  status: ConsultationStatus;
  startedAt: string;
  completedAt: string | null;
  transcript: unknown; // JSON conversation history
  structuredOutput: StructuredIntakeOutput | null;
}

export interface Assessment {
  id: string;
  consultationId: string;
  status: AssessmentStatus;
  inputSnapshot: StructuredIntakeOutput;
  result: unknown | null; // generated plan structure
  createdAt: string;
  completedAt: string | null;
}

export interface TrainingPlan {
  id: string;
  userId: string;
  assessmentId: string;
  name: string;
  status: PlanStatus;
  createdAt: string;
}

export interface PlanVersion {
  id: string;
  planId: string;
  versionNumber: number;
  status: PlanVersionStatus;
  structure: unknown; // full plan content JSON
  rejectionFeedback: string | null;
  createdAt: string;
}

export interface WorkoutTemplate {
  id: string;
  planVersionId: string;
  name: string;
  dayOfWeek: number | null; // 0=Monday, 6=Sunday
  orderInPlan: number;
  estimatedDurationMinutes: number;
}

export interface ExercisePrescription {
  id: string;
  workoutTemplateId: string;
  exerciseName: string;
  orderInWorkout: number;
  sets: number;
  repMin: number;
  repMax: number;
  weightKg: number | null;
  rpeTarget: number | null;
  restSeconds: number;
  notes: string | null;
}

// --- Workout execution ---

export interface ScheduledWorkout {
  id: string;
  userId: string;
  workoutTemplateId: string;
  planVersionId: string;
  scheduledDate: string; // ISO date
  scheduledTime: string | null; // HH:MM
  status: ScheduledWorkoutStatus;
}

export interface WorkoutSession {
  id: string;
  scheduledWorkoutId: string | null;
  userId: string;
  planVersionId: string;
  startedAt: string;
  completedAt: string | null;
  status: WorkoutSessionStatus;
  notes: string | null;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exercisePrescriptionId: string | null;
  exerciseName: string;
  setNumber: number;
  prescribedReps: number;
  actualReps: number;
  prescribedWeightKg: number | null;
  actualWeightKg: number | null;
  rpeActual: number | null;
  painReported: boolean;
  painNotes: string | null;
  skipped: boolean;
  skipReason: string | null;
}

// --- Session performance summary ---

export type ExerciseCompletionStatus = "completed" | "partial" | "not_started";

export interface SetPerformance {
  setNumber: number;
  prescribedReps: number;
  actualReps: number;
  prescribedWeightKg: number | null;
  actualWeightKg: number | null;
  rpeActual: number | null;
  painReported: boolean;
  skipped: boolean;
  logged: boolean;
}

export interface ExercisePerformanceSummary {
  exercisePrescriptionId: string;
  exerciseName: string;
  prescribedSets: number;
  loggedSets: number;
  prescribedRepsPerSet: number;
  completedReps: number;
  totalPrescribedReps: number;
  completionRate: number;
  status: ExerciseCompletionStatus;
  painReported: boolean;
  setBreakdown: SetPerformance[];
}

export interface SessionPerformanceSummary {
  sessionId: string;
  sessionStatus: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
  totalExercises: number;
  completedExercises: number;
  totalPrescribedSets: number;
  totalLoggedSets: number;
  totalPrescribedReps: number;
  totalCompletedReps: number;
  completionRate: number;
  painReported: boolean;
  exercises: ExercisePerformanceSummary[];
}

export interface AttendanceEvent {
  id: string;
  scheduledWorkoutId: string;
  sessionId: string | null;
  eventType: AttendanceEventType;
  scheduledTime: string | null;
  actualTime: string | null;
  varianceMinutes: number | null;
  recordedAt: string;
}

// --- Analysis ---

export interface ProgressionPattern {
  id: string;
  userId: string;
  patternType: PatternType;
  exerciseName: string | null;
  description: string;
  evidence: unknown; // JSON
  severity: PatternSeverity;
  detectedAt: string;
  acknowledged: boolean;
}

export interface AdjustmentRecommendation {
  id: string;
  userId: string;
  patternId: string | null;
  recommendationType: RecommendationType;
  targetExercise: string | null;
  description: string;
  proposedChange: unknown; // JSON
  status: RecommendationStatus;
  createdAt: string;
  resolvedAt: string | null;
}

// --- Intake structured output ---

export interface InjuryRestriction {
  area: string;
  description: string;
  severity: "mild" | "moderate" | "severe";
  affectedMovements: string[];
  isDiagnosed: boolean;
  professionalConsulted: boolean;
  notes: string;
}

export interface WorkingWeight {
  exercise: string;
  weightKg: number;
  reps: number;
  notes: string;
}

export interface SafetyFlag {
  flag: string;
  recommendation: string;
}

export interface StructuredIntakeOutput {
  consultationId: string;
  userId: string;
  completedAt: string;

  injuriesAndRestrictions: InjuryRestriction[];

  equipment: {
    location: string;
    locationNotes: string;
    availableEquipment: string[];
    equipmentLimitations: string;
  };

  goals: {
    primaryGoal: string;
    secondaryGoals: string[];
    specificTargets: string[];
    timeline: string;
  };

  schedule: {
    daysPerWeek: number;
    availableDays: string[];
    preferredTime: string;
    sessionLengthMinutes: number;
    upcomingDisruptions: string;
  };

  trainingHistory: {
    experienceDuration: string;
    recentProgram: string;
    familiarExercises: string[];
    recentWorkingWeights: WorkingWeight[];
    pastObservations: string;
  };

  preferences: {
    likedExercises: string[];
    dislikedExercises: string[];
    trainingStyle: string;
    cardioPreference: string;
    otherNotes: string;
  };

  safetyFlags: SafetyFlag[];
  agentNotes: string;
}
