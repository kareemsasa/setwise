import type { FastifyPluginAsync } from "fastify";
import { createConsultationSchema } from "@setwise/validation";
import { db, eq, userProfiles, consultations } from "@setwise/db";

export const consultationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const { profileId } = request.params as { profileId: string };

    const parsed = createConsultationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [profile] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, profileId))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({ error: "Profile not found" });
    }

    const now = new Date();
    const [consultation] = await db
      .insert(consultations)
      .values({
        userId: profileId,
        status: "completed",
        startedAt: now,
        completedAt: now,
        structuredOutput: parsed.data,
      })
      .returning();

    return reply.status(201).send({
      id: consultation.id,
      profileId: consultation.userId,
      status: consultation.status,
      startedAt: consultation.startedAt,
      completedAt: consultation.completedAt,
      structuredOutput: consultation.structuredOutput,
    });
  });

  app.get("/", async (request, reply) => {
    const { profileId } = request.params as { profileId: string };

    const [profile] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, profileId))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({ error: "Profile not found" });
    }

    const rows = await db
      .select()
      .from(consultations)
      .where(eq(consultations.userId, profileId))
      .orderBy(consultations.startedAt);

    const result = rows.map((c) => ({
      id: c.id,
      profileId: c.userId,
      status: c.status,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      structuredOutput: c.structuredOutput,
    }));

    return reply.status(200).send(result);
  });
};
