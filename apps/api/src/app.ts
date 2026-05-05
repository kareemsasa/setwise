import Fastify from "fastify";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profile.js";
import { consultationRoutes } from "./routes/consultations.js";
import { assessmentRoutes } from "./routes/assessments.js";
import { planRoutes } from "./routes/plans.js";
import { scheduledWorkoutRoutes } from "./routes/scheduled-workouts.js";
import { workoutSessionRoutes } from "./routes/workout-sessions.js";
import { progressionRoutes } from "./routes/progression.js";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.register(healthRoutes);
  app.register(profileRoutes, { prefix: "/api/profiles" });
  app.register(consultationRoutes, { prefix: "/api/consultations" });
  app.register(assessmentRoutes, { prefix: "/api/assessments" });
  app.register(planRoutes, { prefix: "/api/plans" });
  app.register(scheduledWorkoutRoutes, { prefix: "/api/scheduled-workouts" });
  app.register(workoutSessionRoutes, { prefix: "/api/workout-sessions" });
  app.register(progressionRoutes, { prefix: "/api/progression" });

  return app;
}
