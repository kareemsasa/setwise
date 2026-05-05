import { z } from "zod";

export const generateScheduledWorkoutsBodySchema = z.object({
  startDate: z.string().date().optional(),
  weeks: z.number().int().min(1).max(12).optional(),
});

export type GenerateScheduledWorkoutsBody = z.infer<
  typeof generateScheduledWorkoutsBodySchema
>;

export const scheduledWorkoutByIdParamsSchema = z.object({
  scheduledWorkoutId: z.string().uuid(),
});

export type ScheduledWorkoutByIdParams = z.infer<
  typeof scheduledWorkoutByIdParamsSchema
>;

export const scheduledWorkoutQuerySchema = z.object({
  start: z.string().date().optional(),
  end: z.string().date().optional(),
});

export type ScheduledWorkoutQuery = z.infer<typeof scheduledWorkoutQuerySchema>;
