# Progression Rules v0

## Overview

These are the initial deterministic rules for detecting patterns and triggering recommendations. They operate on logged workout data and do not require AI. The rules are intentionally conservative -- the default action is to flag a pattern for the user, not to auto-modify the plan.

All thresholds below are starting values. They should be configurable per user or per exercise category as the system matures.

---

## Rule Categories

### 1. Rep Completion

**Scenario**: the user consistently hits or exceeds the prescribed rep range.

**Rule**: if the user completes all prescribed sets at or above `rep_max` for an exercise across N consecutive sessions (default N=2), recommend a weight increase.

**Suggested increase**:
- Upper body compound (bench, overhead press, rows): +2.5 kg
- Lower body compound (squat, deadlift): +2.5-5 kg
- Isolation exercises: +1-2.5 kg

**Output**: `AdjustmentRecommendation` with type `increase_weight`.

---

### 2. Rep Shortfall

**Scenario**: the user consistently falls short of the prescribed rep range.

**Rule**: if `actual_reps < rep_min` on 2+ sets of the same exercise for N consecutive sessions (default N=3), flag a `rep_shortfall` pattern.

**Possible recommendations** (in order of preference):
1. Reduce weight by 5-10% and maintain rep range.
2. Reduce prescribed sets by 1 and maintain weight.
3. Widen the rep range (lower `rep_min`).

**Output**: `ProgressionPattern` (type `rep_shortfall`) + `AdjustmentRecommendation` (type `reduce_weight` or `reduce_volume`).

---

### 3. Stall Detection

**Scenario**: the user is completing sets within the rep range but has not progressed (weight or reps) for an extended period.

**Rule**: if an exercise shows no increase in weight or rep count across N sessions (default N=6), flag a `stall` pattern.

**Possible recommendations**:
1. Programmatic deload (see rule 6).
2. Exercise substitution (swap for a variation).
3. Rep scheme change (e.g., move from 4x10 to 5x5).

**Output**: `ProgressionPattern` (type `stall`) + `AdjustmentRecommendation`.

---

### 4. Missed Workouts

**Scenario**: the user is not attending scheduled sessions.

**Rules**:
- If 2+ scheduled workouts are missed in a rolling 7-day window, flag a `consistency_drop` pattern with severity `warning`.
- If 4+ scheduled workouts are missed in a rolling 14-day window, flag with severity `action_needed`.
- If a specific day-of-week slot is missed 3+ times in 4 weeks, recommend rescheduling that slot.

**Possible recommendations**:
1. Reschedule the problematic slot to a different day/time.
2. Reduce training frequency (e.g., 4 days → 3 days).
3. Prompt the user to confirm their schedule is still accurate.

**Output**: `ProgressionPattern` (type `consistency_drop` or `schedule_drift`) + `AdjustmentRecommendation` (type `reschedule`).

---

### 5. Schedule Drift (Early/Late Clock-Ins)

**Scenario**: the user consistently trains at a different time than scheduled.

**Rule**: if the average `variance_minutes` for a recurring slot exceeds ±30 minutes across N sessions (default N=4), flag a `schedule_drift` pattern.

**Possible recommendations**:
1. Adjust the scheduled time to match actual behavior.
2. Ask the user whether the schedule should change.

**Output**: `ProgressionPattern` (type `schedule_drift`) + `AdjustmentRecommendation` (type `reschedule`).

---

### 6. Deload Triggers

**Scenario**: accumulated fatigue or stalling suggests a recovery period.

**Rules** (any one triggers a deload recommendation):
- Stall detected on 3+ exercises simultaneously.
- Rep shortfall detected on 3+ exercises simultaneously.
- User has trained for N consecutive weeks without a deload (default N=6 for intermediate, N=4 for beginner).
- User reports pain on 2+ exercises in the same session, across 2+ sessions.

**Deload protocol (default)**:
- Reduce working weights by 40-50%.
- Maintain exercise selection and rep ranges.
- Duration: 1 week.
- After deload, resume at pre-deload weights.

**Output**: `AdjustmentRecommendation` (type `deload_week`).

---

### 7. Pain and Discomfort

**Scenario**: the user reports pain during sets.

**Rules**:
- If `pain_reported = true` on any set, surface it in the session summary.
- If the same exercise triggers pain reports across 2+ sessions, flag a `pain_recurrence` pattern with severity `action_needed`.
- If pain is reported on 3+ different exercises in the same body region across 2 sessions, flag with severity `action_needed`.

**Possible recommendations**:
1. Remove or substitute the painful exercise.
2. Reduce weight or range of motion (if applicable).
3. Suggest the user consult a medical professional (always included when severity is `action_needed`).

**The system must not**:
- Diagnose the cause of pain.
- Recommend training through pain.
- Suggest specific rehab exercises.
- Minimize or dismiss reported pain.

**Output**: `ProgressionPattern` (type `pain_recurrence`) + `AdjustmentRecommendation` (type `swap_exercise` or `reduce_weight`).

---

## Rule Execution

### When Rules Run

- **After each session is completed**: check rep completion, rep shortfall, and pain rules for the exercises in that session.
- **Daily (background job)**: check missed workout and schedule drift rules.
- **Weekly (background job)**: check stall detection and deload triggers.

### Rule Priority

When multiple rules fire for the same exercise or time period:
1. Pain rules take highest priority.
2. Deload triggers override individual exercise adjustments.
3. Missed workout rules override progression recommendations (no point recommending a weight increase if the user isn't showing up).

### User Interaction

All recommendations are presented to the user. None are auto-applied. The user can:
- **Accept**: the recommendation is applied to the plan (creating a new `PlanVersion` if it changes plan structure).
- **Dismiss**: the recommendation is marked dismissed and not shown again for the same pattern instance.
- **Ignore**: the recommendation remains visible but is not acted on. It expires after N days (default 14).

---

## Future Considerations

These are not in v0 but are natural extensions:
- Per-exercise progression curves (different rules for compounds vs. isolations).
- Volume landmark tracking (MEV, MAV, MRV per muscle group).
- Periodization-aware rules (different expectations during accumulation vs. deload phases).
- RPE-based auto-regulation (adjust weight based on reported RPE vs. target RPE).
- Session RPE and fatigue scoring.
