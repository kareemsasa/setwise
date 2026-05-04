import type { FastifyPluginAsync } from "fastify";

export const workoutSessionRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async () => {
    return { message: "POST /api/workout-sessions — not yet implemented" };
  });

  app.get("/:id", async () => {
    return {
      message: "GET /api/workout-sessions/:id — not yet implemented",
    };
  });

  app.post("/:id/sets", async () => {
    return {
      message: "POST /api/workout-sessions/:id/sets — not yet implemented",
    };
  });

  app.post("/:id/complete", async () => {
    return {
      message:
        "POST /api/workout-sessions/:id/complete — not yet implemented",
    };
  });
};
