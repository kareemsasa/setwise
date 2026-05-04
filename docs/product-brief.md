# Product Brief

## Product Thesis

Most people who want to train consistently fail not because they lack motivation, but because they lack structure. They don't know what to do, how hard to push, or when to adjust. Generic programs don't account for real constraints -- injuries, limited equipment, irregular schedules, shifting goals.

Setwise is a system that produces and maintains a personalized training plan through structured intake, deterministic progression rules, and evidence-based adjustments. AI handles the conversational parts (intake, explanation, review). The training logic is explicit and auditable.

## Target User

- Someone who wants to follow a structured training program but doesn't want to (or can't afford to) hire a coach.
- Has some training experience or is willing to learn.
- Trains in a home gym, commercial gym, or with limited equipment.
- Wants accountability and clarity, not gamification or social features.

## Non-Goals

- **Not a social platform.** No feeds, leaderboards, or community features.
- **Not a fitness encyclopedia.** Exercise libraries are a means to an end, not the product.
- **Not a medical tool.** The app does not diagnose injuries, prescribe rehab, or replace professional advice.
- **Not an AI chatbot product.** AI is a tool within the system, not the interface layer for everything.
- **Not a wearable integration platform (yet).** Heart rate, sleep, and recovery data are out of MVP scope.

## Core Workflow

### 1. Profile Creation
User provides basic stats: name, height, weight, age, biological sex (for baseline calculations), training experience level.

### 2. AI Consultation
A guided conversation collects:
- Current injuries, pain, or movement restrictions
- Available equipment and training location
- Goals (strength, hypertrophy, endurance, general fitness, sport-specific)
- Preferred training frequency and session length
- Schedule constraints (days, times, commitments)
- Training history and past programs
- Preferences (exercise likes/dislikes, training style)

The consultation produces a structured output document, not a free-text summary.

### 3. Assessment and Plan Generation
A background process takes the structured consultation output and generates:
- A draft training plan (program structure, split, exercise selection, rep/set schemes)
- A weekly schedule mapped to the user's availability

### 4. Plan Review
The user reviews the draft. They can:
- Approve it as-is
- Reject it with specific feedback (triggers a revised draft)

### 5. Workout Execution
Once approved:
- Workout slots appear on a calendar
- Each session shows prescribed exercises, sets, reps, and weights
- The user clocks in, logs actual performance, and clocks out
- Timing variance (early/late/missed) is tracked

### 6. Analysis and Adjustment
Over time:
- The system detects patterns in logged data (missed reps, stalled weights, schedule drift)
- Deterministic rules trigger recommendations (deload, volume reduction, schedule change)
- The user can accept or ignore recommendations

## MVP Scope

The first usable version includes:
- Profile creation
- AI consultation (single session)
- Plan generation from consultation output
- Plan review and approval
- Calendar with scheduled workouts
- Workout session logging (exercises, sets, reps, weight)
- Clock-in/clock-out with timing tracking
- Basic attendance tracking (completed, missed, partial)
- Simple progression rules (rep completion, missed sessions)
- Adjustment recommendations (displayed, not auto-applied)

## Out of MVP Scope

- Multiple active plans or plan switching
- Exercise video or form guidance
- Nutrition tracking
- Wearable or health app integrations
- Multi-user or coach/client features
- Mobile native app (web-first, responsive)
- Detailed analytics dashboards
- Export/import of plans or data
