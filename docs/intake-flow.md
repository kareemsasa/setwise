# Intake Flow

## Overview

The intake flow has two phases:
1. **Profile setup** -- a short form collecting baseline data.
2. **AI consultation** -- a guided conversation that produces structured output for plan generation.

---

## Phase 1: Profile Setup

A standard form. No AI involved.

**Required fields:**
- Name
- Email
- Height (cm or ft/in, stored as cm)
- Weight (kg or lb, stored as kg)
- Date of birth
- Biological sex (male/female -- used for baseline strength calculations, not identity)
- Training experience level (beginner / intermediate / advanced)

This creates a `UserProfile` record and unlocks the consultation.

---

## Phase 2: AI Consultation

### Goals

The consultation is a conversational agent session. Its purpose is to understand the user's real situation well enough to generate a useful training plan. It should:

- Ask targeted questions, not run through a fixed checklist.
- Follow up on important details (e.g., "you mentioned knee pain -- which knee? when does it hurt? during what movements?").
- Be direct and practical, not overly enthusiastic.
- Explain why it's asking something if the user seems uncertain.
- Respect the user's time -- a typical consultation should take 5-15 minutes.

### Question Categories

The agent should cover these areas, adapting order and depth to the conversation:

#### Injuries and Restrictions
- Current injuries or pain (location, severity, triggers)
- Past injuries that still affect training
- Medical conditions that limit activity
- Movements or positions to avoid

#### Equipment and Location
- Where the user trains (home, commercial gym, outdoor, etc.)
- Available equipment (barbell, dumbbells, machines, pull-up bar, etc.)
- Any equipment limitations (e.g., max dumbbell weight, no squat rack)

#### Goals
- Primary goal (strength, muscle growth, endurance, general fitness, sport-specific)
- Secondary goals if any
- Specific targets (e.g., "bench press 225 lb", "run a 5K", "lose 20 lb")
- Timeline expectations (if any)

#### Schedule and Availability
- How many days per week the user can train
- Which days are available
- Preferred time of day
- Session length preference or constraint
- Upcoming disruptions (travel, busy periods)

#### Training History
- How long the user has been training
- Recent program or routine (if any)
- Exercises they're familiar with
- Recent working weights for key lifts (if applicable)
- What has and hasn't worked in the past

#### Preferences
- Exercise likes and dislikes
- Training style preferences (e.g., supersets, straight sets, circuits)
- How the user feels about cardio
- Any other constraints or preferences

### Conversation Boundaries

The agent must not:
- Diagnose injuries or medical conditions.
- Recommend that the user train through pain.
- Provide nutrition or supplement advice.
- Promise specific physical outcomes or timelines.
- Minimize reported pain or restrictions.

The agent should:
- Suggest the user consult a medical professional if they describe undiagnosed pain or concerning symptoms.
- Treat all reported restrictions as hard constraints unless the user explicitly says otherwise.
- Note uncertainty (e.g., "user is unsure if overhead pressing causes shoulder pain -- treat as restricted until confirmed").

---

## Structured Intake Output

When the consultation is complete, the agent produces a structured output document. This is the input for the assessment/plan generation step. It is not shown to the user directly (though the user can review their consultation transcript).

### Schema

```json
{
  "consultation_id": "uuid",
  "user_id": "uuid",
  "completed_at": "datetime",

  "injuries_and_restrictions": [
    {
      "area": "string",
      "description": "string",
      "severity": "mild | moderate | severe",
      "affected_movements": ["string"],
      "is_diagnosed": true,
      "professional_consulted": true,
      "notes": "string"
    }
  ],

  "equipment": {
    "location": "home_gym | commercial_gym | outdoor | mixed | other",
    "location_notes": "string",
    "available_equipment": ["string"],
    "equipment_limitations": "string"
  },

  "goals": {
    "primary_goal": "strength | hypertrophy | endurance | general_fitness | sport_specific",
    "secondary_goals": ["string"],
    "specific_targets": ["string"],
    "timeline": "string"
  },

  "schedule": {
    "days_per_week": 4,
    "available_days": ["monday", "tuesday", "thursday", "friday"],
    "preferred_time": "morning | afternoon | evening | no_preference",
    "session_length_minutes": 60,
    "upcoming_disruptions": "string"
  },

  "training_history": {
    "experience_duration": "string",
    "recent_program": "string",
    "familiar_exercises": ["string"],
    "recent_working_weights": [
      {
        "exercise": "string",
        "weight_kg": 0,
        "reps": 0,
        "notes": "string"
      }
    ],
    "past_observations": "string"
  },

  "preferences": {
    "liked_exercises": ["string"],
    "disliked_exercises": ["string"],
    "training_style": "string",
    "cardio_preference": "string",
    "other_notes": "string"
  },

  "safety_flags": [
    {
      "flag": "string",
      "recommendation": "string"
    }
  ],

  "agent_notes": "string"
}
```

### Safety Flags

The `safety_flags` array captures anything the agent thinks warrants caution. Examples:

- `{ "flag": "Undiagnosed sharp knee pain during squats", "recommendation": "Exclude knee-dominant movements until user consults a professional" }`
- `{ "flag": "User reports chest tightness during exertion", "recommendation": "Advise medical clearance before starting program" }`

Safety flags are surfaced during plan generation and may block or constrain the plan.

---

## Post-Consultation

After the consultation completes:
1. The `Consultation` record is marked `completed`.
2. The `structured_output` JSON is saved.
3. An `Assessment` record is created with status `pending`.
4. The assessment process runs asynchronously (see `plan-lifecycle.md`).
5. The user sees a "plan is being generated" state and is notified when the draft is ready for review.
