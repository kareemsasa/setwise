import type { FastifyPluginAsync } from "fastify";
import {
  planByIdParamsSchema,
  rejectPlanBodySchema,
} from "@setwise/validation";
import { db, eq, desc, trainingPlans, planVersions } from "@setwise/db";

export const planRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/plans/:planId
  app.get("/:planId", async (request, reply) => {
    const parsed = planByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { planId } = parsed.data;

    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const [latestVersion] = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);

    return reply.status(200).send({
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
    });
  });

  // POST /api/plans/:planId/approve
  app.post("/:planId/approve", async (request, reply) => {
    const parsed = planByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { planId } = parsed.data;

    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const [latestVersion] = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);

    if (!latestVersion || latestVersion.status !== "draft") {
      return reply.status(409).send({
        error: "Only draft plans can be approved",
        currentStatus: latestVersion?.status ?? "no version",
      });
    }

    // Update version status to approved
    const [updatedVersion] = await db
      .update(planVersions)
      .set({ status: "approved" })
      .where(eq(planVersions.id, latestVersion.id))
      .returning();

    // Update plan status to approved
    const [updatedPlan] = await db
      .update(trainingPlans)
      .set({ status: "approved" })
      .where(eq(trainingPlans.id, planId))
      .returning();

    return reply.status(200).send({
      id: updatedPlan.id,
      userId: updatedPlan.userId,
      assessmentId: updatedPlan.assessmentId,
      name: updatedPlan.name,
      status: updatedPlan.status,
      createdAt: updatedPlan.createdAt,
      currentVersion: {
        id: updatedVersion.id,
        versionNumber: updatedVersion.versionNumber,
        status: updatedVersion.status,
        structure: updatedVersion.structure,
        rejectionFeedback: updatedVersion.rejectionFeedback,
        createdAt: updatedVersion.createdAt,
      },
    });
  });

  // POST /api/plans/:planId/reject
  app.post("/:planId/reject", async (request, reply) => {
    const paramsParsed = planByIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: paramsParsed.error.flatten().fieldErrors,
      });
    }

    const bodyParsed = rejectPlanBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: bodyParsed.error.flatten().fieldErrors,
      });
    }

    const { planId } = paramsParsed.data;
    const { feedback } = bodyParsed.data;

    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const [latestVersion] = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);

    if (!latestVersion || latestVersion.status !== "draft") {
      return reply.status(409).send({
        error: "Only draft plans can be rejected",
        currentStatus: latestVersion?.status ?? "no version",
      });
    }

    // Update version status to rejected with feedback
    const [updatedVersion] = await db
      .update(planVersions)
      .set({ status: "rejected", rejectionFeedback: feedback })
      .where(eq(planVersions.id, latestVersion.id))
      .returning();

    // Plan status remains draft — awaiting future revision
    return reply.status(200).send({
      id: plan.id,
      userId: plan.userId,
      assessmentId: plan.assessmentId,
      name: plan.name,
      status: plan.status,
      createdAt: plan.createdAt,
      currentVersion: {
        id: updatedVersion.id,
        versionNumber: updatedVersion.versionNumber,
        status: updatedVersion.status,
        structure: updatedVersion.structure,
        rejectionFeedback: updatedVersion.rejectionFeedback,
        createdAt: updatedVersion.createdAt,
      },
    });
  });
};
