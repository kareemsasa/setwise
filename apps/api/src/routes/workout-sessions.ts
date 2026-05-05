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
};
