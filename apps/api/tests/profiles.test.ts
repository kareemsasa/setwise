import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const validProfile = {
  name: "Alice Johnson",
  email: `test-${Date.now()}@example.com`,
  heightCm: 170,
  weightKg: 65,
  dateOfBirth: "1990-05-15",
  biologicalSex: "female",
  experienceLevel: "intermediate",
};

describe("POST /api/profiles", () => {
  it("creates a profile with valid data", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: { ...validProfile, email: `create-${Date.now()}@example.com` },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Alice Johnson");
    expect(body.email).toContain("@example.com");
    expect(body.heightCm).toBe("170.0");
    expect(body.weightKg).toBe("65.0");
    expect(body.dateOfBirth).toBe("1990-05-15");
    expect(body.biologicalSex).toBe("female");
    expect(body.experienceLevel).toBe("intermediate");
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it("rejects an empty payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: { name: "Bob" },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details.email).toBeDefined();
  });

  it("rejects invalid email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: { ...validProfile, email: "not-an-email" },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.details.email).toBeDefined();
  });

  it("rejects invalid biologicalSex value", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: {
        ...validProfile,
        email: `sex-${Date.now()}@example.com`,
        biologicalSex: "other",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.details.biologicalSex).toBeDefined();
  });

  it("rejects invalid experienceLevel value", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: {
        ...validProfile,
        email: `exp-${Date.now()}@example.com`,
        experienceLevel: "expert",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.details.experienceLevel).toBeDefined();
  });

  it("rejects negative height", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: {
        ...validProfile,
        email: `neg-${Date.now()}@example.com`,
        heightCm: -10,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.details.heightCm).toBeDefined();
  });

  it("returns 409 for duplicate email", async () => {
    const uniqueEmail = `dup-${Date.now()}@example.com`;

    const first = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: { ...validProfile, email: uniqueEmail },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: { ...validProfile, email: uniqueEmail },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toContain("email already exists");
  });
});
