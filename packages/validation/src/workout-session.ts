import { z } from "zod";

export const sessionByIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export type SessionByIdParams = z.infer<typeof sessionByIdParamsSchema>;

export const createSetLogBodySchema = z.object({
  exercisePrescriptionId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  repsCompleted: z.number().int().min(0),
  weightKg: z.number().nonnegative().nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  painReported: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
});

export type CreateSetLogBody = z.infer<typeof createSetLogBodySchema>;

export const completeSessionBodySchema = z.object({
  notes: z.string().nullable().optional(),
});

export type CompleteSessionBody = z.infer<typeof completeSessionBodySchema>;
