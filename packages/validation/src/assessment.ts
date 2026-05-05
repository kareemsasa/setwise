import { z } from "zod";

export const assessmentParamsSchema = z.object({
  consultationId: z.string().uuid(),
});

export const assessmentByIdParamsSchema = z.object({
  assessmentId: z.string().uuid(),
});
