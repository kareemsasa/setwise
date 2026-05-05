import type { FastifyPluginAsync } from "fastify";
import {
  sessionByIdParamsSchema,
  createSetLogBodySchema,
  completeSessionBodySchema,
} from "@setwise/validation";
import {
  db,
  eq,
  and,
  asc,
  workoutSessions,
  setLogs,
  scheduledWorkouts,
  exercisePrescriptions,
  workoutTemplates,
  attendanceEvents,
} from "@setwise/db";
import { computeSessionSummary } from "@setwise/training-core";

export const workoutSessionRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/workout-sessions/:sessionId/set-logs
  app.post("/:sessionId/set-logs", async (request, reply) => {
    const paramsParsed = sessionByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const bodyParsed = createSetLogBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: bodyParsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId } = paramsParsed.data;
    const {
      exercisePrescriptionId,
      setNumber,
      repsCompleted,
      weightKg,
      rpe,
      painReported,
      notes,
    } = bodyParsed.data;

    // Fetch session
    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return reply.status(404).send({ error: "Workout session not found" });
    }

    if (session.status !== "in_progress") {
      return reply.status(409).send({ error: "Session is not in progress" });
    }

    // Fetch exercise prescription
    const [prescription] = await db
      .select()
      .from(exercisePrescriptions)
      .where(eq(exercisePrescriptions.id, exercisePrescriptionId))
      .limit(1);

    if (!prescription) {
      return reply
        .status(404)
        .send({ error: "Exercise prescription not found" });
    }

    // Verify prescription belongs to session's scheduled workout's template
    if (session.scheduledWorkoutId) {
      const [sw] = await db
        .select()
        .from(scheduledWorkouts)
        .where(eq(scheduledWorkouts.id, session.scheduledWorkoutId))
        .limit(1);

      if (sw && prescription.workoutTemplateId !== sw.workoutTemplateId) {
        return reply.status(409).send({
          error:
            "Exercise prescription does not belong to this workout's template",
        });
      }
    }

    // Insert set log with FK and denormalized snapshots
    const [log] = await db
      .insert(setLogs)
      .values({
        sessionId,
        exercisePrescriptionId,
        exerciseName: prescription.exerciseName,
        setNumber,
        prescribedReps: prescription.repMax,
        actualReps: repsCompleted,
        prescribedWeightKg: prescription.weightKg
          ? String(prescription.weightKg)
          : null,
        actualWeightKg: weightKg != null ? String(weightKg) : null,
        rpeActual: rpe != null ? String(rpe) : null,
        painReported: painReported ?? false,
        painNotes: painReported ? (notes ?? null) : null,
        skipped: false,
      })
      .returning();

    return reply.status(201).send({
      ...log,
      prescribedWeightKg: log.prescribedWeightKg
        ? Number(log.prescribedWeightKg)
        : null,
      actualWeightKg: log.actualWeightKg ? Number(log.actualWeightKg) : null,
      rpeActual: log.rpeActual ? Number(log.rpeActual) : null,
    });
  });

  // POST /api/workout-sessions/:sessionId/complete
  app.post("/:sessionId/complete", async (request, reply) => {
    const paramsParsed = sessionByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const bodyParsed = completeSessionBodySchema.safeParse(
      request.body ?? {},
    );
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: bodyParsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId } = paramsParsed.data;
    const { notes } = bodyParsed.data;

    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return reply.status(404).send({ error: "Workout session not found" });
    }

    if (session.status === "completed") {
      return reply.status(200).send({
        session,
        alreadyCompleted: true,
      });
    }

    const now = new Date();

    // Update session
    const [updated] = await db
      .update(workoutSessions)
      .set({
        status: "completed",
        completedAt: now,
        notes: notes ?? session.notes,
      })
      .where(eq(workoutSessions.id, sessionId))
      .returning();

    // Mark scheduled workout as completed
    if (session.scheduledWorkoutId) {
      await db
        .update(scheduledWorkouts)
        .set({ status: "completed" })
        .where(eq(scheduledWorkouts.id, session.scheduledWorkoutId));

      // Insert clock_out attendance event
      await db.insert(attendanceEvents).values({
        scheduledWorkoutId: session.scheduledWorkoutId,
        sessionId,
        eventType: "clock_out",
        scheduledTime: null,
        actualTime: now,
        varianceMinutes: null,
      });
    }

    return reply.status(200).send({
      session: updated,
      alreadyCompleted: false,
    });
  });

  // GET /api/workout-sessions/:sessionId
  app.get("/:sessionId", async (request, reply) => {
    const paramsParsed = sessionByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId } = paramsParsed.data;

    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return reply.status(404).send({ error: "Workout session not found" });
    }

    // Fetch planned exercises via scheduled workout's template
    let plannedExercises: Array<Record<string, unknown>> = [];
    if (session.scheduledWorkoutId) {
      const [sw] = await db
        .select()
        .from(scheduledWorkouts)
        .where(eq(scheduledWorkouts.id, session.scheduledWorkoutId))
        .limit(1);

      if (sw) {
        const exercises = await db
          .select()
          .from(exercisePrescriptions)
          .where(
            eq(exercisePrescriptions.workoutTemplateId, sw.workoutTemplateId),
          )
          .orderBy(asc(exercisePrescriptions.orderInWorkout));

        plannedExercises = exercises.map((ex) => ({
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
        }));
      }
    }

    // Fetch set logs
    const logs = await db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionId, sessionId));

    return reply.status(200).send({
      session,
      plannedExercises,
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

  // GET /api/workout-sessions/:sessionId/summary
  app.get("/:sessionId/summary", async (request, reply) => {
    const paramsParsed = sessionByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId } = paramsParsed.data;

    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return reply.status(404).send({ error: "Workout session not found" });
    }

    // Resolve prescriptions via scheduled workout's template
    const prescriptionRows = session.scheduledWorkoutId
      ? await (async () => {
          const [sw] = await db
            .select()
            .from(scheduledWorkouts)
            .where(eq(scheduledWorkouts.id, session.scheduledWorkoutId!))
            .limit(1);

          if (!sw) return [];

          return db
            .select()
            .from(exercisePrescriptions)
            .where(
              eq(
                exercisePrescriptions.workoutTemplateId,
                sw.workoutTemplateId,
              ),
            )
            .orderBy(asc(exercisePrescriptions.orderInWorkout));
        })()
      : [];

    // Fetch all set logs for this session, ordered by id (insertion order)
    const logRows = await db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionId, sessionId))
      .orderBy(asc(setLogs.id));

    // Map DB rows to domain types for the pure function
    const prescriptions = prescriptionRows.map((p) => ({
      id: p.id,
      workoutTemplateId: p.workoutTemplateId,
      exerciseName: p.exerciseName,
      orderInWorkout: p.orderInWorkout,
      sets: p.sets,
      repMin: p.repMin,
      repMax: p.repMax,
      weightKg: p.weightKg ?? null,
      rpeTarget: p.rpeTarget,
      restSeconds: p.restSeconds,
      notes: p.notes,
    }));

    const mappedLogs = logRows.map((log) => ({
      id: log.id,
      sessionId: log.sessionId,
      exercisePrescriptionId: log.exercisePrescriptionId,
      exerciseName: log.exerciseName,
      setNumber: log.setNumber,
      prescribedReps: log.prescribedReps,
      actualReps: log.actualReps,
      prescribedWeightKg: log.prescribedWeightKg
        ? Number(log.prescribedWeightKg)
        : null,
      actualWeightKg: log.actualWeightKg ? Number(log.actualWeightKg) : null,
      rpeActual: log.rpeActual ? Number(log.rpeActual) : null,
      painReported: log.painReported,
      painNotes: log.painNotes,
      skipped: log.skipped,
      skipReason: log.skipReason,
    }));

    const summary = computeSessionSummary({
      sessionId,
      sessionStatus: session.status,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      prescriptions,
      setLogs: mappedLogs,
    });

    return reply.status(200).send(summary);
  });
};
