import { z } from "zod";

export const injuryRestrictionSchema = z.object({
  area: z.string().min(1),
  description: z.string(),
  severity: z.enum(["mild", "moderate", "severe"]),
  affectedMovements: z.array(z.string()),
  isDiagnosed: z.boolean(),
  professionalConsulted: z.boolean(),
  notes: z.string(),
});

export const workingWeightSchema = z.object({
  exercise: z.string().min(1),
  weightKg: z.number().nonnegative(),
  reps: z.number().int().positive(),
  notes: z.string(),
});

export const safetyFlagSchema = z.object({
  flag: z.string().min(1),
  recommendation: z.string().min(1),
});

export const structuredIntakeOutputSchema = z.object({
  consultationId: z.string().uuid(),
  userId: z.string().uuid(),
  completedAt: z.string().datetime(),

  injuriesAndRestrictions: z.array(injuryRestrictionSchema),

  equipment: z.object({
    location: z.enum([
      "home_gym",
      "commercial_gym",
      "outdoor",
      "mixed",
      "other",
    ]),
    locationNotes: z.string(),
    availableEquipment: z.array(z.string()),
    equipmentLimitations: z.string(),
  }),

  goals: z.object({
    primaryGoal: z.enum([
      "strength",
      "hypertrophy",
      "endurance",
      "general_fitness",
      "sport_specific",
    ]),
    secondaryGoals: z.array(z.string()),
    specificTargets: z.array(z.string()),
    timeline: z.string(),
  }),

  schedule: z.object({
    daysPerWeek: z.number().int().min(1).max(7),
    availableDays: z.array(
      z.enum([
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ]),
    ),
    preferredTime: z.enum(["morning", "afternoon", "evening", "no_preference"]),
    sessionLengthMinutes: z.number().int().positive(),
    upcomingDisruptions: z.string(),
  }),

  trainingHistory: z.object({
    experienceDuration: z.string(),
    recentProgram: z.string(),
    familiarExercises: z.array(z.string()),
    recentWorkingWeights: z.array(workingWeightSchema),
    pastObservations: z.string(),
  }),

  preferences: z.object({
    likedExercises: z.array(z.string()),
    dislikedExercises: z.array(z.string()),
    trainingStyle: z.string(),
    cardioPreference: z.string(),
    otherNotes: z.string(),
  }),

  safetyFlags: z.array(safetyFlagSchema),
  agentNotes: z.string(),
});

export type StructuredIntakeOutput = z.infer<
  typeof structuredIntakeOutputSchema
>;

export const createConsultationSchema = structuredIntakeOutputSchema.omit({
  consultationId: true,
  userId: true,
  completedAt: true,
});

export type CreateConsultationInput = z.infer<
  typeof createConsultationSchema
>;
