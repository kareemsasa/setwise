import type { FastifyPluginAsync } from "fastify";
import {
  db,
  eq,
  and,
  desc,
  asc,
  userProfiles,
  workoutSessions,
  scheduledWorkouts,
  exercisePrescriptions,
  setLogs,
} from "@setwise/db";
import {
  computeSessionSummary,
  detectProgressionPatterns,
} from "@setwise/training-core";
import type { SessionExerciseRecord } from "@setwise/training-core";
import {
  progressionPatternsParamsSchema,
  progressionPatternsQuerySchema,
} from "@setwise/validation";

export const profileProgressionPatternRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/profiles/:profileId/progression-patterns
  app.get("/", async (request, reply) => {
    const paramsParsed = progressionPatternsParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const queryParsed = progressionPatternsQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: queryParsed.error.flatten().fieldErrors,
      });
    }

    const { profileId } = paramsParsed.data;
    const { exerciseName, limit } = queryParsed.data;

    // Verify profile exists
    const [profile] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, profileId))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({ error: "Profile not found" });
    }

    // Fetch recent completed sessions for this profile
    const sessions = await db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, profileId),
          eq(workoutSessions.status, "completed"),
        ),
      )
      .orderBy(desc(workoutSessions.completedAt))
      .limit(limit);

    if (sessions.length === 0) {
      return reply.status(200).send([]);
    }

    // Build session exercise records by computing summaries
    const records: SessionExerciseRecord[] = [];

    for (const session of sessions) {
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

      const logRows = await db
        .select()
        .from(setLogs)
        .where(eq(setLogs.sessionId, session.id))
        .orderBy(asc(setLogs.id));

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
        sessionId: session.id,
        sessionStatus: session.status,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null,
        prescriptions,
        setLogs: mappedLogs,
      });

      records.push({
        sessionId: session.id,
        exercises: summary.exercises,
      });
    }

    let patterns = detectProgressionPatterns(records);

    // Filter by exercise name if provided
    if (exerciseName) {
      patterns = patterns.filter((p) => p.exerciseName === exerciseName);
    }

    return reply.status(200).send(patterns);
  });
};
