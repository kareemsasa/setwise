import type { FastifyPluginAsync } from "fastify";
import { assessmentParamsSchema } from "@setwise/validation";
import {
  db,
  eq,
  and,
  inArray,
  desc,
  consultations,
  assessments,
} from "@setwise/db";

export const consultationAssessmentRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parsed = assessmentParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { consultationId } = parsed.data;

    const [consultation] = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, consultationId))
      .limit(1);

    if (!consultation) {
      return reply.status(404).send({ error: "Consultation not found" });
    }

    if (consultation.status !== "completed") {
      return reply.status(422).send({
        error: "Consultation is not completed",
        status: consultation.status,
      });
    }

    const [existing] = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.consultationId, consultationId),
          inArray(assessments.status, ["pending", "processing"]),
        ),
      )
      .limit(1);

    if (existing) {
      return reply.status(409).send({
        error: "An active assessment already exists for this consultation",
        assessment: {
          id: existing.id,
          consultationId: existing.consultationId,
          status: existing.status,
          inputSnapshot: existing.inputSnapshot,
          result: existing.result,
          createdAt: existing.createdAt,
          completedAt: existing.completedAt,
        },
      });
    }

    const [assessment] = await db
      .insert(assessments)
      .values({
        consultationId,
        status: "pending",
        inputSnapshot: consultation.structuredOutput,
      })
      .returning();

    return reply.status(201).send({
      id: assessment.id,
      consultationId: assessment.consultationId,
      status: assessment.status,
      inputSnapshot: assessment.inputSnapshot,
      result: assessment.result,
      createdAt: assessment.createdAt,
      completedAt: assessment.completedAt,
    });
  });

  app.get("/", async (request, reply) => {
    const parsed = assessmentParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { consultationId } = parsed.data;

    const [consultation] = await db
      .select({ id: consultations.id })
      .from(consultations)
      .where(eq(consultations.id, consultationId))
      .limit(1);

    if (!consultation) {
      return reply.status(404).send({ error: "Consultation not found" });
    }

    const rows = await db
      .select()
      .from(assessments)
      .where(eq(assessments.consultationId, consultationId))
      .orderBy(desc(assessments.createdAt));

    const result = rows.map((a) => ({
      id: a.id,
      consultationId: a.consultationId,
      status: a.status,
      inputSnapshot: a.inputSnapshot,
      result: a.result,
      createdAt: a.createdAt,
      completedAt: a.completedAt,
    }));

    return reply.status(200).send(result);
  });
};
