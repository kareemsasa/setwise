import type { FastifyPluginAsync } from "fastify";

export const progressionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/patterns", async () => {
    return {
      message: "GET /api/progression/patterns — not yet implemented",
    };
  });

  app.get("/recommendations", async () => {
    return {
      message: "GET /api/progression/recommendations — not yet implemented",
    };
  });

  app.post("/recommendations/:id/resolve", async () => {
    return {
      message:
        "POST /api/progression/recommendations/:id/resolve — not yet implemented",
    };
  });
};
