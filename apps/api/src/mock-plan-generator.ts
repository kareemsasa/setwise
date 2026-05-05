import type { StructuredIntakeOutput } from "@setwise/domain";

export interface MockPlanStructure {
  goalSummary: string;
  weeklySchedule: {
    daysPerWeek: number;
    sessionLengthMinutes: number;
    sessions: Array<{
      dayOfWeek: string;
      sessionType: string;
      focus: string;
    }>;
  };
  safetyNotes: string[];
  progressionRules: string;
  generatedAt: string;
  generationMethod: "deterministic-mock";
}

const SESSION_TYPES: Record<string, string[]> = {
  strength: ["Heavy Compound", "Accessory Strength", "Power Development"],
  hypertrophy: ["Upper Hypertrophy", "Lower Hypertrophy", "Full Body Volume"],
  endurance: ["Endurance Circuit", "Tempo Work", "Conditioning"],
  general_fitness: ["Full Body", "Upper Focus", "Lower Focus"],
  sport_specific: ["Sport Skill", "Strength Support", "Conditioning"],
};

const FOCUS_MAP: Record<string, string[]> = {
  strength: [
    "Squat and press variations",
    "Deadlift and row variations",
    "Bench and overhead variations",
  ],
  hypertrophy: [
    "Chest, shoulders, triceps",
    "Back, biceps, rear delts",
    "Quads, hamstrings, glutes",
  ],
  endurance: [
    "Sustained effort compound movements",
    "Tempo-controlled accessory work",
    "Mixed modal conditioning",
  ],
  general_fitness: [
    "Compound pushing and pulling",
    "Lower body and core",
    "Full body functional movements",
  ],
  sport_specific: [
    "Sport-specific movement patterns",
    "General strength foundation",
    "Aerobic and anaerobic capacity",
  ],
};

export function generateMockPlan(
  input: StructuredIntakeOutput,
): MockPlanStructure {
  const goal = input.goals.primaryGoal || "general_fitness";
  const daysPerWeek = input.schedule.daysPerWeek;
  const availableDays = input.schedule.availableDays;
  const sessionLength = input.schedule.sessionLengthMinutes;

  const sessionTypes = SESSION_TYPES[goal] ?? SESSION_TYPES["general_fitness"];
  const focuses = FOCUS_MAP[goal] ?? FOCUS_MAP["general_fitness"];

  const sessions = availableDays.slice(0, daysPerWeek).map((day, i) => ({
    dayOfWeek: day,
    sessionType: sessionTypes[i % sessionTypes.length],
    focus: focuses[i % focuses.length],
  }));

  const safetyNotes = input.safetyFlags.map((f) => f.recommendation);
  if (input.injuriesAndRestrictions.length > 0) {
    safetyNotes.push(
      "Modifications applied for reported injuries/restrictions. Monitor closely and reduce load if discomfort increases.",
    );
  }

  const targets = input.goals.specificTargets;
  const targetSummary =
    targets.length > 0 ? ` Targets: ${targets.join(", ")}.` : "";
  const goalSummary = `${goal.replace(/_/g, " ")} program, ${daysPerWeek} days/week, ${sessionLength} min sessions.${targetSummary}`;

  return {
    goalSummary,
    weeklySchedule: {
      daysPerWeek,
      sessionLengthMinutes: sessionLength,
      sessions,
    },
    safetyNotes,
    progressionRules:
      "Linear progression with conservative load increases. Deload after 3 consecutive sessions with incomplete prescribed reps.",
    generatedAt: new Date().toISOString(),
    generationMethod: "deterministic-mock",
  };
}
