import { notFound } from "next/navigation";
import { WorkoutExecution } from "./workout-execution";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Exercise {
  id: string;
  exerciseName: string;
  orderInWorkout: number;
  sets: number;
  repMin: number;
  repMax: number;
  weightKg: number | null;
  rpeTarget: number | null;
  restSeconds: number;
  notes: string | null;
}

interface ScheduledWorkoutDetail {
  id: string;
  profileId: string;
  planVersionId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  template: {
    id: string;
    name: string;
    dayOfWeek: number | null;
    estimatedDurationMinutes: number;
    exercises: Exercise[];
  };
}

async function fetchWorkout(
  id: string,
): Promise<ScheduledWorkoutDetail | null> {
  const res = await fetch(`${API_URL}/api/scheduled-workouts/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workout = await fetchWorkout(id);

  if (!workout) {
    notFound();
  }

  return (
    <main>
      <h1>{workout.template.name}</h1>
      <p>
        {formatDate(workout.scheduledDate)} —{" "}
        {workout.template.estimatedDurationMinutes} min — {workout.status}
      </p>

      <h2>Exercises</h2>
      {workout.template.exercises.length === 0 ? (
        <p>No exercises prescribed.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Exercise</th>
              <th>Sets</th>
              <th>Reps</th>
              <th>RPE</th>
              <th>Rest</th>
            </tr>
          </thead>
          <tbody>
            {workout.template.exercises.map((ex) => (
              <tr key={ex.id}>
                <td>{ex.orderInWorkout}</td>
                <td>{ex.exerciseName}</td>
                <td>{ex.sets}</td>
                <td>
                  {ex.repMin === ex.repMax
                    ? ex.repMin
                    : `${ex.repMin}-${ex.repMax}`}
                </td>
                <td>{ex.rpeTarget ?? "—"}</td>
                <td>{ex.restSeconds}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <WorkoutExecution
        scheduledWorkoutId={workout.id}
        exercises={workout.template.exercises}
      />

      <p>
        <a href="/calendar">Back to calendar</a>
      </p>
    </main>
  );
}
