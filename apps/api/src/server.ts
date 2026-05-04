import Fastify from "fastify";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profile.js";
import { consultationRoutes } from "./routes/consultations.js";
import { assessmentRoutes } from "./routes/assessments.js";
import { planRoutes } from "./routes/plans.js";
import { scheduledWorkoutRoutes } from "./routes/scheduled-workouts.js";
import { workoutSessionRoutes } from "./routes/workout-sessions.js";
import { progressionRoutes } from "./routes/progression.js";

const app = Fastify({ logger: true });

app.register(healthRoutes);
app.register(profileRoutes, { prefix: "/api/profiles" });
app.register(consultationRoutes, { prefix: "/api/consultations" });
app.register(assessmentRoutes, { prefix: "/api/assessments" });
app.register(planRoutes, { prefix: "/api/plans" });
app.register(scheduledWorkoutRoutes, { prefix: "/api/scheduled-workouts" });
app.register(workoutSessionRoutes, { prefix: "/api/workout-sessions" });
app.register(progressionRoutes, { prefix: "/api/progression" });

const start = async () => {
  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
};

start();
