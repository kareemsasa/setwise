import type { FastifyPluginAsync } from "fastify";
import {
  scheduledWorkoutByIdParamsSchema,
  scheduledWorkoutQuerySchema,
} from "@setwise/validation";
import {
  db,
  eq,
  and,
  asc,
  gte,
  lte,
  scheduledWorkouts,
  workoutTemplates,
  exercisePrescriptions,
} from "@setwise/db";

export const scheduledWorkoutRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/scheduled-workouts
  app.get("/", async (request, reply) => {
    const queryParsed = scheduledWorkoutQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: queryParsed.error.flatten().fieldErrors,
      });
    }

    const { start, end } = queryParsed.data;

    const conditions = [];
    if (start) {
      conditions.push(gte(scheduledWorkouts.scheduledDate, start));
    }
    if (end) {
      conditions.push(lte(scheduledWorkouts.scheduledDate, end));
    }

    const rows = await db
      .select({
        id: scheduledWorkouts.id,
        userId: scheduledWorkouts.userId,
        planVersionId: scheduledWorkouts.planVersionId,
        scheduledDate: scheduledWorkouts.scheduledDate,
        scheduledTime: scheduledWorkouts.scheduledTime,
        status: scheduledWorkouts.status,
        templateId: workoutTemplates.id,
        templateName: workoutTemplates.name,
        templateDayOfWeek: workoutTemplates.dayOfWeek,
        templateDuration: workoutTemplates.estimatedDurationMinutes,
      })
      .from(scheduledWorkouts)
      .innerJoin(
        workoutTemplates,
        eq(scheduledWorkouts.workoutTemplateId, workoutTemplates.id),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(scheduledWorkouts.scheduledDate));

    const result = rows.map((w) => ({
      id: w.id,
      profileId: w.userId,
      planVersionId: w.planVersionId,
      scheduledDate: w.scheduledDate,
      scheduledTime: w.scheduledTime,
      status: w.status,
      template: {
        id: w.templateId,
        name: w.templateName,
        dayOfWeek: w.templateDayOfWeek,
        estimatedDurationMinutes: w.templateDuration,
      },
    }));

    return reply.status(200).send(result);
  });

  // GET /api/scheduled-workouts/:scheduledWorkoutId
  app.get("/:scheduledWorkoutId", async (request, reply) => {
    const parsed = scheduledWorkoutByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { scheduledWorkoutId } = parsed.data;

    // Fetch workout with template
    const [row] = await db
      .select({
        id: scheduledWorkouts.id,
        userId: scheduledWorkouts.userId,
        planVersionId: scheduledWorkouts.planVersionId,
        scheduledDate: scheduledWorkouts.scheduledDate,
        scheduledTime: scheduledWorkouts.scheduledTime,
        status: scheduledWorkouts.status,
        workoutTemplateId: scheduledWorkouts.workoutTemplateId,
        templateId: workoutTemplates.id,
        templateName: workoutTemplates.name,
        templateDayOfWeek: workoutTemplates.dayOfWeek,
        templateDuration: workoutTemplates.estimatedDurationMinutes,
      })
      .from(scheduledWorkouts)
      .innerJoin(
        workoutTemplates,
        eq(scheduledWorkouts.workoutTemplateId, workoutTemplates.id),
      )
      .where(eq(scheduledWorkouts.id, scheduledWorkoutId))
      .limit(1);

    if (!row) {
      return reply
        .status(404)
        .send({ error: "Scheduled workout not found" });
    }

    // Fetch exercises for this template
    const exercises = await db
      .select()
      .from(exercisePrescriptions)
      .where(eq(exercisePrescriptions.workoutTemplateId, row.templateId))
      .orderBy(asc(exercisePrescriptions.orderInWorkout));

    return reply.status(200).send({
      id: row.id,
      profileId: row.userId,
      planVersionId: row.planVersionId,
      scheduledDate: row.scheduledDate,
      scheduledTime: row.scheduledTime,
      status: row.status,
      template: {
        id: row.templateId,
        name: row.templateName,
        dayOfWeek: row.templateDayOfWeek,
        estimatedDurationMinutes: row.templateDuration,
        exercises: exercises.map((ex) => ({
          id: ex.id,
          exerciseName: ex.exerciseName,
          orderInWorkout: ex.orderInWorkout,
          sets: ex.sets,
          repMin: ex.repMin,
          repMax: ex.repMax,
          weightKg: ex.weightKg ? Number(ex.weightKg) : null,
          rpeTarget: ex.rpeTarget,
          restSeconds: ex.restSeconds,
          notes: ex.notes,
        })),
      },
    });
  });
};
