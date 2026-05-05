# Draft Plan Lifecycle — Design Spec

**Date:** 2026-05-04
**Branch:** feat/draft-plan-lifecycle
**Status:** Approved

---

## Goal

After an assessment exists, the app can create a draft training plan, review it, approve it, or reject it with feedback. Plan generation is deterministic/mock. No scheduled workouts are generated.

## Data Model

### Existing Schema — No Migrations Required

The DB schema already contains everything needed:

- `training_plans`: id, user_id, assessment_id, name, status (draft/approved/active/archived), created_at
- `plan_versions`: id, plan_id, version_number, status (draft/approved/superseded/rejected), structure (JSONB), rejection_feedback, created_at

Plan content lives in `plan_versions.structure`. The `workout_templates` and `exercise_prescriptions` tables are not populated in this slice — the structure JSON is sufficient for review.

### Entity Relationships

```
Assessment (pending|completed)
  └── TrainingPlan (draft → approved)
        └── PlanVersion v1 (draft → approved|rejected)
```

## Assessment Status Gating

There is no background worker to transition assessments from `pending` to `completed`. Mock plan generation stands in for that processing step.

| Assessment Status | Plan Creation | Response |
|-------------------|---------------|----------|
| `pending`         | Allowed       | 201      |
| `completed`       | Allowed       | 201      |
| `processing`      | Blocked       | 409 Conflict |
| `failed`          | Blocked       | 422 Unprocessable Entity |

## API Endpoints

### POST /api/assessments/:assessmentId/plans

Creates a draft training plan from an assessment.

1. Validate `assessmentId` is a UUID.
2. Fetch assessment. 404 if not found.
3. Check assessment status (see gating table above).
4. Check for existing draft: query `training_plans` for this `assessmentId` where a `plan_versions` row has `status = 'draft'`. If found → 409 with the existing plan.
5. Look up the assessment's consultation to get `userId`.
6. Generate mock plan structure from `inputSnapshot`.
7. Insert `training_plans` row (status: draft).
8. Insert `plan_versions` row (version_number: 1, status: draft, structure: generated JSON).
9. Return 201 with the plan and its version.

### GET /api/assessments/:assessmentId/plans

Lists plans created from an assessment.

1. Validate `assessmentId`.
2. Verify assessment exists. 404 if not.
3. Query `training_plans` where `assessment_id` matches.
4. For each plan, join/fetch the latest `plan_versions` row.
5. Return 200 with array of plans + their latest version.

### GET /api/plans/:planId

Fetches a single plan with its latest version.

1. Validate `planId`.
2. Query `training_plans` + latest `plan_versions`.
3. 404 if not found.
4. Return 200.

### POST /api/plans/:planId/approve

Approves the current draft version of a plan.

1. Validate `planId`.
2. Fetch plan. 404 if not found.
3. Fetch latest `plan_versions` row for this plan.
4. If latest version status is not `draft` → 409 Conflict.
5. Update version status → `approved`.
6. Update plan status → `approved`.
7. Return 200 with updated plan + version.

### POST /api/plans/:planId/reject

Rejects the current draft version with feedback.

1. Validate `planId`.
2. Validate request body: `{ feedback: string }` (required, min 1 char).
3. Fetch plan. 404 if not found.
4. Fetch latest `plan_versions` row.
5. If latest version status is not `draft` → 409 Conflict.
6. Update version status → `rejected`, set `rejection_feedback`.
7. Plan status remains `draft` (conceptually still in draft/revision lifecycle).
8. Return 200 with updated plan + version.

No v2 auto-creation in this slice.

## Duplicate/Conflict Behavior

- **One active draft per assessment:** If any `training_plans` for this assessment has a `plan_versions` in `draft` status, return 409.
- **After rejection:** The plan has only rejected versions (no draft version). Creating a new plan from the same assessment is allowed as a new `TrainingPlan` + `PlanVersion` v1, not a revision of the old plan.
- **After approval:** No new draft plan creation is expected. A re-assessment flow is out of scope.

## Mock Plan Generation

A pure function: `generateMockPlan(input: StructuredIntakeOutput) => PlanStructure`

Output shape:

```typescript
{
  goalSummary: string,
  weeklySchedule: {
    daysPerWeek: number,
    sessionLengthMinutes: number,
    sessions: Array<{
      dayOfWeek: string,
      sessionType: string,
      focus: string,
    }>
  },
  safetyNotes: string[],
  progressionRules: string,
  generatedAt: string,
  generationMethod: "deterministic-mock"
}
```

Derived deterministically from the intake fields (goals, schedule, safety flags). No AI calls.

## Validation Schemas

**New:**
- `assessmentPlanParamsSchema` — `{ assessmentId: z.string().uuid() }`
- `planByIdParamsSchema` — `{ planId: z.string().uuid() }`
- `rejectPlanBodySchema` — `{ feedback: z.string().min(1) }`

**Retired:**
- `planReviewSchema` (approve/reject combined) — replaced by separate approve/reject endpoints.

## Route Registration

```typescript
// New route file
app.register(assessmentPlanRoutes, { prefix: "/api/assessments/:assessmentId/plans" });

// Existing stub replaced
app.register(planRoutes, { prefix: "/api/plans" });
```

## Tests

Integration tests in `apps/api/tests/plans.test.ts`:

- POST create draft plan from assessment (201)
- POST create draft — assessment not found (404)
- POST create draft — assessment processing (409)
- POST create draft — assessment failed (422)
- POST create draft — duplicate draft (409)
- POST create draft — after rejection, new plan allowed (201)
- GET list plans for assessment (200)
- GET plan by ID (200)
- GET plan by ID — not found (404)
- POST approve draft plan (200)
- POST approve non-draft plan (409)
- POST reject draft plan with feedback (200)
- POST reject without feedback (400)
- POST reject non-draft plan (409)

## Web

Minimal additions to the intake page flow:
- After assessment submission, show "Create Draft Plan" button.
- On success, display the plan structure and approve/reject controls.
- Keep UI inline on the intake page.

## Out of Scope

- Real AI plan generation
- Scheduled workout creation
- Calendar/workout instance generation
- Plan revision loop (v2 creation)
- Background workers
- Authentication
- Notifications
- Auto-activation of approved plans
