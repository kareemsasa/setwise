const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ScheduledWorkout {
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
  };
}

async function fetchScheduledWorkouts(): Promise<ScheduledWorkout[]> {
  const res = await fetch(`${API_URL}/api/scheduled-workouts`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

function groupByDate(
  workouts: ScheduledWorkout[],
): Record<string, ScheduledWorkout[]> {
  const groups: Record<string, ScheduledWorkout[]> = {};
  for (const w of workouts) {
    if (!groups[w.scheduledDate]) {
      groups[w.scheduledDate] = [];
    }
    groups[w.scheduledDate].push(w);
  }
  return groups;
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

export default async function CalendarPage() {
  const workouts = await fetchScheduledWorkouts();
  const grouped = groupByDate(workouts);
  const dates = Object.keys(grouped).sort();

  return (
    <main>
      <h1>Calendar</h1>
      {dates.length === 0 ? (
        <p>No scheduled workouts. Approve a plan and generate workouts to get started.</p>
      ) : (
        dates.map((date) => (
          <section key={date}>
            <h2>{formatDate(date)}</h2>
            <ul>
              {grouped[date].map((w) => (
                <li key={w.id}>
                  <a href={`/workouts/${w.id}`}>
                    {w.template.name} — {w.template.estimatedDurationMinutes} min
                  </a>
                  <span> ({w.status})</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
