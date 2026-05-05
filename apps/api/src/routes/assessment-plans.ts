import type { FastifyPluginAsync } from "fastify";
import { assessmentPlanParamsSchema } from "@setwise/validation";
import {
  db,
  eq,
  and,
  desc,
  assessments,
  consultations,
  trainingPlans,
  planVersions,
} from "@setwise/db";
import { generateMockPlan } from "../mock-plan-generator.js";
import type { StructuredIntakeOutput } from "@setwise/domain";

export const assessmentPlanRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/assessments/:assessmentId/plans
  app.post("/", async (request, reply) => {
    const parsed = assessmentPlanParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { assessmentId } = parsed.data;

    // Fetch assessment
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return reply.status(404).send({ error: "Assessment not found" });
    }

    // Check assessment status
    if (assessment.status === "processing") {
      return reply.status(409).send({
        error: "Assessment is currently processing",
        status: assessment.status,
      });
    }

    if (assessment.status === "failed") {
      return reply.status(422).send({
        error: "Assessment has failed",
        status: assessment.status,
      });
    }

    // Check for existing draft plan for this assessment
    const existingPlans = await db
      .select({ planId: trainingPlans.id })
      .from(trainingPlans)
      .where(eq(trainingPlans.assessmentId, assessmentId));

    for (const ep of existingPlans) {
      const [draftVersion] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(
          and(
            eq(planVersions.planId, ep.planId),
            eq(planVersions.status, "draft"),
          ),
        )
        .limit(1);

      if (draftVersion) {
        // Return the existing draft plan
        const [existingPlan] = await db
          .select()
          .from(trainingPlans)
          .where(eq(trainingPlans.id, ep.planId))
          .limit(1);

        const [existingVersion] = await db
          .select()
          .from(planVersions)
          .where(eq(planVersions.id, draftVersion.id))
          .limit(1);

        return reply.status(409).send({
          error: "A draft plan already exists for this assessment",
          plan: {
            id: existingPlan.id,
            userId: existingPlan.userId,
            assessmentId: existingPlan.assessmentId,
            name: existingPlan.name,
            status: existingPlan.status,
            createdAt: existingPlan.createdAt,
            currentVersion: {
              id: existingVersion.id,
              versionNumber: existingVersion.versionNumber,
              status: existingVersion.status,
              structure: existingVersion.structure,
              rejectionFeedback: existingVersion.rejectionFeedback,
              createdAt: existingVersion.createdAt,
            },
          },
        });
      }
    }

    // Look up userId via consultation
    const [consultation] = await db
      .select({ userId: consultations.userId })
      .from(consultations)
      .where(eq(consultations.id, assessment.consultationId))
      .limit(1);

    if (!consultation) {
      return reply
        .status(500)
        .send({ error: "Consultation not found for assessment" });
    }

    // Generate mock plan
    const inputSnapshot = assessment.inputSnapshot as StructuredIntakeOutput;
    const structure = generateMockPlan(inputSnapshot);

    const goal = inputSnapshot.goals.primaryGoal || "general fitness";
    const planName = `${goal.replace(/_/g, " ")} plan`;

    // Insert plan and version
    const [plan] = await db
      .insert(trainingPlans)
      .values({
        userId: consultation.userId,
        assessmentId,
        name: planName,
        status: "draft",
      })
      .returning();

    const [version] = await db
      .insert(planVersions)
      .values({
        planId: plan.id,
        versionNumber: 1,
        status: "draft",
        structure,
      })
      .returning();

    return reply.status(201).send({
      id: plan.id,
      userId: plan.userId,
      assessmentId: plan.assessmentId,
      name: plan.name,
      status: plan.status,
      createdAt: plan.createdAt,
      currentVersion: {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        structure: version.structure,
        rejectionFeedback: version.rejectionFeedback,
        createdAt: version.createdAt,
      },
    });
  });

  // GET /api/assessments/:assessmentId/plans
  app.get("/", async (request, reply) => {
    const parsed = assessmentPlanParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { assessmentId } = parsed.data;

    // Verify assessment exists
    const [assessment] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return reply.status(404).send({ error: "Assessment not found" });
    }

    // Fetch plans for this assessment
    const plans = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.assessmentId, assessmentId))
      .orderBy(desc(trainingPlans.createdAt));

    const result = await Promise.all(
      plans.map(async (plan) => {
        const [latestVersion] = await db
          .select()
          .from(planVersions)
          .where(eq(planVersions.planId, plan.id))
          .orderBy(desc(planVersions.versionNumber))
          .limit(1);

        return {
          id: plan.id,
          userId: plan.userId,
          assessmentId: plan.assessmentId,
          name: plan.name,
          status: plan.status,
          createdAt: plan.createdAt,
          currentVersion: latestVersion
            ? {
                id: latestVersion.id,
                versionNumber: latestVersion.versionNumber,
                status: latestVersion.status,
                structure: latestVersion.structure,
                rejectionFeedback: latestVersion.rejectionFeedback,
                createdAt: latestVersion.createdAt,
              }
            : null,
        };
      }),
    );

    return reply.status(200).send(result);
  });
};
