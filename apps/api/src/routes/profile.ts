import type { FastifyPluginAsync } from "fastify";
import { createProfileSchema } from "@setwise/validation";
import { db, userProfiles } from "@setwise/db";

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    return { message: "GET /api/profiles — not yet implemented" };
  });

  app.post("/", async (request, reply) => {
    const parsed = createProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const [profile] = await db
        .insert(userProfiles)
        .values({
          name: parsed.data.name,
          email: parsed.data.email,
          heightCm: String(parsed.data.heightCm),
          weightKg: String(parsed.data.weightKg),
          dateOfBirth: parsed.data.dateOfBirth,
          biologicalSex: parsed.data.biologicalSex,
          experienceLevel: parsed.data.experienceLevel,
        })
        .returning();

      return reply.status(201).send(profile);
    } catch (error: unknown) {
      const cause =
        error instanceof Error && "cause" in error
          ? (error as Error & { cause: { code?: string } }).cause
          : undefined;
      if (cause?.code === "23505") {
        return reply.status(409).send({
          error: "A profile with this email already exists",
        });
      }
      throw error;
    }
  });
};
