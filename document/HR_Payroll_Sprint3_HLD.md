# HR & Payroll Management Platform — Sprint 3 High-Level Design

**Scope:** Sprint 3 = **Wave 1** of a larger four-wave roadmap (see Appendix A). This
document gives full design detail for Wave 1 and a lighter directional sketch for Waves
2–3 so the whole roadmap is on record before Wave 1 implementation starts.

| | |
|---|---|
| Status | Draft — pending sign-off before implementation |
| Builds on | Sprint 1 MVP + Sprint 2 (geofenced attendance, expenses, notifications, recruitment/ATS) |
| Author | Generated with Claude Code, reviewed by knakhantnyiaung-bot |

---

## 1. Goals

Sprint 3 Wave 1 extends two Sprint 2 areas that were deliberately scoped narrow at the
time:

1. **Recruitment expansion** — Sprint 2's ATS was HR/recruiter-entered only ("REC-01 —
   no public intake endpoint"). Wave 1 opens a public careers page, gives candidates a
   self-service portal with their own login, and replaces free-text interviewer names
   with real Google Calendar events.
2. **Attendance/Ops hardening** — Sprint 2 shipped circular geofences only and an
   email-stub-only notification channel; expense reimbursement was payroll-cycle-only.
   Wave 1 adds polygon zones, SMS/push channels, and reimbursement outside the payroll
   cycle.

Waves 2 and 3 (People development; Finance/AI) are intentionally **not** detailed here —
seeAppendix A — because their designs depend on decisions (performance review cycle
shape, LMS content model, actual bank rail, AI agent action surface) that are better made
once Wave 1's patterns (candidate identity, adapter-based channels, disbursement
records) exist as precedent to build on.

## 2. Roadmap & Phasing

| Wave | Working title | Contents | Depends on |
|---|---|---|---|
| **1 (this doc)** | Sprint 3 | Careers page + candidate portal, calendar integration, polygon geofence, SMS/push channels, standalone reimbursement | Sprint 2 |
| 2 | Sprint 4 (proposed) | Performance/KPI reviews, Learning Management (LMS), Asset management | Wave 1 (org/employee data only — no hard dependency) |
| 3 | Sprint 5 (proposed) | Bank disbursement integration, AI HR agent | Wave 1's disbursement-record model (§7) and notification adapters (§6) are direct building blocks |

Each wave ships as an independently deployable, independently tested increment —
matching how Sprint 1 and Sprint 2 were sized (Sprint 2 added 4 modules; Wave 1 below is
comparable in size, not the full 9-item wishlist at once).

## 3. Cross-Cutting Decisions

These apply across all of Wave 1 and were confirmed with the product owner before design:

- **Candidate identity is fully separate from internal auth.** Candidates get their own
  login (email/password), a distinct JWT (own secret, own claim shape), and their own
  auth middleware. A candidate token must never satisfy `requireAuth`/`requireRole` —
  internal RBAC (`SUPER_ADMIN`/`HR_ADMIN`/`HIRING_MANAGER`/`EMPLOYEE`) is untouched. This
  avoids the alternative (a `CANDIDATE` `UserRole`) which would force every internal
  authorization check to reason about a role with no organization-employee relationship.
- **External integrations are adapter-shaped, mirroring `StorageAdapter`
  (`backend/src/common/storage/storageAdapter.ts`).** SMS and push ship with a
  console-log stub provider in Wave 1 (no vendor account needed to build/test/demo);
  swapping in Twilio/web-push later is a provider-implementation change only, no caller
  changes. Google Calendar is the one exception — the product owner chose a named vendor
  up front (Google Calendar only, no Outlook, no generic ICS fallback), so it ships
  as a real integration behind a `CalendarProvider` interface (same seam, just one real
  implementation instead of a stub).
- **New geofence shape is additive, not a migration.** Existing circular zones keep
  working unmodified; polygon is a second shape option per zone.
- **Standalone reimbursement reuses the existing `ExpenseClaim`/`REIMBURSED` state**
  instead of a parallel model — it adds a second path to the same terminal state
  (manual disbursement vs. payroll-run disbursement), which is also what makes it the
  natural foundation for Wave 3's bank disbursement integration.

## 4. Feature Design — 4.1 Public Careers Page & Candidate Self-Service Portal

**Requirement IDs:** `CAREER-01`..`CAREER-10` (new series), extends `REC-01`.

### 4.1.1 Public surface (no auth)

- Each `Organization` gets an optional unique `careersSlug` (set by HR Admin in org
  settings). Public careers URLs are slug-scoped:
  `GET /api/v1/careers/:orgSlug/jobs` → `OPEN` job postings only (title, department,
  employment type, openings — never salary bands or internal fields).
  `GET /api/v1/careers/:orgSlug/jobs/:jobId` → job detail.
  An org with no `careersSlug` set has no public page (404) — opt-in, not automatic,
  so Sprint 2 orgs aren't unexpectedly exposed.
- Every public query resolves `organizationId` **from the slug on the server side**;
  the client never supplies an org id directly. This is the same tenancy-isolation
  discipline as every authenticated route, just anchored on slug instead of JWT.
- Rate-limited (`express-rate-limit`, already a dependency) more aggressively than
  authenticated routes — this is the one truly public, unauthenticated surface in the
  system.

### 4.1.2 Candidate portal (candidate auth)

New `CandidatePortalAccount` (1:1 with `Candidate`) holds `passwordHash`, `status`,
`lastLoginAt`. A `Candidate` row can exist without a portal account (Sprint 2's
HR-entered candidates stay valid) — the account is created the first time someone
registers through the public flow.

- `POST /careers/:orgSlug/register` — creates `Candidate` + `CandidatePortalAccount`
  scoped to the resolved org. Duplicate email within an org reuses the existing
  candidate record rather than creating a second one (keeps REC-03's
  duplicate-open-application rule meaningful).
- `POST /careers/:orgSlug/login` — issues a **candidate JWT**, signed with a dedicated
  `CANDIDATE_JWT_SECRET` (not `JWT_SECRET`), claim shape `{ candidateId,
  organizationId, typ: "candidate" }`.
- `requireCandidateAuth` middleware (new, parallel to `requireAuth`) verifies against
  the candidate secret and re-reads `CandidatePortalAccount.status` on every request —
  same freshness rationale as `requireAuth`'s AUTH-05 note (a deactivated candidate
  account stops working on its very next call).
- Authenticated candidate-portal routes (`/api/v1/candidate-portal/*`):
  - `GET /me`
  - `POST /jobs/:jobId/apply` — creates a `CandidateApplication` (`APPLIED` stage).
    Reuses `multerConfig`/`storageAdapter` for optional resume upload, same pattern as
    Sprint 2 expense receipts.
  - `GET /applications` / `GET /applications/:id` — candidate's own applications,
    **field-filtered**: stage, scheduled interview date/time/mode are visible;
    interviewer identities, interview feedback/score, hiring-manager assignment, and
    offer details beyond status are not. This filtering lives in a dedicated
    serializer (`recruitment.candidateView.ts`) so the internal recruitment service
    doesn't grow a "if requester is a candidate" branch.
- Duplicate-open-application (REC-03) and single-active-offer (REC-05) checks already
  live in `recruitment.service.ts` and apply unchanged — a portal-submitted application
  goes through the same service function as an HR-entered one.

### 4.1.3 Data model delta

```
Organization
  + careersSlug   String?  @unique
  + careersEnabled Boolean @default(false)

Candidate
  + portalAccount CandidatePortalAccount?

model CandidatePortalAccount {
  id             String    @id @default(uuid())
  candidateId    String    @unique
  passwordHash   String
  status         CandidatePortalStatus @default(ACTIVE)  // ACTIVE | INACTIVE
  lastLoginAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
```

### 4.1.4 Explicit non-goals (Wave 1)

- No email verification / password reset flow for candidates — the codebase has no such
  flow for internal users either today; adding one is a standalone follow-up, not
  blocking for a Wave 1 demo. Documented as a known gap, not silently skipped.
- No CAPTCHA/bot mitigation beyond rate limiting.
- No candidate-initiated interview self-scheduling (candidate sees the scheduled slot;
  picking from open slots is a Wave-2-or-later idea if the product owner wants it).

## 5. Feature Design — 4.2 Polygon Geofence Zones

**Requirement IDs:** `GEO-10`..`GEO-13` (continues Sprint 2's `GEO-01..09`).

- `GeofenceZone` gains a `shape` enum (`CIRCLE` default, `POLYGON`). `lat`/`lng`/
  `radiusMeters` become nullable (used only for `CIRCLE`); a new `polygon Json?` holds
  an ordered array of `{ lat, lng }` vertices (3–50 points — upper bound to keep the
  payload and the containment check bounded).
- Conditional-field validity (radius fields required for `CIRCLE`, `polygon` required
  for `POLYGON`) is enforced in the Zod schema + service layer, not a DB constraint —
  same choice Sprint 2 made for REC-03/REC-05 rather than a partial unique index.
- Containment check: point-in-polygon via ray casting, added next to the existing
  `haversineMeters` in `geofence.service.ts`. The Sprint 2 attendance check
  (`insideAnyZone`) branches on `zone.shape` instead of assuming circular.
- Existing circular zones require **no migration** beyond adding the new nullable
  columns with `shape` backfilled to `'CIRCLE'`.
- Frontend: geofence settings screen gains a polygon-drawing mode using
  `react-leaflet` + OpenStreetMap tiles (no API key required, new frontend dependency).
  Circle zones keep their existing form UI unchanged.

## 6. Feature Design — 4.3 SMS & Push Notification Channels

**Requirement IDs:** `NOTIF-08`..`NOTIF-13` (continues Sprint 2's `NOTIF-01..07`).

- New `NotificationPreference` columns `smsEnabled`, `pushEnabled` (booleans, same
  per-user/per-event-type shape as the existing `emailEnabled`; in-app stays
  always-on per NOTIF-05's existing rule).
- `User` gains `phoneNumber String?` (E.164 format, validated) as the SMS delivery
  target — there is currently no phone number field anywhere on `User`.
- New `PushSubscription` model (`userId`, `endpoint`, `p256dh`, `auth`, `createdAt`) —
  standard Web Push subscription shape. Push means **browser web push**, not a native
  mobile push — there's no mobile app in this codebase, only the Vite SPA.
- Two new adapter interfaces under `backend/src/common/notifications/`, same pattern
  as `StorageAdapter`:
  ```
  interface SmsProvider { send(toPhoneE164: string, body: string): Promise<void> }
  interface PushProvider { send(subscription: PushSubscriptionRecord, title: string, body: string): Promise<void> }
  ```
  Wave 1 ships `ConsoleSmsProvider`/`ConsolePushProvider` (log-and-return, same idea as
  today's `sendEmailStub`). A real SMS vendor (Twilio, etc.) or the `web-push` npm
  package (VAPID keys, no paid vendor account needed) can replace these later without
  touching `notification.queue.ts`'s dispatch logic.
- `notification.queue.ts`'s `processOneEvent` extends the existing per-recipient loop:
  after the email-stub call, it also calls the SMS/push providers when the
  corresponding preference is enabled and a delivery target exists (phone number /
  active subscription). Same transaction, same idempotency guarantee (NOTIF-03) —
  channel fan-out doesn't change the retry/backoff contract in Appendix C.
- `notification.templates.ts` gains a per-event `smsBody` (≤160 chars) alongside the
  existing `title`/`inAppMessage`/`emailBody` — same content-safety rule as NOTIF-04
  (link/reference only, never salary/expense amounts or GPS coordinates in the body).

## 7. Feature Design — 4.4 Standalone Reimbursement

**Requirement IDs:** `EXP-09`..`EXP-11` (continues Sprint 2's `EXP-01..08`).

- `ExpenseClaim` gains four nullable columns: `disbursementMethod`
  (`BANK_TRANSFER`/`CHEQUE`/`CASH`/`OTHER`), `disbursementReference`, `disbursedAt`,
  `disbursedBy` (the recording `User.id`).
- New action `POST /expenses/:id/reimburse` (HR Admin/Super Admin only, same role gate
  as the rest of expense administration): allowed once a claim is `APPROVED`,
  regardless of whether a payroll run exists for the period. Sets the four fields above
  and moves status to `REIMBURSED` directly — no payroll run involved.
- The existing payroll-cycle reimbursement path (`payrollItemId` set during payroll
  calculation) is untouched and remains available. The two paths are mutually
  exclusive on a given claim, enforced in the service: a claim reimbursed standalone
  can never also be attached to a `PayrollItem`, and vice versa.
- Emits the existing notification-event mechanism to the employee
  ("your expense claim has been reimbursed") — link-only body, no amount, per NOTIF-04.
- Recorded in `AuditLog` like every other state-changing expense action.
- This is deliberately the shape Wave 3's bank disbursement integration will plug into:
  `disbursementMethod`/`disbursementReference` today are HR-admin-typed strings; Wave 3
  adds an automated path that fills the same columns from a real bank API response
  instead of manual entry. No schema rework needed when that lands.

## 8. Feature Design — 4.5 Google Calendar Integration for Interviews

**Requirement IDs:** `CAL-01`..`CAL-07` (new series).

- **Org-level connection**, not per-interviewer: one HR Admin authorizes a single
  Google account/calendar (e.g. a shared `recruiting@` calendar) via OAuth2 once per
  org. This avoids requiring every interviewer to individually grant OAuth access,
  which would be a much larger Wave-1 scope increase for marginal benefit.
- New `CalendarIntegration` model (`organizationId` unique, `provider: "GOOGLE"`,
  encrypted `accessToken`/`refreshToken`, `expiresAt`, `calendarId`,
  `connectedByUserId`, `status`). Tokens are encrypted at rest (AES-256-GCM, key from
  a new `CALENDAR_TOKEN_ENC_KEY` env var) — the first at-rest secret encryption in this
  codebase (passwords use bcrypt hashing, which is one-way and doesn't apply here since
  the raw token must be recoverable to call the Google API).
- `Interview` changes: `interviewerNames` (free-text, Sprint 2) is replaced by a
  structured `interviewers Json` list of `{ name, email }`, and a new
  `calendarEventId String?` tracks the created Google Calendar event for
  update/cancel.
- `CalendarProvider` interface (`createEvent`, `updateEvent`, `cancelEvent`) with
  `GoogleCalendarProvider` as the sole implementation — kept behind an interface for
  testability even though Wave 1 ships only one provider (per the product owner's
  choice of Google-only, no Outlook/ICS fallback).
- Interview create/reschedule/cancel in `recruitment.service.ts` calls the provider
  synchronously in the same request (not the notification outbox) — a failed calendar
  call surfaces immediately to the HR Admin scheduling the interview rather than
  failing silently later; the interview record itself is still saved even if the
  calendar call fails, with the failure surfaced as a warning (never lose the interview
  because Google was briefly unavailable).
- If `CalendarIntegration` isn't connected for an org, interview scheduling degrades to
  Sprint 2's current behavior (no calendar event, structured interviewer list still
  used) rather than blocking.

## 9. Non-Functional Requirements

- **Tenancy isolation:** every new public/candidate endpoint resolves
  `organizationId` server-side (via slug or candidate JWT), never from client input —
  same discipline as every existing authenticated route.
- **Secret isolation:** candidate JWTs use a distinct secret from internal JWTs by
  design, not just a claim check, so a bug in claim validation can't cross-authenticate.
- **Backward compatibility:** no Wave 1 change requires migrating or invalidating
  existing Sprint 2 data (circular zones, payroll-cycle reimbursements, free-text
  interviewer names get a one-time data migration into the new structured field, not a
  breaking rename).
- **Testing:** each new capability follows the existing `*.test.ts` (vitest +
  supertest) convention, module-scoped, same as `geofence.test.ts`/`expenses.test.ts`.

## 10. Explicit Out of Scope (Wave 1)

- Everything in Appendix A's Wave 2/3 (Performance/KPI, LMS, asset management, bank
  disbursement, AI HR agent).
- Outlook/Microsoft 365 calendar support, ICS fallback.
- Real SMS/push vendor wiring (ships as console-log stubs behind the adapter).
- Candidate email verification / password reset.
- Per-interviewer (vs. org-level) calendar connections.

## 11. Open Questions for Sign-Off

1. Confirm the org-level (shared calendar) model for §8 is acceptable, vs. wanting
   per-interviewer connections later.
2. Confirm no email verification for candidate signup is acceptable for Wave 1 (flagged
   as a known gap either way).
3. Confirm `react-leaflet`/OpenStreetMap is acceptable as a new frontend dependency for
   polygon drawing (no paid mapping vendor).

---

## Appendix A — Wave 2 & Wave 3 Roadmap Sketch (not detailed design)

### Wave 2 — People Development (proposed Sprint 4)

| Item | Sketch |
|---|---|
| Performance/KPI | Review cycles (self/manager), goal-setting tied to `Employee`, rating scales. Needs its own workflow-state design (cycle open/close, escalation) — deliberately not designed here. |
| Learning Management (LMS) | Course catalog + completion tracking against `Employee`. Open question for that wave's HLD: host content in-app vs. link out to an external LMS/SCORM package. |
| Asset Management | Company asset register, assignment/return workflow against `Employee`, audit trail via the existing `AuditLog` pattern. |

### Wave 3 — Finance/AI (proposed Sprint 5)

| Item | Sketch |
|---|---|
| Bank disbursement integration | Automates the `disbursementMethod`/`disbursementReference` fields added in §7 (and extends to payroll-run payouts) from a real bank/payment-aggregator API instead of manual entry. Vendor/rail choice (local bank API vs. aggregator) is an open question for that wave. |
| AI HR agent | Scope (read-only Q&A over existing employee/leave/payslip data vs. agentic write actions) needs its own product decision before an HLD is written — high blast-radius if given write access, so that wave's design should start narrow (read-only) regardless of eventual ambition. |

Both are scheduled last because they benefit most from Wave 1's precedents: Wave 3's
disbursement automation extends §7's schema; a bank/AI HLD gets to reuse the
adapter-interface pattern already proven in §6 and in `StorageAdapter`.
