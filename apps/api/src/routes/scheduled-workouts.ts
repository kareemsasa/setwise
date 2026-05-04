import type { FastifyPluginAsync } from "fastify";

export const scheduledWorkoutRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    return {
      message: "GET /api/scheduled-workouts — not yet implemented",
    };
  });

  app.get("/:id", async () => {
    return {
      message: "GET /api/scheduled-workouts/:id — not yet implemented",
    };
  });
};
