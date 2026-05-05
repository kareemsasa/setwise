# Setwise

Adaptive training planner and workout execution tracker.

Setwise turns a user's profile, constraints, goals, schedule, and actual workout performance into a structured training plan with scheduled sessions, consistency tracking, and evidence-based progression recommendations.

## Status

**Phase: Profile Creation** -- local Postgres, Drizzle migrations, and the first real endpoint (POST /api/profiles) are wired up.

## Core Workflow

1. User creates a profile (basic physical stats, experience level).
2. AI-guided consultation gathers goals, constraints, injuries, equipment access, schedule, and preferences.
3. Background assessment produces a draft training plan and weekly schedule.
4. User reviews and approves (or rejects with feedback) the plan.
5. Approved plan generates workout slots on an in-app calendar.
6. User clocks in to workouts; actual timing, sets, reps, and weights are logged.
7. Missed sessions are tracked automatically.
8. The system analyzes workout data over time and recommends plan or schedule adjustments based on evidence.

## Key Principles

- **Reduce ambiguity**: answer "what should I do today?", "am I progressing?", "should the plan change?"
- **Deterministic rules first**: use explicit progression logic; reserve AI for intake, summarization, and review.
- **Conservative around safety**: pain and injuries are constraints, not problems to diagnose.

## Repository Structure

```
setwise/
  apps/
    web/                     # Next.js App Router (port 3000)
    api/                     # Fastify API server (port 4000)
  packages/
    domain/                  # Pure TypeScript types and enums
    training-core/           # Deterministic progression rules
    db/                      # Drizzle ORM schema, client, and migrations
    validation/              # Zod schemas for API input
  docs/
    product-brief.md         # product thesis, target user, MVP scope
    domain-model.md          # entities, relationships, lifecycle states
    intake-flow.md           # consultation process and structured output
    plan-lifecycle.md        # plan states, versioning, workout generation
    progression-rules-v0.md  # deterministic progression and deload rules
    architecture-notes.md    # technical architecture and module boundaries
```

## Tech Stack

- TypeScript end-to-end
- pnpm workspaces + Turborepo
- Next.js 15 (App Router) for the web app
- Fastify 5 for the API
- PostgreSQL 16 + Drizzle ORM
- Zod for validation
- Vitest for tests

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for local Postgres)

## Local Development

### 1. Install dependencies

```sh
pnpm install
```

### 2. Start the database

```sh
docker compose up -d
```

This starts a local Postgres on port 5432 with database `setwise`, user `setwise`, password `setwise`.

### 3. Set up environment variables

```sh
cp .env.example .env
```

The default `DATABASE_URL` points to the Docker Postgres instance.

### 4. Run database migrations

```sh
pnpm db:migrate
```

### 5. Start development servers

```sh
pnpm dev
```

This starts the API on http://localhost:4000 and the web app on http://localhost:3000.

## Database Commands

```sh
pnpm db:generate   # Generate new migration from schema changes
pnpm db:migrate    # Apply pending migrations
pnpm db:studio     # Open Drizzle Studio (database browser)
```

## API Endpoints

### POST /api/profiles

Create a new user profile.

**Request body:**

```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "heightCm": 170,
  "weightKg": 65,
  "dateOfBirth": "1990-05-15",
  "biologicalSex": "female",
  "experienceLevel": "intermediate"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "heightCm": "170.0",
  "weightKg": "65.0",
  "dateOfBirth": "1990-05-15",
  "biologicalSex": "female",
  "experienceLevel": "intermediate",
  "createdAt": "2026-05-04T...",
  "updatedAt": "2026-05-04T..."
}
```

**Error responses:**

- `400` — Validation failed (missing/invalid fields)
- `409` — Email already exists

**Example with curl:**

```sh
curl -X POST http://localhost:4000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","heightCm":170,"weightKg":65,"dateOfBirth":"1990-05-15","biologicalSex":"female","experienceLevel":"intermediate"}'
```

## Running Tests

```sh
DATABASE_URL=postgresql://setwise:setwise@localhost:5432/setwise pnpm test
```

Tests require a running Postgres instance (via `docker compose up -d`) with migrations applied.
