import { z } from "zod";

export const progressionPatternsParamsSchema = z.object({
  profileId: z.string().uuid(),
});

export type ProgressionPatternsParams = z.infer<typeof progressionPatternsParamsSchema>;

export const progressionPatternsQuerySchema = z.object({
  exerciseName: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ProgressionPatternsQuery = z.infer<typeof progressionPatternsQuerySchema>;
