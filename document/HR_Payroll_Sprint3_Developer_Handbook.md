# HR & Payroll Management Platform — Sprint 3 Wave 1 Developer Handbook

Companion to `HR_Payroll_Sprint3_HLD.md`. Covers implementation only for Wave 1
(careers page + candidate portal, calendar integration, polygon geofence, SMS/push
channels, standalone reimbursement). Follows the same `controller → service →
repository`-ish module boundary and requirement-ID-in-comment convention as the
Sprint 1/2 codebase.

## 1. Suggested Build Order

Dependencies between the five Wave 1 items are shallow, but build in this order to
keep each PR reviewable and each migration additive-only:

1. **GEO-10..13 (polygon geofence)** — self-contained, extends an existing module,
   lowest risk. Good first PR to re-establish Sprint 3 conventions.
2. **EXP-09..11 (standalone reimbursement)** — self-contained, extends an existing
   module.
3. **NOTIF-08..13 (SMS/push channels)** — self-contained, extends an existing module.
4. **CAREER-01..10 (careers page + candidate portal)** — new module, biggest surface
   area, introduces the new candidate-auth pattern.
5. **CAL-01..07 (calendar integration)** — depends on (4)'s structured
   `interviewers` field existing on `Interview` before it's meaningful to sync to
   Google Calendar. Build last.

## 2. New/Changed Backend Modules

```
backend/src/modules/geofence/            # existing — extend for polygon shape
backend/src/modules/expenses/            # existing — extend for standalone reimbursement
backend/src/modules/notifications/       # existing — extend for SMS/push channels
backend/src/modules/recruitment/         # existing — extend for calendar integration
backend/src/modules/careers/             # NEW — public careers listing + candidate portal
backend/src/common/notifications/        # NEW — SmsProvider/PushProvider adapters
backend/src/common/auth/requireCandidateAuth.ts  # NEW — candidate JWT middleware
backend/src/common/crypto/tokenCrypto.ts # NEW — AES-256-GCM helper for calendar tokens
```

## 3. Data Model Changes (Prisma)

Every change below is additive (new nullable columns / new tables) except the
`Interview.interviewerNames → interviewers` rename, which ships with a one-time data
migration (comma-split the free-text into `[{name, email: null}]`) rather than a
breaking drop.

```prisma
// --- geofence.prisma delta ---
enum GeofenceShape {
  CIRCLE
  POLYGON
}

model GeofenceZone {
  // ...existing fields...
  shape        GeofenceShape @default(CIRCLE)
  lat          Float?        // now optional — CIRCLE only
  lng          Float?        // now optional — CIRCLE only
  radiusMeters Int?          // now optional — CIRCLE only
  polygon      Json?         // POLYGON only — ordered [{lat,lng}], 3-50 points
}

// --- expenses.prisma delta ---
enum DisbursementMethod {
  BANK_TRANSFER
  CHEQUE
  CASH
  OTHER
}

model ExpenseClaim {
  // ...existing fields...
  disbursementMethod    DisbursementMethod?
  disbursementReference String?
  disbursedAt            DateTime?
  disbursedBy             String?  // User.id
}

// --- notifications.prisma delta ---
model NotificationPreference {
  // ...existing fields...
  smsEnabled  Boolean @default(true)
  pushEnabled Boolean @default(true)
}

model User {
  // ...existing fields...
  phoneNumber String?  // E.164, validated in employees/profile schema
}

model PushSubscription {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, endpoint])
  @@index([userId])
  @@map("push_subscriptions")
}

// --- careers.prisma delta ---
model Organization {
  // ...existing fields...
  careersSlug    String?  @unique
  careersEnabled Boolean  @default(false)
}

enum CandidatePortalStatus {
  ACTIVE
  INACTIVE
}

model CandidatePortalAccount {
  id           String                 @id @default(uuid())
  candidateId  String                 @unique
  passwordHash String
  status       CandidatePortalStatus  @default(ACTIVE)
  lastLoginAt  DateTime?
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

  candidate Candidate @relation(fields: [candidateId], references: [id])

  @@map("candidate_portal_accounts")
}

// --- recruitment.prisma delta (calendar) ---
model CalendarIntegration {
  id                String   @id @default(uuid())
  organizationId    String   @unique
  provider          String   @default("GOOGLE")
  accessTokenEnc    String
  refreshTokenEnc   String
  expiresAt         DateTime
  calendarId        String
  connectedByUserId String
  status            String   @default("ACTIVE")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])

  @@map("calendar_integrations")
}

model Interview {
  // interviewerNames String? — REMOVED, migrated into `interviewers`
  interviewers    Json      // [{ name: string, email: string | null }]
  calendarEventId String?
  // ...rest unchanged...
}
```

Run `npm run prisma:migrate --workspace=backend` per item above (5 separate migrations,
one per numbered build-order step) rather than one giant migration — matches how Sprint
2 shipped one migration per feature area (see the three
`20260907*` migrations already in `backend/prisma/migrations/`).

## 4. GEO-10..13 — Polygon Geofence Zones

**Files touched:**
- `backend/src/modules/geofence/geofence.schema.ts` — Zod: `shape` discriminated union
  (`CIRCLE` requires `lat`/`lng`/`radiusMeters`; `POLYGON` requires `polygon` with
  3–50 `{lat,lng}` entries).
- `backend/src/modules/geofence/geofence.service.ts` — add `pointInPolygon(point,
  polygon): boolean` (ray casting) next to the existing `haversineMeters`. Update the
  `insideAnyZone` check (currently `attendance.service.ts` calling into geofence logic)
  to branch on `zone.shape`.
- `frontend/src/features/geofence/` — new polygon-drawing form alongside the existing
  circle form; add `leaflet` + `react-leaflet` to `frontend/package.json`.

**Test additions** (`geofence.test.ts`): point-in-polygon for convex and concave
polygons, a point on the boundary (define inclusive-boundary behavior explicitly), a
zone list containing both shapes, and the existing circular-zone tests must keep
passing unmodified (regression guard for GEO-10 not breaking GEO-01..09).

## 5. EXP-09..11 — Standalone Reimbursement

**Files touched:**
- `backend/src/modules/expenses/expenses.schema.ts` — new `ReimburseInput`
  (`disbursementMethod`, `disbursementReference`, optional `disbursedAt` default now).
- `backend/src/modules/expenses/expenses.service.ts` — new `reimburseExpenseClaim`:
  guard `status === 'APPROVED'`, guard `payrollItemId === null` (already-paid-via-payroll
  claims can't be double-reimbursed), set the four disbursement fields + status
  `REIMBURSED`, write `AuditLog`, call `emitNotificationEvent` inside the same
  transaction (existing NOTIF-01 pattern).
- `backend/src/modules/expenses/expenses.controller.ts` /
  `expenses.routes.ts` — `POST /expenses/:id/reimburse`, `requireRole("HR_ADMIN",
  "SUPER_ADMIN")` (same gate as claim approval).
- `frontend/src/features/expenses/` — "Mark reimbursed" action on approved claims,
  visible outside any payroll-run context.

**Test additions** (`expenses.test.ts`): reimburse an approved claim with no payroll
run in the period at all (the actual point of this feature); reject reimbursing a
`DRAFT`/`SUBMITTED`/`REJECTED` claim; reject reimbursing a claim that already has a
`payrollItemId`; audit log row is written.

## 6. NOTIF-08..13 — SMS/Push Channels

**Files touched:**
- `backend/src/common/notifications/smsProvider.ts` (new) —
  `SmsProvider` interface + `ConsoleSmsProvider` (mirrors `sendEmailStub` in
  `notification.queue.ts`, moved into its own file since it now has siblings).
- `backend/src/common/notifications/pushProvider.ts` (new) — `PushProvider` interface +
  `ConsolePushProvider`.
- `backend/src/modules/notifications/notification.templates.ts` — add `smsBody` (≤160
  chars) per event type alongside existing `title`/`inAppMessage`/`emailBody`.
- `backend/src/modules/notifications/notification.queue.ts` — `processOneEvent`: after
  the existing in-app-row + email-stub block, loop recipients again for SMS (skip if no
  `phoneNumber` or preference disabled) and push (skip if no active
  `PushSubscription` rows or preference disabled). Same transaction, same
  PROCESSED-only-after-all-channels-attempted contract; a channel-specific send
  failure should be caught per-channel and logged, **not** fail the whole event (a
  missing phone number shouldn't block email/in-app delivery that already succeeded).
- `backend/src/modules/notifications/notifications.controller.ts` /
  `.schema.ts` — extend the preferences PATCH endpoint for `smsEnabled`/`pushEnabled`.
- `backend/src/modules/employees/` — add `phoneNumber` to the profile update schema.
- `frontend/` — service worker registration + push subscription flow (new
  `frontend/src/serviceWorker.ts`), phone number field in profile settings, SMS/push
  toggles next to the existing email toggle in notification preferences.

**Test additions** (`notification.queue.test.ts` or extend existing suite): SMS sent
only when `phoneNumber` present and `smsEnabled`; push sent only to active
subscriptions; a provider throwing doesn't prevent the event from reaching
`PROCESSED` or block other channels; NOTIF-04's no-sensitive-data rule holds for the
new `smsBody` templates (same assertion style as the existing email-body test).

## 7. CAREER-01..10 — Public Careers Page & Candidate Portal

**New module:** `backend/src/modules/careers/`
```
careers.routes.ts       # public + candidate-auth routes, mounted at /api/v1/careers
careers.controller.ts
careers.service.ts
careers.schema.ts
careers.candidateView.ts  # field-filtered serializer for candidate-facing application data
careers.test.ts
```

**New middleware:** `backend/src/common/auth/requireCandidateAuth.ts` — same shape as
`requireAuth.ts` (verify → re-read account status from DB → attach
`req.candidateAuth`), signed with `env.candidateJwtSecret`, distinct from
`env.jwtSecret`. Add a `CandidateAuthContext` type parallel to `AuthContext`; do **not**
add `CANDIDATE` to the existing `AuthContext["role"]` union — keep the two auth systems
structurally incapable of being confused, not just logically separate.

**Routes:**
```
GET  /api/v1/careers/:orgSlug/jobs              # public
GET  /api/v1/careers/:orgSlug/jobs/:jobId       # public
POST /api/v1/careers/:orgSlug/register          # public (creates portal account)
POST /api/v1/careers/:orgSlug/login             # public
GET  /api/v1/candidate-portal/me                # requireCandidateAuth
POST /api/v1/candidate-portal/jobs/:jobId/apply # requireCandidateAuth
GET  /api/v1/candidate-portal/applications      # requireCandidateAuth
GET  /api/v1/candidate-portal/applications/:id  # requireCandidateAuth
```

**Org settings addition:** `organizations.controller.ts`/`.service.ts` — HR Admin sets
`careersSlug`/`careersEnabled` via the existing org settings PATCH endpoint. Validate
slug uniqueness and URL-safe format (`^[a-z0-9-]+$`) in `organizations.schema.ts`.

**Recruitment service reuse:** `careers.service.ts`'s apply flow calls into
`recruitment.service.ts`'s existing `createApplication`-equivalent function rather than
duplicating REC-03's duplicate-check/transaction logic — the portal is a new front
door onto the same service, not a parallel implementation.

**Env additions** (`backend/src/config/env.ts`, `.env.example`):
```
CANDIDATE_JWT_SECRET=      # required in production, same fail-fast pattern as JWT_SECRET
CANDIDATE_JWT_EXPIRES_IN=  # default 8h, mirrors JWT_EXPIRES_IN
```

**Test additions** (`careers.test.ts`): public job listing only returns `OPEN`
postings and only for orgs with `careersEnabled`; public listing never leaks another
org's jobs for a wrong/missing slug; candidate JWT rejected by `requireAuth`/internal
routes and vice versa; candidate can't see another candidate's applications; field
filtering hides interviewer/feedback/salary data from the candidate view; REC-03
duplicate-open-application still enforced when applying via the portal.

## 8. CAL-01..07 — Google Calendar Integration

**Files touched:**
- `backend/src/common/crypto/tokenCrypto.ts` (new) — `encrypt`/`decrypt` using
  AES-256-GCM and `env.calendarTokenEncKey`.
- `backend/src/modules/recruitment/calendarProvider.ts` (new) — `CalendarProvider`
  interface (`createEvent`, `updateEvent`, `cancelEvent`) +
  `GoogleCalendarProvider` implementation (OAuth2 token refresh via
  `refreshTokenEnc`, calls Google Calendar API v3).
- `backend/src/modules/recruitment/recruitment.service.ts` — interview
  create/update/cancel calls the provider when `CalendarIntegration.status === 'ACTIVE'`
  for the org; wrap in try/catch so a Google API failure logs a warning and still
  persists the interview record (per HLD §8).
- `backend/src/modules/organizations/` (or a new `calendarIntegration.controller.ts`
  under recruitment) — OAuth connect/disconnect endpoints
  (`GET /organization/calendar-integration/connect` → redirect to Google consent screen;
  `GET /organization/calendar-integration/callback` → exchange code, store encrypted
  tokens; `DELETE /organization/calendar-integration` → disconnect), `requireRole("HR_ADMIN",
  "SUPER_ADMIN")`.
- `frontend/src/features/recruitment/` — "Connect Google Calendar" button in org
  settings; interview form switches `interviewerNames` free-text input to a structured
  name+email list.

**Env additions:**
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
CALENDAR_TOKEN_ENC_KEY=   # 32-byte key, required only if calendar integration is used
```

**Data migration:** one-time script (or inline migration SQL) converting
`interviewerNames` (`"Alice, Bob"`) into `interviewers` (`[{name:"Alice",email:null},
{name:"Bob",email:null}]`) — emails are unknown for historical rows and stay `null`
(no calendar invite sent for past interviews, which is correct — they already
happened).

**Test additions** (`recruitment.test.ts` + new `calendarProvider.test.ts`): interview
scheduling with no `CalendarIntegration` connected behaves exactly like Sprint 2
(no error, no event); with a connected integration, `createEvent` is called with the
right attendee list; a provider throw doesn't roll back the interview record;
token encryption round-trips.

## 9. Rollout Checklist

- [ ] Migrations applied in the 5-step order from §1, each independently deployable.
- [ ] `.env.example` updated with all new vars from §7/§8; `CANDIDATE_JWT_SECRET` and
      `CALENDAR_TOKEN_ENC_KEY` documented as required-in-production, same as
      `JWT_SECRET`/`CORS_ORIGIN` today.
- [ ] `docker-compose.yml` — no new services required (SMS/push are stubs; calendar is
      an outbound HTTPS call, not a new container).
- [ ] Existing Sprint 1/2 test suites pass unmodified (regression guard — nothing in
      Wave 1 should require touching attendance/payroll/leave logic).
- [ ] Manual smoke test: circular geofence check-in still works; a payroll-cycle
      expense reimbursement still works; an HR-entered (non-portal) candidate
      application still works.
