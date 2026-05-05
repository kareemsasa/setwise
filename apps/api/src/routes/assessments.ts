import type { FastifyPluginAsync } from "fastify";
import { assessmentByIdParamsSchema } from "@setwise/validation";
import { db, eq, assessments } from "@setwise/db";

export const assessmentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:assessmentId", async (request, reply) => {
    const parsed = assessmentByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { assessmentId } = parsed.data;

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return reply.status(404).send({ error: "Assessment not found" });
    }

    return reply.status(200).send({
      id: assessment.id,
      consultationId: assessment.consultationId,
      status: assessment.status,
      inputSnapshot: assessment.inputSnapshot,
      result: assessment.result,
      createdAt: assessment.createdAt,
      completedAt: assessment.completedAt,
    });
  });
};
