# Plan Lifecycle

## Overview

A training plan moves through defined states. Plan content is versioned: edits create new versions, and historical data always references the version that was active at the time.

---

## Plan States

```
                    ┌──────────────────┐
                    │   Assessment     │
                    │   completes      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
              ┌────►│     draft        │◄────┐
              │     └────────┬─────────┘     │
              │              │               │
              │         user reviews         │
              │              │               │
              │     ┌────────┴─────────┐     │
              │     │                  │     │
              │     ▼                  ▼     │
     ┌────────────────┐      ┌─────────────────┐
     │   approved     │      │   rejected      │
     └───────┬────────┘      │  (with feedback) │
             │               └────────┬────────┘
             │                        │
             ▼                  revised draft
     ┌──────────────────┐     created (new
     │     active       │     PlanVersion)
     └───────┬──────────┘
             │
             │  (new plan approved
             │   or user archives)
             ▼
     ┌──────────────────┐
     │    archived       │
     └──────────────────┘
```

### State Definitions

| State      | Meaning                                                        |
|------------|----------------------------------------------------------------|
| `draft`    | Plan version exists but has not been reviewed by the user.     |
| `approved` | User has accepted this version. Ready to become active.        |
| `active`   | Currently generating scheduled workouts. Only one plan can be active per user. |
| `archived` | No longer active. Historical sessions still reference it.      |
| `rejected` | User declined this version and provided feedback.              |

### Transitions

| From       | To         | Trigger                                          |
|------------|------------|--------------------------------------------------|
| --         | `draft`    | Assessment completes and generates initial plan.  |
| `draft`    | `approved` | User approves the plan version.                   |
| `draft`    | `rejected` | User rejects with feedback.                       |
| `rejected` | `draft`    | System generates a revised version (new PlanVersion). |
| `approved` | `active`   | Automatic on approval (if no other plan is active), or replaces current active plan. |
| `active`   | `archived` | New plan activated, or user manually archives.    |

---

## Plan Versioning

### Rules

1. Each `TrainingPlan` has one or more `PlanVersion` records.
2. A `PlanVersion` is **immutable** once its status leaves `draft`. Its `structure` JSON is never modified.
3. Rejecting a plan version with feedback creates a **new** `PlanVersion` with an incremented `version_number`. The rejected version is kept for history.
4. Only one `PlanVersion` per plan can be in `draft` or `approved` status at a time.

### Version Numbering

- v1: initial draft from assessment
- v2: revision after user rejected v1
- v3: revision after user rejected v2
- ...and so on.

### What a Version Contains

The `PlanVersion.structure` JSON includes:
- Program name and description
- Training split type (e.g., upper/lower, push/pull/legs, full body)
- Number of training days per week
- List of `WorkoutTemplate` definitions
- Each template's `ExercisePrescription` list
- Weekly schedule mapping (which template on which day)
- Any notes or rationale from the assessment

---

## Scheduled Workout Generation

When a `PlanVersion` becomes active:

1. **Look ahead window**: generate `ScheduledWorkout` records for the next N weeks (default: 4 weeks).
2. **Mapping**: each `WorkoutTemplate` in the plan version is mapped to its assigned day(s) of the week.
3. **Conflicts**: if a scheduled date already has a completed or in-progress session, do not overwrite it.
4. **Rolling generation**: as weeks pass, new scheduled workouts are appended to maintain the look-ahead window. This runs as a background job.

### On Plan Version Change

When a new `PlanVersion` is approved and activated:

- **Past scheduled workouts** (date < today): untouched. They reference the old version.
- **Completed sessions**: untouched. They permanently reference the version that was active when logged.
- **Future scheduled workouts** (date >= today, status = `upcoming`): deleted and regenerated from the new version.
- **In-progress sessions**: allowed to complete under the old version.

This ensures:
- Historical accuracy is preserved.
- The user always sees their current plan going forward.
- No orphaned or inconsistent workout references.

---

## Historical Integrity

### The Version Reference Rule

Every `WorkoutSession` stores a `plan_version_id`. This creates a permanent link between what the user actually did and what the plan said at that time.

This means:
- You can always reconstruct what was prescribed vs. what was performed.
- Plan changes don't retroactively alter historical records.
- Progression analysis can account for plan changes (e.g., "performance improved after switching from v2 to v3").

### Querying Historical Data

To show a past workout:
1. Load the `WorkoutSession` and its `SetLog` records (actual performance).
2. Load the `PlanVersion` referenced by the session (what was prescribed).
3. Display both: prescribed vs. actual.

To analyze trends across plan changes:
1. Group sessions by `plan_version_id`.
2. Within each group, analyze progression normally.
3. Across groups, note version boundaries in trend visualizations.
