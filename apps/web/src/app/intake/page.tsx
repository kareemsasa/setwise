"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const API = "http://localhost:4000";

const style = { display: "block", width: "100%" } as const;
const containerStyle = {
  maxWidth: 480,
  margin: "2rem auto",
  fontFamily: "system-ui",
} as const;

interface PlanVersion {
  id: string;
  versionNumber: number;
  status: string;
  structure: {
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
    generationMethod: string;
  };
  rejectionFeedback: string | null;
}

interface Plan {
  id: string;
  name: string;
  status: string;
  currentVersion: PlanVersion;
}

export default function IntakePage() {
  const [phase, setPhase] = useState<"profile" | "consultation" | "done">(
    "profile",
  );
  const [profileId, setProfileId] = useState("");
  const [consultationId, setConsultationId] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [assessmentStatus, setAssessmentStatus] = useState<
    "idle" | "submitting" | "created" | "conflict" | "error"
  >("idle");
  const [assessmentId, setAssessmentId] = useState("");

  // Plan state
  const [planStatus, setPlanStatus] = useState<
    "idle" | "creating" | "created" | "conflict" | "error"
  >("idle");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reviewStatus, setReviewStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");
  const [rejectFeedback, setRejectFeedback] = useState("");

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      heightCm: Number(form.get("heightCm")),
      weightKg: Number(form.get("weightKg")),
      dateOfBirth: form.get("dateOfBirth"),
      biologicalSex: form.get("biologicalSex"),
      experienceLevel: form.get("experienceLevel"),
    };

    try {
      const res = await fetch(`${API}/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Request failed");
        setStatus("error");
        return;
      }

      const body = await res.json();
      setProfileId(body.id);
      setStatus("idle");
      setPhase("consultation");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setStatus("error");
    }
  }

  async function handleConsultationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const form = new FormData(e.currentTarget);

    const payload = {
      injuriesAndRestrictions: [],
      equipment: {
        location: form.get("location"),
        locationNotes: "",
        availableEquipment: (form.get("equipment") as string)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        equipmentLimitations: "",
      },
      goals: {
        primaryGoal: form.get("primaryGoal"),
        secondaryGoals: [],
        specificTargets: [],
        timeline: form.get("timeline") || "",
      },
      schedule: {
        daysPerWeek: Number(form.get("daysPerWeek")),
        availableDays: Array.from(form.getAll("availableDays")),
        preferredTime: form.get("preferredTime"),
        sessionLengthMinutes: Number(form.get("sessionLength")),
        upcomingDisruptions: "",
      },
      trainingHistory: {
        experienceDuration: form.get("experienceDuration") || "",
        recentProgram: form.get("recentProgram") || "",
        familiarExercises: [],
        recentWorkingWeights: [],
        pastObservations: "",
      },
      preferences: {
        likedExercises: [],
        dislikedExercises: [],
        trainingStyle: "",
        cardioPreference: "",
        otherNotes: form.get("notes") || "",
      },
      safetyFlags: [],
      agentNotes: "",
    };

    try {
      const res = await fetch(
        `${API}/api/profiles/${profileId}/consultations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Request failed");
        setStatus("error");
        return;
      }

      const body = await res.json();
      setConsultationId(body.id);
      setStatus("idle");
      setPhase("done");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setStatus("error");
    }
  }

  async function handleAssessmentSubmit() {
    setAssessmentStatus("submitting");
    setError("");

    try {
      const res = await fetch(
        `${API}/api/consultations/${consultationId}/assessments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (res.status === 201) {
        const body = await res.json();
        setAssessmentId(body.id);
        setAssessmentStatus("created");
        return;
      }

      if (res.status === 409) {
        setAssessmentStatus("conflict");
        return;
      }

      const body = await res.json();
      setError(body.error || "Request failed");
      setAssessmentStatus("error");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setAssessmentStatus("error");
    }
  }

  async function handleCreatePlan() {
    setPlanStatus("creating");
    setError("");

    try {
      const res = await fetch(
        `${API}/api/assessments/${assessmentId}/plans`,
        { method: "POST" },
      );

      if (res.status === 201) {
        const body = await res.json();
        setPlan(body);
        setPlanStatus("created");
        return;
      }

      if (res.status === 409) {
        const body = await res.json();
        if (body.plan) setPlan(body.plan);
        setPlanStatus("conflict");
        return;
      }

      const body = await res.json();
      setError(body.error || "Request failed");
      setPlanStatus("error");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setPlanStatus("error");
    }
  }

  async function handleApprove() {
    if (!plan) return;
    setReviewStatus("submitting");
    setError("");

    try {
      const res = await fetch(`${API}/api/plans/${plan.id}/approve`, {
        method: "POST",
      });

      if (res.ok) {
        const body = await res.json();
        setPlan(body);
        setReviewStatus("done");
        return;
      }

      const body = await res.json();
      setError(body.error || "Request failed");
      setReviewStatus("error");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setReviewStatus("error");
    }
  }

  async function handleReject() {
    if (!plan || !rejectFeedback.trim()) return;
    setReviewStatus("submitting");
    setError("");

    try {
      const res = await fetch(`${API}/api/plans/${plan.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: rejectFeedback }),
      });

      if (res.ok) {
        const body = await res.json();
        setPlan(body);
        setReviewStatus("done");
        return;
      }

      const body = await res.json();
      setError(body.error || "Request failed");
      setReviewStatus("error");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setReviewStatus("error");
    }
  }

  if (phase === "done") {
    return (
      <main style={containerStyle}>
        <h1>Intake Complete</h1>
        <p>Your profile and consultation data have been saved.</p>

        {/* Assessment submission */}
        {assessmentStatus === "idle" && (
          <button onClick={handleAssessmentSubmit} disabled={!consultationId}>
            Submit for Assessment
          </button>
        )}

        {assessmentStatus === "submitting" && <p>Submitting assessment...</p>}

        {assessmentStatus === "conflict" && (
          <p>An assessment is already in progress for this consultation.</p>
        )}

        {assessmentStatus === "error" && (
          <p style={{ color: "red" }}>{error}</p>
        )}

        {/* Plan creation */}
        {assessmentStatus === "created" && !plan && planStatus === "idle" && (
          <div style={{ marginTop: "1rem" }}>
            <p>
              Assessment created (status: <strong>pending</strong>).
            </p>
            <button onClick={handleCreatePlan}>Create Draft Plan</button>
          </div>
        )}

        {planStatus === "creating" && <p>Generating draft plan...</p>}

        {planStatus === "conflict" && !plan && (
          <p>A draft plan already exists for this assessment.</p>
        )}

        {planStatus === "error" && <p style={{ color: "red" }}>{error}</p>}

        {/* Plan display */}
        {plan && (
          <div style={{ marginTop: "1rem" }}>
            <h2>{plan.name}</h2>
            <p>
              Plan status: <strong>{plan.status}</strong> | Version{" "}
              {plan.currentVersion.versionNumber} (
              {plan.currentVersion.status})
            </p>

            <div
              style={{
                background: "#f5f5f5",
                padding: "1rem",
                borderRadius: 4,
                marginTop: "0.5rem",
              }}
            >
              <p>
                <strong>Goal:</strong>{" "}
                {plan.currentVersion.structure.goalSummary}
              </p>
              <p>
                <strong>Schedule:</strong>{" "}
                {plan.currentVersion.structure.weeklySchedule.daysPerWeek}{" "}
                days/week,{" "}
                {
                  plan.currentVersion.structure.weeklySchedule
                    .sessionLengthMinutes
                }{" "}
                min sessions
              </p>
              <ul>
                {plan.currentVersion.structure.weeklySchedule.sessions.map(
                  (s, i) => (
                    <li key={i}>
                      <strong>{s.dayOfWeek}:</strong> {s.sessionType} —{" "}
                      {s.focus}
                    </li>
                  ),
                )}
              </ul>
              {plan.currentVersion.structure.safetyNotes.length > 0 && (
                <>
                  <p>
                    <strong>Safety notes:</strong>
                  </p>
                  <ul>
                    {plan.currentVersion.structure.safetyNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
              <p>
                <em>{plan.currentVersion.structure.progressionRules}</em>
              </p>
              <p style={{ fontSize: "0.8em", color: "#888" }}>
                Generation: {plan.currentVersion.structure.generationMethod}
              </p>
            </div>

            {plan.currentVersion.rejectionFeedback && (
              <p style={{ marginTop: "0.5rem", color: "#c00" }}>
                Rejection feedback: {plan.currentVersion.rejectionFeedback}
              </p>
            )}

            {/* Approve/reject controls */}
            {plan.currentVersion.status === "draft" &&
              reviewStatus !== "done" && (
                <div style={{ marginTop: "1rem" }}>
                  <button
                    onClick={handleApprove}
                    disabled={reviewStatus === "submitting"}
                    style={{ marginRight: "0.5rem" }}
                  >
                    Approve Plan
                  </button>
                  <div style={{ marginTop: "0.5rem" }}>
                    <textarea
                      placeholder="Rejection feedback (required)"
                      value={rejectFeedback}
                      onChange={(e) => setRejectFeedback(e.target.value)}
                      rows={2}
                      style={style}
                    />
                    <button
                      onClick={handleReject}
                      disabled={
                        reviewStatus === "submitting" ||
                        !rejectFeedback.trim()
                      }
                    >
                      Reject Plan
                    </button>
                  </div>
                </div>
              )}

            {reviewStatus === "done" && (
              <p style={{ marginTop: "0.5rem", color: "green" }}>
                Plan review submitted. Status:{" "}
                <strong>{plan.currentVersion.status}</strong>.
                {plan.currentVersion.status === "approved" &&
                  " Scheduled workout generation is not yet implemented."}
              </p>
            )}

            {reviewStatus === "error" && (
              <p style={{ color: "red" }}>{error}</p>
            )}
          </div>
        )}
      </main>
    );
  }

  if (phase === "consultation") {
    return (
      <main style={containerStyle}>
        <h1>Training Intake</h1>
        <p>Step 2: Tell us about your training context.</p>

        <form
          onSubmit={handleConsultationSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <fieldset>
            <legend>Equipment</legend>
            <label>
              Training location
              <select name="location" required style={style}>
                <option value="">Select...</option>
                <option value="commercial_gym">Commercial gym</option>
                <option value="home_gym">Home gym</option>
                <option value="outdoor">Outdoor</option>
                <option value="mixed">Mixed</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Available equipment (comma-separated)
              <input
                name="equipment"
                type="text"
                placeholder="barbell, dumbbells, cables"
                style={style}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Goals</legend>
            <label>
              Primary goal
              <select name="primaryGoal" required style={style}>
                <option value="">Select...</option>
                <option value="strength">Strength</option>
                <option value="hypertrophy">Hypertrophy</option>
                <option value="endurance">Endurance</option>
                <option value="general_fitness">General fitness</option>
                <option value="sport_specific">Sport-specific</option>
              </select>
            </label>
            <label>
              Timeline
              <input
                name="timeline"
                type="text"
                placeholder="e.g. 6 months"
                style={style}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Schedule</legend>
            <label>
              Days per week
              <input
                name="daysPerWeek"
                type="number"
                min="1"
                max="7"
                required
                style={style}
              />
            </label>
            <label>
              Available days
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginTop: "0.25rem",
                }}
              >
                {[
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                  "sunday",
                ].map((day) => (
                  <label key={day} style={{ display: "flex", gap: "0.25rem" }}>
                    <input type="checkbox" name="availableDays" value={day} />
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </label>
                ))}
              </div>
            </label>
            <label>
              Preferred time
              <select name="preferredTime" required style={style}>
                <option value="no_preference">No preference</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </label>
            <label>
              Session length (minutes)
              <input
                name="sessionLength"
                type="number"
                min="15"
                max="180"
                defaultValue={60}
                required
                style={style}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Training History</legend>
            <label>
              How long have you been training?
              <input
                name="experienceDuration"
                type="text"
                placeholder="e.g. 2 years"
                style={style}
              />
            </label>
            <label>
              Recent program
              <input
                name="recentProgram"
                type="text"
                placeholder="e.g. PPL, Starting Strength"
                style={style}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Other</legend>
            <label>
              Notes
              <textarea name="notes" rows={3} style={style} />
            </label>
          </fieldset>

          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Saving..." : "Submit Intake"}
          </button>

          {status === "error" && <p style={{ color: "red" }}>{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      <h1>Create Your Profile</h1>
      <p>Step 1 of the intake process. Fill in your basic info to get started.</p>

      <form
        onSubmit={handleProfileSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <label>
          Name
          <input name="name" type="text" required style={style} />
        </label>

        <label>
          Email
          <input name="email" type="email" required style={style} />
        </label>

        <label>
          Height (cm)
          <input
            name="heightCm"
            type="number"
            step="0.1"
            min="1"
            max="300"
            required
            style={style}
          />
        </label>

        <label>
          Weight (kg)
          <input
            name="weightKg"
            type="number"
            step="0.1"
            min="1"
            max="500"
            required
            style={style}
          />
        </label>

        <label>
          Date of Birth
          <input name="dateOfBirth" type="date" required style={style} />
        </label>

        <label>
          Biological Sex
          <select name="biologicalSex" required style={style}>
            <option value="">Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>

        <label>
          Experience Level
          <select name="experienceLevel" required style={style}>
            <option value="">Select...</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Saving..." : "Create Profile"}
        </button>

        {status === "error" && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </main>
  );
}
