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
  workoutSessions,
  setLogs,
  attendanceEvents,
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

  // POST /api/scheduled-workouts/:scheduledWorkoutId/start
  app.post("/:scheduledWorkoutId/start", async (request, reply) => {
    const parsed = scheduledWorkoutByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { scheduledWorkoutId } = parsed.data;

    // Fetch scheduled workout
    const [scheduledWorkout] = await db
      .select()
      .from(scheduledWorkouts)
      .where(eq(scheduledWorkouts.id, scheduledWorkoutId))
      .limit(1);

    if (!scheduledWorkout) {
      return reply.status(404).send({ error: "Scheduled workout not found" });
    }

    // Check for existing session
    const [existingSession] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.scheduledWorkoutId, scheduledWorkoutId))
      .limit(1);

    if (existingSession) {
      if (existingSession.status === "completed") {
        return reply
          .status(409)
          .send({ error: "Scheduled workout already has a completed session" });
      }
      // Return existing in_progress session
      return reply.status(200).send({
        session: existingSession,
        created: false,
      });
    }

    // Create new session
    const [session] = await db
      .insert(workoutSessions)
      .values({
        scheduledWorkoutId,
        userId: scheduledWorkout.userId,
        planVersionId: scheduledWorkout.planVersionId,
        status: "in_progress",
      })
      .returning();

    // Create clock_in attendance event
    const now = new Date();
    const hasScheduledTime = scheduledWorkout.scheduledTime !== null;
    let scheduledTimestamp: Date | null = null;
    let varianceMinutes: number | null = null;

    if (hasScheduledTime) {
      // Combine scheduledDate + scheduledTime into a timestamp
      scheduledTimestamp = new Date(
        `${scheduledWorkout.scheduledDate}T${scheduledWorkout.scheduledTime}`,
      );
      varianceMinutes = Math.round(
        (now.getTime() - scheduledTimestamp.getTime()) / 60000,
      );
    }

    await db.insert(attendanceEvents).values({
      scheduledWorkoutId,
      sessionId: session.id,
      eventType: "clock_in",
      scheduledTime: scheduledTimestamp,
      actualTime: now,
      varianceMinutes,
    });

    return reply.status(201).send({
      session,
      created: true,
    });
  });

  // GET /api/scheduled-workouts/:scheduledWorkoutId/session
  app.get("/:scheduledWorkoutId/session", async (request, reply) => {
    const parsed = scheduledWorkoutByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { scheduledWorkoutId } = parsed.data;

    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.scheduledWorkoutId, scheduledWorkoutId))
      .limit(1);

    if (!session) {
      return reply.status(404).send({ error: "No session found for this scheduled workout" });
    }

    // Fetch set logs for the session
    const logs = await db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionId, session.id));

    // Fetch planned exercises via the scheduled workout's template
    const [scheduledWorkout] = await db
      .select()
      .from(scheduledWorkouts)
      .where(eq(scheduledWorkouts.id, scheduledWorkoutId))
      .limit(1);

    const plannedExercises = scheduledWorkout
      ? await db
          .select()
          .from(exercisePrescriptions)
          .where(
            eq(
              exercisePrescriptions.workoutTemplateId,
              scheduledWorkout.workoutTemplateId,
            ),
          )
          .orderBy(asc(exercisePrescriptions.orderInWorkout))
      : [];

    return reply.status(200).send({
      session,
      plannedExercises: plannedExercises.map((ex) => ({
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
      setLogs: logs.map((log) => ({
        ...log,
        prescribedWeightKg: log.prescribedWeightKg
          ? Number(log.prescribedWeightKg)
          : null,
        actualWeightKg: log.actualWeightKg
          ? Number(log.actualWeightKg)
          : null,
        rpeActual: log.rpeActual ? Number(log.rpeActual) : null,
      })),
    });
  });
};
