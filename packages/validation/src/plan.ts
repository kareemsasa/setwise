import { z } from "zod";

export const assessmentPlanParamsSchema = z.object({
  assessmentId: z.string().uuid(),
});

export type AssessmentPlanParams = z.infer<typeof assessmentPlanParamsSchema>;

export const planByIdParamsSchema = z.object({
  planId: z.string().uuid(),
});

export type PlanByIdParams = z.infer<typeof planByIdParamsSchema>;

export const rejectPlanBodySchema = z.object({
  feedback: z.string().min(1),
});

export type RejectPlanBody = z.infer<typeof rejectPlanBodySchema>;

export const exercisePrescriptionSchema = z.object({
  exerciseName: z.string().min(1).max(255),
  orderInWorkout: z.number().int().nonnegative(),
  sets: z.number().int().positive(),
  repMin: z.number().int().positive(),
  repMax: z.number().int().positive(),
  weightKg: z.number().nonnegative().nullable(),
  rpeTarget: z.number().min(1).max(10).nullable(),
  restSeconds: z.number().int().nonnegative(),
  notes: z.string().nullable(),
});

export type ExercisePrescriptionInput = z.infer<
  typeof exercisePrescriptionSchema
>;

export const logSetSchema = z.object({
  exerciseName: z.string().min(1),
  setNumber: z.number().int().positive(),
  prescribedReps: z.number().int().nonnegative(),
  actualReps: z.number().int().nonnegative(),
  prescribedWeightKg: z.number().nonnegative().nullable(),
  actualWeightKg: z.number().nonnegative().nullable(),
  rpeActual: z.number().min(1).max(10).nullable(),
  painReported: z.boolean().default(false),
  painNotes: z.string().nullable().default(null),
  skipped: z.boolean().default(false),
  skipReason: z.string().nullable().default(null),
});

export type LogSetInput = z.infer<typeof logSetSchema>;
