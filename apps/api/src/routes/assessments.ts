import type { FastifyPluginAsync } from "fastify";

export const assessmentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:id", async () => {
    return { message: "GET /api/assessments/:id — not yet implemented" };
  });
};
