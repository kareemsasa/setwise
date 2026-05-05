"use client";

import { useState, useEffect, useCallback } from "react";

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

interface SetLogEntry {
  id: string;
  exercisePrescriptionId: string | null;
  exerciseName: string;
  setNumber: number;
  prescribedReps: number;
  actualReps: number;
  prescribedWeightKg: number | null;
  actualWeightKg: number | null;
  rpeActual: number | null;
  painReported: boolean;
  painNotes: string | null;
}

interface Session {
  id: string;
  scheduledWorkoutId: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
}

interface SessionData {
  session: Session;
  plannedExercises: Exercise[];
  setLogs: SetLogEntry[];
}

interface SetPerformance {
  setNumber: number;
  prescribedReps: number;
  actualReps: number;
  prescribedWeightKg: number | null;
  actualWeightKg: number | null;
  rpeActual: number | null;
  painReported: boolean;
  skipped: boolean;
  logged: boolean;
}

interface ExercisePerformanceSummary {
  exercisePrescriptionId: string;
  exerciseName: string;
  prescribedSets: number;
  loggedSets: number;
  prescribedRepsPerSet: number;
  completedReps: number;
  totalPrescribedReps: number;
  completionRate: number;
  status: "completed" | "partial" | "not_started";
  painReported: boolean;
  setBreakdown: SetPerformance[];
}

interface SessionPerformanceSummary {
  sessionId: string;
  sessionStatus: string;
  startedAt: string;
  completedAt: string | null;
  totalExercises: number;
  completedExercises: number;
  totalPrescribedSets: number;
  totalLoggedSets: number;
  totalPrescribedReps: number;
  totalCompletedReps: number;
  completionRate: number;
  painReported: boolean;
  exercises: ExercisePerformanceSummary[];
}

type WorkoutState = "not_started" | "in_progress" | "completed";

export function WorkoutExecution({
  scheduledWorkoutId,
  exercises,
}: {
  scheduledWorkoutId: string;
  exercises: Exercise[];
}) {
  const [state, setState] = useState<WorkoutState>("not_started");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    const res = await fetch(
      `${API_URL}/api/scheduled-workouts/${scheduledWorkoutId}/session`,
    );
    if (res.status === 404) {
      setState("not_started");
      setSessionData(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Failed to fetch session");
      setLoading(false);
      return;
    }
    const data: SessionData = await res.json();
    setSessionData(data);
    setState(
      data.session.status === "completed" ? "completed" : "in_progress",
    );
    setLoading(false);
  }, [scheduledWorkoutId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleStart = async () => {
    setError(null);
    const res = await fetch(
      `${API_URL}/api/scheduled-workouts/${scheduledWorkoutId}/start`,
      { method: "POST" },
    );
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to start workout");
      return;
    }
    await fetchSession();
  };

  const handleComplete = async () => {
    if (!sessionData) return;
    setError(null);
    const res = await fetch(
      `${API_URL}/api/workout-sessions/${sessionData.session.id}/complete`,
      { method: "POST" },
    );
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to complete workout");
      return;
    }
    await fetchSession();
  };

  if (loading) return <p>Loading session...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  if (state === "not_started") {
    return (
      <div>
        <button onClick={handleStart}>Start Workout</button>
      </div>
    );
  }

  if (state === "completed" && sessionData) {
    return (
      <CompletedView
        session={sessionData.session}
        exercises={exercises}
        setLogs={sessionData.setLogs}
      />
    );
  }

  if (state === "in_progress" && sessionData) {
    return (
      <InProgressView
        session={sessionData.session}
        exercises={exercises}
        setLogs={sessionData.setLogs}
        onLogSet={fetchSession}
        onComplete={handleComplete}
      />
    );
  }

  return null;
}

function InProgressView({
  session,
  exercises,
  setLogs,
  onLogSet,
  onComplete,
}: {
  session: Session;
  exercises: Exercise[];
  setLogs: SetLogEntry[];
  onLogSet: () => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  return (
    <div>
      <p>
        <strong>Status:</strong> In Progress — started{" "}
        {new Date(session.startedAt).toLocaleTimeString()}
      </p>

      {exercises.map((ex) => (
        <ExerciseSection
          key={ex.id}
          exercise={ex}
          sessionId={session.id}
          setLogs={setLogs.filter(
            (log) => log.exercisePrescriptionId === ex.id,
          )}
          onLogSet={onLogSet}
        />
      ))}

      <hr />
      <button onClick={onComplete}>Complete Workout</button>
    </div>
  );
}

function ExerciseSection({
  exercise,
  sessionId,
  setLogs,
  onLogSet,
}: {
  exercise: Exercise;
  sessionId: string;
  setLogs: SetLogEntry[];
  onLogSet: () => Promise<void>;
}) {
  const [reps, setReps] = useState(String(exercise.repMax));
  const [weight, setWeight] = useState(
    exercise.weightKg != null ? String(exercise.weightKg) : "",
  );
  const [rpe, setRpe] = useState("");
  const [painReported, setPainReported] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nextSetNumber = setLogs.length + 1;
  const allSetsLogged = setLogs.length >= exercise.sets;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const res = await fetch(
      `${API_URL}/api/workout-sessions/${sessionId}/set-logs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercisePrescriptionId: exercise.id,
          setNumber: nextSetNumber,
          repsCompleted: parseInt(reps, 10),
          weightKg: weight ? parseFloat(weight) : null,
          rpe: rpe ? parseFloat(rpe) : null,
          painReported,
          notes: notes || null,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.json();
      setSubmitError(body.error ?? "Failed to log set");
      setSubmitting(false);
      return;
    }

    setPainReported(false);
    setNotes("");
    setSubmitting(false);
    await onLogSet();
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h3>
        {exercise.orderInWorkout}. {exercise.exerciseName}
      </h3>
      <p>
        {exercise.sets} sets x {exercise.repMin === exercise.repMax
          ? exercise.repMin
          : `${exercise.repMin}-${exercise.repMax}`}{" "}
        reps
        {exercise.rpeTarget ? ` @ RPE ${exercise.rpeTarget}` : ""}
        {exercise.weightKg ? ` — ${exercise.weightKg}kg` : ""}
      </p>

      {setLogs.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Set</th>
              <th>Reps</th>
              <th>Weight</th>
              <th>RPE</th>
              <th>Pain</th>
            </tr>
          </thead>
          <tbody>
            {setLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.setNumber}</td>
                <td>{log.actualReps}</td>
                <td>{log.actualWeightKg ?? "—"}</td>
                <td>{log.rpeActual ?? "—"}</td>
                <td>{log.painReported ? "Yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!allSetsLogged && (
        <form onSubmit={handleSubmit}>
          <p>
            <strong>Set {nextSetNumber} of {exercise.sets}</strong>
          </p>
          <label>
            Reps:{" "}
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              min={0}
              required
              style={{ width: "60px" }}
            />
          </label>{" "}
          <label>
            Weight (kg):{" "}
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min={0}
              step={0.5}
              style={{ width: "80px" }}
            />
          </label>{" "}
          <label>
            RPE:{" "}
            <input
              type="number"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              min={1}
              max={10}
              step={0.5}
              style={{ width: "60px" }}
            />
          </label>{" "}
          <label>
            <input
              type="checkbox"
              checked={painReported}
              onChange={(e) => setPainReported(e.target.checked)}
            />{" "}
            Pain
          </label>{" "}
          <label>
            Notes:{" "}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "150px" }}
            />
          </label>{" "}
          <button type="submit" disabled={submitting}>
            {submitting ? "Logging..." : "Log Set"}
          </button>
          {submitError && (
            <span style={{ color: "red", marginLeft: "8px" }}>
              {submitError}
            </span>
          )}
        </form>
      )}

      {allSetsLogged && (
        <p>
          <em>All {exercise.sets} sets logged.</em>
        </p>
      )}
    </div>
  );
}

function CompletedView({
  session,
  exercises,
  setLogs,
}: {
  session: Session;
  exercises: Exercise[];
  setLogs: SetLogEntry[];
}) {
  const [summary, setSummary] = useState<SessionPerformanceSummary | null>(
    null,
  );
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/workout-sessions/${session.id}/summary`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch summary");
        return res.json();
      })
      .then(setSummary)
      .catch(() => setSummaryError(true));
  }, [session.id]);

  const startTime = new Date(session.startedAt);
  const endTime = session.completedAt ? new Date(session.completedAt) : null;
  const durationMin = endTime
    ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    : null;

  return (
    <div>
      <p>
        <strong>Completed</strong> — {startTime.toLocaleTimeString()} to{" "}
        {endTime?.toLocaleTimeString() ?? "—"}
        {durationMin != null ? ` (${durationMin} min)` : ""}
      </p>
      {session.notes && <p>Notes: {session.notes}</p>}

      {summary && <PerformanceSummaryPanel summary={summary} />}

      {summaryError && <RawCompletedView exercises={exercises} setLogs={setLogs} />}

      {!summary && !summaryError && (
        <p>Loading summary...</p>
      )}
    </div>
  );
}

function PerformanceSummaryPanel({
  summary,
}: {
  summary: SessionPerformanceSummary;
}) {
  const pct = (rate: number) => `${Math.round(rate * 100)}%`;

  return (
    <div style={{ marginTop: "1rem" }}>
      <h2>Performance Summary</h2>

      <div style={{ marginBottom: "1rem" }}>
        <p>
          <strong>Exercises:</strong> {summary.completedExercises}/
          {summary.totalExercises} completed
        </p>
        <p>
          <strong>Sets:</strong> {summary.totalLoggedSets}/
          {summary.totalPrescribedSets} logged
        </p>
        <p>
          <strong>Reps:</strong> {summary.totalCompletedReps}/
          {summary.totalPrescribedReps} completed ({pct(summary.completionRate)}
          )
        </p>
        {summary.painReported && (
          <p>
            <strong>Pain reported</strong> during this session
          </p>
        )}
      </div>

      {summary.exercises.map((ex) => (
        <div
          key={ex.exercisePrescriptionId}
          style={{ marginBottom: "1.5rem" }}
        >
          <h3>
            {ex.exerciseName}{" "}
            <span
              style={{
                fontSize: "0.85em",
                color:
                  ex.status === "completed"
                    ? "green"
                    : ex.status === "partial"
                      ? "orange"
                      : "#888",
              }}
            >
              [{ex.status}]
            </span>
          </h3>
          <p>
            Sets: {ex.loggedSets}/{ex.prescribedSets} — Reps:{" "}
            {ex.completedReps}/{ex.totalPrescribedReps} (
            {pct(ex.completionRate)})
            {ex.painReported && " — Pain reported"}
          </p>

          <table>
            <thead>
              <tr>
                <th>Set</th>
                <th>Prescribed</th>
                <th>Actual</th>
                <th>Weight</th>
                <th>RPE</th>
                <th>Pain</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ex.setBreakdown.map((s) => (
                <tr
                  key={s.setNumber}
                  style={{ color: s.logged ? "inherit" : "#aaa" }}
                >
                  <td>{s.setNumber}</td>
                  <td>{s.prescribedReps}</td>
                  <td>{s.logged ? s.actualReps : "—"}</td>
                  <td>
                    {s.logged && s.actualWeightKg != null
                      ? `${s.actualWeightKg}kg`
                      : "—"}
                  </td>
                  <td>{s.logged && s.rpeActual != null ? s.rpeActual : "—"}</td>
                  <td>{s.painReported ? "Yes" : "—"}</td>
                  <td>
                    {s.skipped
                      ? "Skipped"
                      : s.logged
                        ? "Logged"
                        : "Not logged"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function RawCompletedView({
  exercises,
  setLogs,
}: {
  exercises: Exercise[];
  setLogs: SetLogEntry[];
}) {
  return (
    <div>
      <p style={{ color: "#888" }}>
        <em>Could not load performance summary.</em>
      </p>
      {exercises.map((ex) => {
        const logs = setLogs.filter(
          (log) => log.exercisePrescriptionId === ex.id,
        );
        return (
          <div key={ex.id} style={{ marginBottom: "1rem" }}>
            <h3>
              {ex.orderInWorkout}. {ex.exerciseName}
            </h3>
            <p>
              Planned: {ex.sets} x{" "}
              {ex.repMin === ex.repMax
                ? ex.repMin
                : `${ex.repMin}-${ex.repMax}`}
              {ex.weightKg ? ` @ ${ex.weightKg}kg` : ""}
            </p>
            {logs.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>Planned Reps</th>
                    <th>Actual Reps</th>
                    <th>Weight</th>
                    <th>RPE</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.setNumber}</td>
                      <td>{log.prescribedReps}</td>
                      <td>{log.actualReps}</td>
                      <td>{log.actualWeightKg ?? "—"}</td>
                      <td>{log.rpeActual ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>
                <em>No sets logged.</em>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
