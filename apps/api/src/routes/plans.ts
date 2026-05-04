import type { FastifyPluginAsync } from "fastify";

export const planRoutes: FastifyPluginAsync = async (app) => {
  app.get("/current", async () => {
    return { message: "GET /api/plans/current — not yet implemented" };
  });

  app.get("/:id", async () => {
    return { message: "GET /api/plans/:id — not yet implemented" };
  });

  app.post("/:id/review", async () => {
    return { message: "POST /api/plans/:id/review — not yet implemented" };
  });
};
