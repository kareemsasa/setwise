"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export default function IntakePage() {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
      const res = await fetch("http://localhost:4000/api/profiles", {
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

      setStatus("success");
    } catch {
      setError("Could not reach the API. Is it running on port 4000?");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <main style={{ maxWidth: 480, margin: "2rem auto", fontFamily: "system-ui" }}>
        <h1>Profile Created</h1>
        <p>Your profile has been saved. The consultation flow is not yet implemented.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Create Your Profile</h1>
      <p>Step 1 of the intake process. Fill in your basic info to get started.</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label>
          Name
          <input name="name" type="text" required style={{ display: "block", width: "100%" }} />
        </label>

        <label>
          Email
          <input name="email" type="email" required style={{ display: "block", width: "100%" }} />
        </label>

        <label>
          Height (cm)
          <input name="heightCm" type="number" step="0.1" min="1" max="300" required style={{ display: "block", width: "100%" }} />
        </label>

        <label>
          Weight (kg)
          <input name="weightKg" type="number" step="0.1" min="1" max="500" required style={{ display: "block", width: "100%" }} />
        </label>

        <label>
          Date of Birth
          <input name="dateOfBirth" type="date" required style={{ display: "block", width: "100%" }} />
        </label>

        <label>
          Biological Sex
          <select name="biologicalSex" required style={{ display: "block", width: "100%" }}>
            <option value="">Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>

        <label>
          Experience Level
          <select name="experienceLevel" required style={{ display: "block", width: "100%" }}>
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
