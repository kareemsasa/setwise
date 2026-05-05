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

  if (phase === "done") {
    return (
      <main style={containerStyle}>
        <h1>Intake Complete</h1>
        <p>Your profile and consultation data have been saved.</p>

        {assessmentStatus === "idle" && (
          <button onClick={handleAssessmentSubmit} disabled={!consultationId}>
            Submit for Assessment
          </button>
        )}

        {assessmentStatus === "submitting" && <p>Submitting...</p>}

        {assessmentStatus === "created" && (
          <p>
            Assessment created with status: <strong>pending</strong>. Plan
            generation is not yet implemented.
          </p>
        )}

        {assessmentStatus === "conflict" && (
          <p>An assessment is already in progress for this consultation.</p>
        )}

        {assessmentStatus === "error" && (
          <p style={{ color: "red" }}>{error}</p>
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
