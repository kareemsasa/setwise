# Setwise

Adaptive training planner and workout execution tracker.

Setwise turns a user's profile, constraints, goals, schedule, and actual workout performance into a structured training plan with scheduled sessions, consistency tracking, and evidence-based progression recommendations.

## Status

**Phase: Foundation** -- documentation and domain modeling only. No application code yet.

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
  docs/
    product-brief.md        # product thesis, target user, MVP scope
    domain-model.md         # entities, relationships, lifecycle states
    intake-flow.md          # consultation process and structured output
    plan-lifecycle.md       # plan states, versioning, workout generation
    progression-rules-v0.md # deterministic progression and deload rules
    architecture-notes.md   # technical architecture and module boundaries
  README.md
```

## Local Development

No application code exists yet. Next step is selecting a tech stack and scaffolding the initial project structure. See `docs/architecture-notes.md` for the recommended direction.
