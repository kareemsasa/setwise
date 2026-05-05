export interface MockExercise {
  exerciseName: string;
  orderInWorkout: number;
  sets: number;
  repMin: number;
  repMax: number;
  weightKg: null;
  rpeTarget: number;
  restSeconds: number;
  notes: null;
}

interface SessionParams {
  exercises: string[];
  sets: number;
  repMin: number;
  repMax: number;
  rpe: number;
  rest: number;
}

const SESSION_EXERCISES: Record<string, SessionParams> = {
  "Heavy Compound": {
    exercises: ["Goblet Squat", "Dumbbell Bench Press", "Dumbbell Row", "Romanian Deadlift"],
    sets: 4, repMin: 4, repMax: 6, rpe: 8, rest: 180,
  },
  "Accessory Strength": {
    exercises: ["Split Squat", "Incline DB Press", "Cable Row", "Face Pull", "Lateral Raise"],
    sets: 3, repMin: 8, repMax: 12, rpe: 7, rest: 90,
  },
  "Power Development": {
    exercises: ["DB Shoulder Press", "Split Squat", "Cable Row", "Farmer Carry"],
    sets: 4, repMin: 5, repMax: 8, rpe: 7, rest: 120,
  },
  "Upper Hypertrophy": {
    exercises: ["Dumbbell Bench Press", "Cable Row", "DB Shoulder Press", "Cable Pressdown", "Face Pull"],
    sets: 3, repMin: 10, repMax: 15, rpe: 7, rest: 60,
  },
  "Lower Hypertrophy": {
    exercises: ["Leg Press", "Split Squat", "Leg Curl", "Calf Raise", "Hip Thrust"],
    sets: 3, repMin: 10, repMax: 15, rpe: 7, rest: 60,
  },
  "Full Body Volume": {
    exercises: ["Goblet Squat", "Dumbbell Bench Press", "Cable Row", "DB Shoulder Press", "Plank"],
    sets: 3, repMin: 10, repMax: 12, rpe: 7, rest: 60,
  },
  "Endurance Circuit": {
    exercises: ["Farmer Carry", "Incline Walk", "Stationary Bike", "Goblet Squat", "Plank"],
    sets: 3, repMin: 12, repMax: 20, rpe: 6, rest: 45,
  },
  "Tempo Work": {
    exercises: ["Goblet Squat", "Dumbbell Bench Press", "Cable Row", "Romanian Deadlift"],
    sets: 3, repMin: 8, repMax: 10, rpe: 7, rest: 90,
  },
  "Conditioning": {
    exercises: ["Incline Walk", "Stationary Bike", "Farmer Carry", "Plank"],
    sets: 3, repMin: 10, repMax: 15, rpe: 6, rest: 60,
  },
  "Full Body": {
    exercises: ["Goblet Squat", "Dumbbell Bench Press", "Dumbbell Row", "DB Shoulder Press", "Plank"],
    sets: 3, repMin: 8, repMax: 12, rpe: 7, rest: 90,
  },
  "Upper Focus": {
    exercises: ["Dumbbell Bench Press", "Cable Row", "DB Shoulder Press", "Face Pull", "Cable Pressdown"],
    sets: 3, repMin: 8, repMax: 12, rpe: 7, rest: 90,
  },
  "Lower Focus": {
    exercises: ["Goblet Squat", "Romanian Deadlift", "Leg Press", "Split Squat", "Calf Raise"],
    sets: 3, repMin: 8, repMax: 12, rpe: 7, rest: 90,
  },
};

const DEFAULT_PARAMS: SessionParams = {
  exercises: ["Goblet Squat", "Dumbbell Bench Press", "Dumbbell Row", "Plank"],
  sets: 3, repMin: 8, repMax: 12, rpe: 7, rest: 90,
};

export function generateMockExercises(sessionType: string): MockExercise[] {
  const params = SESSION_EXERCISES[sessionType] ?? DEFAULT_PARAMS;
  return params.exercises.map((name, i) => ({
    exerciseName: name,
    orderInWorkout: i + 1,
    sets: params.sets,
    repMin: params.repMin,
    repMax: params.repMax,
    weightKg: null,
    rpeTarget: params.rpe,
    restSeconds: params.rest,
    notes: null,
  }));
}
