import type { FastifyPluginAsync } from "fastify";
import {
  planByIdParamsSchema,
  generateScheduledWorkoutsBodySchema,
} from "@setwise/validation";
import {
  db,
  eq,
  desc,
  asc,
  trainingPlans,
  planVersions,
  workoutTemplates,
  exercisePrescriptions,
  scheduledWorkouts,
} from "@setwise/db";
import type { MockPlanStructure } from "../mock-plan-generator.js";
import { generateMockExercises } from "../mock-exercise-generator.js";
import { dayNameToDbDay, generateScheduledDates } from "../schedule-dates.js";

function formatToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const planScheduledWorkoutRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/plans/:planId/scheduled-workouts
  app.post("/", async (request, reply) => {
    // 1. Validate params
    const paramsParsed = planByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    // 2. Validate optional body
    const bodyParsed = generateScheduledWorkoutsBodySchema.safeParse(
      request.body ?? {},
    );
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: bodyParsed.error.flatten().fieldErrors,
      });
    }

    const { planId } = paramsParsed.data;
    const startDate = bodyParsed.data.startDate ?? formatToday();
    const weeks = bodyParsed.data.weeks ?? 4;

    // 3. Precondition checks

    // Plan exists
    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    // Plan status is approved
    if (plan.status !== "approved") {
      return reply.status(409).send({ error: "Plan is not approved" });
    }

    // Latest PlanVersion status is approved
    const [latestVersion] = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);

    if (!latestVersion || latestVersion.status !== "approved") {
      return reply
        .status(409)
        .send({ error: "Latest plan version is not approved" });
    }

    // No scheduled workouts already exist for this plan version
    const existingWorkouts = await db
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
      .where(eq(scheduledWorkouts.planVersionId, latestVersion.id))
      .orderBy(asc(scheduledWorkouts.scheduledDate));

    if (existingWorkouts.length > 0) {
      return reply.status(409).send({
        error: "Scheduled workouts already exist for this plan version",
        planId,
        planVersionId: latestVersion.id,
        existingCount: existingWorkouts.length,
        scheduledWorkouts: existingWorkouts.map((w) => ({
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
        })),
      });
    }

    // 4. Generate in a single DB transaction
    const structure = latestVersion.structure as MockPlanStructure;
    const sessions = structure.weeklySchedule.sessions;

    const result = await db.transaction(async (tx) => {
      const createdWorkouts: Array<{
        id: string;
        profileId: string;
        planVersionId: string;
        scheduledDate: string;
        scheduledTime: string | null;
        status: string;
        template: {
          id: string;
          name: string;
          dayOfWeek: number | null;
          estimatedDurationMinutes: number;
        };
      }> = [];

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const dbDay = dayNameToDbDay(session.dayOfWeek);

        // Create WorkoutTemplate
        const [template] = await tx
          .insert(workoutTemplates)
          .values({
            planVersionId: latestVersion.id,
            name: session.sessionType,
            dayOfWeek: dbDay ?? null,
            orderInPlan: i + 1,
            estimatedDurationMinutes:
              structure.weeklySchedule.sessionLengthMinutes,
          })
          .returning();

        // Create ExercisePrescriptions
        const exercises = generateMockExercises(session.sessionType);
        for (const exercise of exercises) {
          await tx.insert(exercisePrescriptions).values({
            workoutTemplateId: template.id,
            exerciseName: exercise.exerciseName,
            orderInWorkout: exercise.orderInWorkout,
            sets: exercise.sets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            weightKg: exercise.weightKg,
            rpeTarget: exercise.rpeTarget,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
          });
        }

        // Calculate scheduled dates for this template's day
        if (dbDay !== undefined) {
          const dates = generateScheduledDates(startDate, weeks, [dbDay]);
          for (const d of dates) {
            const [scheduled] = await tx
              .insert(scheduledWorkouts)
              .values({
                userId: plan.userId,
                workoutTemplateId: template.id,
                planVersionId: latestVersion.id,
                scheduledDate: d.date,
                scheduledTime: null,
                status: "upcoming",
              })
              .returning();

            createdWorkouts.push({
              id: scheduled.id,
              profileId: scheduled.userId,
              planVersionId: scheduled.planVersionId,
              scheduledDate: scheduled.scheduledDate,
              scheduledTime: scheduled.scheduledTime,
              status: scheduled.status,
              template: {
                id: template.id,
                name: template.name,
                dayOfWeek: template.dayOfWeek,
                estimatedDurationMinutes: template.estimatedDurationMinutes,
              },
            });
          }
        }
      }

      // Sort by scheduled date
      createdWorkouts.sort((a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate),
      );

      return createdWorkouts;
    });

    // 5. Return 201
    return reply.status(201).send({
      planId,
      planVersionId: latestVersion.id,
      versionNumber: latestVersion.versionNumber,
      generatedCount: result.length,
      scheduledWorkouts: result,
    });
  });
};
