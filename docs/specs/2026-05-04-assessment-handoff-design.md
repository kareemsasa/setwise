# Assessment Handoff Slice - Design Spec

## Context

After a structured consultation is completed, the app creates an assessment record representing the background review step that will eventually produce a draft training plan. For now, no real plan generation occurs — the assessment is a status/handoff record only.

Current flow: Profile -> completed consultation -> **assessment handoff** -> (later: draft plan generation)

## Routes

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/consultations/:consultationId/assessments` | Create assessment from completed consultation |
| GET | `/api/consultations/:consultationId/assessments` | List assessments for a consultation |
| GET | `/api/assessments/:assessmentId` | Fetch single assessment by ID |

Creation and listing are nested under the consultation (parent relationship). Single fetch uses the top-level assessment resource (no parent context needed).

## Domain / Validation

No changes to domain types or enums — `Assessment` entity and `AssessmentStatus` enum (`pending | processing | completed | failed`) already exist in `packages/domain`.

Add `createAssessmentParamsSchema` to `packages/validation` to validate UUID route params.

## Database

No schema or migration changes needed. The `assessments` table already exists with:
- `id` (UUID, PK)
- `consultation_id` (FK -> consultations)
- `status` (enum, default: pending)
- `input_snapshot` (JSONB, NOT NULL)
- `result` (JSONB, nullable)
- `created_at`, `completed_at`

## POST /api/consultations/:consultationId/assessments

1. Validate `consultationId` is a UUID (route param).
2. Fetch consultation by ID. Return **404** if not found.
3. Check `consultation.status === 'completed'`. Return **422** if not.
4. Query for existing assessment where `consultationId` matches and status is `pending` or `processing`. Return **409 Conflict** with the existing assessment if found.
5. Copy `consultation.structuredOutput` as `inputSnapshot`.
6. Insert assessment with `status: 'pending'`.
7. Return **201** with the created assessment.

## GET /api/consultations/:consultationId/assessments

1. Validate `consultationId` is UUID.
2. Verify consultation exists. Return **404** if not.
3. Return all assessments for that consultation, ordered by `createdAt` desc.

## GET /api/assessments/:assessmentId

1. Validate `assessmentId` is UUID.
2. Fetch assessment by ID. Return **404** if not found.
3. Return the assessment.

## Duplicate Handling

One pending/processing assessment per consultation at a time:
- If an active assessment exists (`pending` or `processing`), POST returns 409 with the existing record.
- If all previous assessments are `completed` or `failed`, a new assessment is allowed.
- This prevents accidental duplicates while supporting retry/re-assessment.

## Web

On the intake completion screen, add a "Submit for Assessment" button:
- POST to `/api/consultations/:consultationId/assessments`
- On 201: show assessment status (pending)
- On 409: show message that an assessment is already in progress
- No polling, no progress UI

## Tests

Integration tests:
- Create assessment from completed consultation (happy path)
- 404 for missing consultation
- 422 for non-completed consultation
- 409 for duplicate pending assessment
- Allow new assessment after previous one failed
- List assessments for a consultation
- Fetch single assessment by ID

## Out of Scope

- No real AI assessment or plan generation
- No background worker
- No auth
- No notifications
- No processing/progress UI
