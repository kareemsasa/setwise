# Architecture Notes

## Overview

Setwise is a web application with a conversational AI component. This document outlines the initial technical architecture -- enough to guide the first implementation pass without over-committing to infrastructure.

---

## System Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                      Web App (SPA)                      │
│                                                         │
│  Profile Setup │ Consultation Chat │ Calendar │ Session  │
│       Form     │     Interface     │   View   │  Logger  │
└────────────────────────┬────────────────────────────────┘
                         │
                    HTTP / WebSocket
                         │
┌────────────────────────┴────────────────────────────────┐
│                        API Server                        │
│                                                         │
│  Auth │ Profile │ Consultation │ Plans │ Sessions │ Rules│
└───┬──────────┬──────────┬──────────┬────────────────────┘
    │          │          │          │
    │          │          │          │
    ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────────┐
│Database│ │AI Agent│ │Background│ │  Training Core    │
│        │ │Service │ │ Worker   │ │  (Rules Engine)   │
└────────┘ └────────┘ └──────────┘ └──────────────────┘
```

---

## Components

### Web App

A single-page application. Server-side rendering is not required for MVP.

**Responsibilities**:
- Profile creation form
- Consultation chat interface (streaming responses)
- Plan review and approval UI
- Calendar view of scheduled workouts
- Workout session logger (set-by-set input)
- Recommendation display and action

**Likely stack**: React or Next.js. TypeScript. Tailwind CSS for styling. A simple state management approach (React context or Zustand) -- no heavy state libraries needed at MVP scale.

### API Server

Handles all business logic, auth, and data access.

**Responsibilities**:
- User authentication and session management
- Profile CRUD
- Consultation session management (create, stream messages, complete)
- Plan and version management (CRUD, state transitions)
- Scheduled workout generation and retrieval
- Workout session logging (clock-in, set logging, clock-out)
- Attendance tracking
- Recommendation retrieval and status updates

**Likely stack**: Node.js with a typed framework (Hono, Fastify, or Express with TypeScript). Alternatively, Python with FastAPI if the team prefers. The choice should optimize for fast iteration and good TypeScript/Python typing.

**API style**: REST for most endpoints. WebSocket or SSE for consultation chat streaming.

### Database

A relational database. The domain model has clear entities, relationships, and integrity constraints that benefit from a relational schema.

**Likely stack**: PostgreSQL. Use a migration tool from the start (Drizzle, Prisma Migrate, or Alembic depending on language choice).

**Key considerations**:
- JSON columns for flexible structures (`PlanVersion.structure`, `Consultation.structured_output`, `ProgressionPattern.evidence`).
- Proper foreign keys and constraints -- the domain model has important referential integrity requirements (e.g., sessions must reference a valid plan version).
- Indexes on `user_id`, `scheduled_date`, `plan_version_id` for common query patterns.

### AI Agent Service

Handles the consultation conversation and any AI-assisted features.

**Responsibilities**:
- Managing consultation chat sessions
- Maintaining conversation context
- Extracting structured output from conversations
- Generating plan drafts from assessment input (possibly AI-assisted)
- Generating human-readable descriptions and explanations

**Likely approach**: call an external LLM API (Claude) with structured system prompts. The consultation agent needs:
- A system prompt defining its role, question categories, and boundaries
- Conversation history management
- A structured output extraction step at consultation completion
- Streaming response support for the chat UI

**Not a separate service at MVP**: this can be a module within the API server that wraps LLM API calls. Extract to a separate service only if it becomes a scaling or deployment bottleneck.

### Background Worker

Handles async tasks that shouldn't block API responses.

**Responsibilities**:
- Assessment processing (consultation output → draft plan)
- Scheduled workout generation (rolling look-ahead)
- Rule execution (post-session checks, daily/weekly pattern detection)
- Missed workout detection
- Notification triggers (when recommendations are generated)

**Likely approach**: a simple job queue. At MVP scale, this could be:
- A lightweight queue (BullMQ with Redis, or pg-boss using Postgres as the queue backend).
- Cron-triggered jobs for periodic tasks (daily missed-workout check, weekly stall detection).

**Not needed at MVP**: a full message broker or event streaming system. Keep it simple.

### Training Core (Rules Engine)

The deterministic logic for progression rules, pattern detection, and recommendation generation.

**Responsibilities**:
- Implementing the rules defined in `progression-rules-v0.md`
- Querying workout history for pattern inputs
- Producing `ProgressionPattern` and `AdjustmentRecommendation` records
- Applying accepted recommendations to generate new plan versions

**Key design principle**: this should be a pure logic module with clear inputs and outputs, not entangled with HTTP handlers or database queries. It receives data, applies rules, and returns results. The worker or API layer handles persistence.

**Likely structure**:
```
training-core/
  rules/
    rep-completion.ts
    rep-shortfall.ts
    stall-detection.ts
    missed-workouts.ts
    schedule-drift.ts
    deload-triggers.ts
    pain-recurrence.ts
  pattern-detector.ts    # orchestrates rule execution
  recommendation.ts      # generates recommendations from patterns
  types.ts               # shared types for rules input/output
```

---

## Authentication

MVP: email/password with session tokens. No OAuth or social login initially.

Use a proven auth library (e.g., Lucia, Auth.js) rather than rolling custom auth. The auth system is not a differentiator and should be boring.

---

## Deployment (Deferred)

Not needed for initial development. When the time comes:
- Single server or container is fine for MVP.
- Postgres can be managed (Neon, Supabase, RDS) or self-hosted.
- The background worker can run as a separate process on the same machine.
- Static frontend assets can be served from the API server or a CDN.

---

## Module Boundaries

For the initial codebase, the following directory structure keeps concerns separated without over-engineering:

```
setwise/
  docs/                    # this documentation
  apps/
    web/                   # frontend SPA
    api/                   # API server + AI agent module
  packages/
    training-core/         # rules engine, pure logic
    shared/                # shared types, constants
  infra/                   # deployment config (later)
```

This is a monorepo structure. Use a workspace tool (npm/pnpm workspaces, turborepo) to manage dependencies between packages.

---

## Technical Decisions to Make Soon

These don't need to be decided now, but should be before writing significant code:

1. **Language**: TypeScript end-to-end (frontend + API + rules) vs. Python API with TypeScript frontend.
2. **Framework**: specific web framework and ORM.
3. **LLM provider and model**: which API for the consultation agent.
4. **Auth approach**: library choice.
5. **Queue system**: for background workers.
6. **Monorepo tooling**: pnpm workspaces, turborepo, or similar.

The recommendation is TypeScript end-to-end for MVP. It simplifies the stack, allows sharing types between frontend and API, and the rules engine benefits from strong typing. Python is a reasonable alternative if the team has stronger Python experience.
