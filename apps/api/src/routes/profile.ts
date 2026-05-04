import type { FastifyPluginAsync } from "fastify";

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    return { message: "GET /api/profiles — not yet implemented" };
  });

  app.post("/", async () => {
    return { message: "POST /api/profiles — not yet implemented" };
  });
};
