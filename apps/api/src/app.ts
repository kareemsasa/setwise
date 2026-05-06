import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profile.js";
import { consultationRoutes } from "./routes/consultations.js";
import { assessmentRoutes } from "./routes/assessments.js";
import { consultationAssessmentRoutes } from "./routes/consultation-assessments.js";
import { assessmentPlanRoutes } from "./routes/assessment-plans.js";
import { planRoutes } from "./routes/plans.js";
import { planScheduledWorkoutRoutes } from "./routes/plan-scheduled-workouts.js";
import { scheduledWorkoutRoutes } from "./routes/scheduled-workouts.js";
import { workoutSessionRoutes } from "./routes/workout-sessions.js";
import { progressionRoutes } from "./routes/progression.js";
import { profileProgressionPatternRoutes } from "./routes/profile-progression-patterns.js";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://10.0.0.222:3000",
      "http://erebus.tail172bcd.ts.net:3000",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });

  app.register(healthRoutes);
  app.register(profileRoutes, { prefix: "/api/profiles" });
  app.register(consultationRoutes, { prefix: "/api/profiles/:profileId/consultations" });
  app.register(consultationAssessmentRoutes, { prefix: "/api/consultations/:consultationId/assessments" });
  app.register(assessmentRoutes, { prefix: "/api/assessments" });
  app.register(assessmentPlanRoutes, { prefix: "/api/assessments/:assessmentId/plans" });
  app.register(planRoutes, { prefix: "/api/plans" });
  app.register(planScheduledWorkoutRoutes, { prefix: "/api/plans/:planId/scheduled-workouts" });
  app.register(scheduledWorkoutRoutes, { prefix: "/api/scheduled-workouts" });
  app.register(workoutSessionRoutes, { prefix: "/api/workout-sessions" });
  app.register(progressionRoutes, { prefix: "/api/progression" });
  app.register(profileProgressionPatternRoutes, { prefix: "/api/profiles/:profileId/progression-patterns" });

  return app;
}
