import type { FastifyPluginAsync } from "fastify";

export const consultationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async () => {
    return { message: "POST /api/consultations — not yet implemented" };
  });

  app.get("/:id", async () => {
    return { message: "GET /api/consultations/:id — not yet implemented" };
  });
};
