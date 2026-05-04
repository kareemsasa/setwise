# Setwise

Adaptive training planner and workout execution tracker.

Setwise turns a user's profile, constraints, goals, schedule, and actual workout performance into a structured training plan with scheduled sessions, consistency tracking, and evidence-based progression recommendations.

## Status

**Phase: Scaffold** -- monorepo structure with domain types, placeholder routes, and initial progression rules. No business logic or persistence yet.

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
    db/                      # Drizzle ORM schema and config
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
- PostgreSQL + Drizzle ORM
- Zod for validation
- Vitest for tests

## Local Development

```sh
pnpm install          # install dependencies
pnpm dev              # start web + api in dev mode
pnpm build            # build all packages
pnpm test             # run tests
pnpm typecheck        # type-check all packages
```

Requires Node.js 20+ and pnpm 10+. Postgres is needed once persistence is wired up (not yet required).
