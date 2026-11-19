# API Reference — Taf EMS backend

**Base address (development):** `http://localhost:4000/api`
Every example request is also in the Postman collection: `backend/postman/taf-ems.postman_collection.json`.

---

## 1. How requests work

### Logging in and the token
1. `POST /auth/login` with `{ "email": "...", "password": "..." }` returns a **token**.
2. Send it with every other request in the header: `Authorization: Bearer <token>`.
3. A token lasts **8 hours** (`JWT_EXPIRES_IN`). It stops working earlier if the password changes or the account is deactivated.
4. Until a new user changes their temporary password, only `/auth/me`, `/auth/change-password` and `/auth/logout` work;
   everything else answers **403** with `code: "PASSWORD_CHANGE_REQUIRED"`.

### Reply format
Success:
```json
{ "success": true, "data": { ... } }
```
Error:
```json
{
  "success": false,
  "error": {
    "message": "Some fields are missing or invalid.",
    "details": [{ "field": "code", "message": "Code must be 2–20 characters: letters, numbers or hyphens." }],
    "code": "OPTIONAL_MACHINE_READABLE_CODE"
  }
}
```

### Status codes

| Code | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 | The data is missing or invalid (see `details`) |
| 401 | Not logged in, token invalid or expired, account inactive |
| 403 | Logged in, but not allowed (wrong role, another company, not your record…) |
| 404 | Not found |
| 409 | Conflicts with the current state (duplicate, wrong status, period not open…) |
| 413 | Request body larger than 100 KB |
| 429 | Too many requests (`code: "TOO_MANY_REQUESTS"`) |
| 500 | Unexpected server error |

### Lists
Lists accept `?page=1&pageSize=20` (maximum 100) and reply with
`{ "items": [...], "pagination": { "page", "pageSize", "total", "totalPages" } }`.

### Limits
- 1000 requests per 15 minutes per computer (`RATE_LIMIT_MAX`).
- 5 failed logins per email per computer per 15 minutes (`LOGIN_MAX_FAILURES`).

### Roles used below
**H** = Holding user · **H\*** = primary Holding user or a Holding user allowed to approve · **H1** = primary Holding user only ·
**M** = Manager (own company only) · **E** = Employee · **All** = any logged-in user.
The detailed rules (company wall, "only your own", status checks) are enforced by the backend on every request.

---

## 2. Endpoints

### Health
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/health` | Anyone | "The backend is running" |
| GET | `/health/ready` | Anyone | Also checks the database (503 if it is not reachable) |

### Auth — `/auth`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/auth/login` | Anyone | `email`, `password` → `token`, `user` |
| GET | `/auth/me` | All | The logged-in user |
| POST | `/auth/change-password` | All | `currentPassword`, `newPassword` → a new `token` (older tokens stop working) |
| POST | `/auth/logout` | All | Recorded in the audit log; the frontend deletes the token |
| PATCH | `/auth/preferences` | All | `displayCalendar`: ETHIOPIAN or GREGORIAN — how dates are shown to this person (v2) |

### Companies — `/companies`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/companies` | H | `search`, `isActive` |
| GET | `/companies/:id` | H, M (own) | Includes the current Manager and employee count |
| POST | `/companies` | H | `name`, `code`, optional `address`, `phone`, `email` |
| PATCH | `/companies/:id` | H | Any of the fields above |
| PATCH | `/companies/:id/status` | H | `isActive` |

### Managers — `/managers`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/managers` | H | `search`, `isActive`, `assigned`, `companyId` |
| GET | `/managers/:id` | H | Includes the assignment history |
| POST | `/managers` | H | `email`, `temporaryPassword`, `firstName`, `lastName`, `employeeNumber`, `companyId`, optional job details |
| PATCH | `/managers/:id` | H | Profile fields |
| PATCH | `/managers/:id/status` | H | `isActive` |
| PUT | `/managers/:id/assignment` | H | `companyId` — replaces that company's current Manager |
| DELETE | `/managers/:id/assignment` | H | Ends the current assignment (nothing is deleted) |

### Employees — `/employees`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/employees/me` | E | Own profile |
| PATCH | `/employees/me` | E | Only `phone`, `address`, `emergencyContact` |
| GET | `/employees` | H, M | `search`, `employmentStatus`, `department`, `companyId` (H) |
| GET | `/employees/:id` | H, M | |
| POST | `/employees` | H, M | `email`, `temporaryPassword`, `employeeNumber`, `firstName`, `lastName`, `companyId` (H only), optional details |
| PATCH | `/employees/:id` | H, M | Profile fields |
| PATCH | `/employees/:id/status` | H, M | `employmentStatus`: ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED |
| PUT | `/employees/:id/company` | H | `companyId` — transfer |

### Holding users — `/holding-users`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/holding-users` | H | `isActive` |
| GET | `/holding-users/:id` | H | |
| POST | `/holding-users` | H1 | `email`, `temporaryPassword`, optional `canApproveEvaluations` |
| PATCH | `/holding-users/:id/approval-permission` | H1 | `canApproveEvaluations` |
| PATCH | `/holding-users/:id/status` | H1 | `isActive` |

### Evaluation periods — `/evaluation-periods`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/evaluation-periods` | All | `status` |
| GET | `/evaluation-periods/:id` | All | |
| POST | `/evaluation-periods` | H | `name`, `startDate`, `endDate` (YYYY-MM-DD) — starts as UPCOMING |
| PATCH | `/evaluation-periods/:id` | H | Not when CLOSED |
| PATCH | `/evaluation-periods/:id/status` | H | `status`: UPCOMING→OPEN, OPEN→CLOSED, CLOSED→OPEN. Opening needs both criteria lists at 100% |

### Evaluation criteria — `/evaluation-criteria`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/evaluation-criteria` | All | `appliesTo` (EMPLOYEE, MANAGER), `isActive`; reply includes the weight totals |
| GET | `/evaluation-criteria/:id` | All | |
| POST | `/evaluation-criteria` | H | `name`, `appliesTo`, `weight`, optional `description` |
| PATCH | `/evaluation-criteria/:id` | H | `name`, `description`, `weight` |
| PATCH | `/evaluation-criteria/:id/status` | H | `isActive` |

Changes to criteria are refused (409) while any period is OPEN.

### Goals — `/goals`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/goals` | All | `status`, `employeeId`, `periodId`, `companyId` — each role sees only what it may |
| GET | `/goals/:id` | All | Includes the progress history |
| POST | `/goals` | M | `employeeId`, `title`, optional `description`, `objectives`, `kpi`, `targetResult`, `deadline`, `periodId` |
| PATCH | `/goals/:id` | M | Goal fields |
| POST | `/goals/:id/cancel` | M | |
| POST | `/goals/:id/reopen` | M | |
| POST | `/goals/:id/progress` | E (own) | `progressPercent` (0–100), optional `comment` |

### Self-assessments — `/self-assessments`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/self-assessments/mine` | E, M | All my self-assessments |
| GET | `/self-assessments/mine/:periodId` | E, M | Mine for a period, with my goals for that period |
| PUT | `/self-assessments/mine/:periodId` | E, M | `comments` — save a draft (period must be OPEN) |
| POST | `/self-assessments/mine/:periodId/submit` | E, M | At least 20 characters; locks it |
| GET | `/self-assessments` | H, M | Overview: `periodId` (required), `status`, `companyId` — drafts stay private |
| GET | `/self-assessments/:id` | All | Submitted ones, by people allowed to see them; drafts only by the author |

### Evaluations — `/evaluations`
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/evaluations` | All | `periodId`, `companyId`, `employeeId`, `status`, `type` — the person evaluated sees only PUBLISHED ones |
| GET | `/evaluations/:id` | All | Scores, missing criteria, self-assessment and review history (for evaluators and the Holding) |
| POST | `/evaluations` | M (employees), H\* (Managers) | `employeeId`, `periodId` — one per person per period |
| PUT | `/evaluations/:id/scores` | Evaluator | `scores: [{ criterionId, score (1–5), comment? }]` |
| PATCH | `/evaluations/:id` | Evaluator | `feedback`, `recommendations` |
| POST | `/evaluations/:id/submit` | Evaluator | Needs every criterion scored and feedback ≥ 20 characters |
| POST | `/evaluations/:id/approve` | H\* | Optional `comment`; not your own submission (except H1) |
| POST | `/evaluations/:id/return` | H\* | `comment` (≥ 10 characters); period must be OPEN |
| POST | `/evaluations/:id/publish` | H\* | Only APPROVED evaluations |
| POST | `/evaluations/:id/acknowledge` | The person evaluated | Optional `comment`; once, only when PUBLISHED |

**Overall score** = Σ (score ÷ 5 × weight), rounded to 2 decimals. Example: 4, 5, 3, 4 with weights 30, 25, 20, 25 → **81%**.

### Reports — `/reports`
All accept `?periodId=` (default: the most recent open period).

| Method | Path | Who | Contents |
|---|---|---|---|
| GET | `/reports/dashboard` | All | A summary for the user's role |
| GET | `/reports/completion` | H, M (own company) | Per company: to evaluate, not started, in progress, waiting, completed, rate |
| GET | `/reports/companies` | H | Company ranking by average score + whole-Holding numbers |
| GET | `/reports/managers` | H | Per Manager: submitted, on time, returned, team average, own result |
| GET | `/reports/employees/:employeeId` | H; M (own employees); the person (published only) | Evaluation history, summary, goals |

### Settings — `/settings` (version 2)
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/settings` | H | `holdingName`, `cycleCalendar` |
| PATCH | `/settings` | H (primary only) | `cycleCalendar`: ETHIOPIAN or GREGORIAN — the calendar of NEW plan years |

### Plan years — `/plan-years` (version 2)
A plan year ("2019 EFY" = Hamle 1, 2018 → Sene 30, 2019, or "2026 (GC)") has 19 periods: 1 year, 2 halves, 4 quarters, 12 months (Pagume is joined to Nehase).

| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/plan-years` | All | `status`. Without the periods |
| GET | `/plan-years/preview?year=2020` | H | What the year would look like, in the calendar of the settings. Nothing is saved |
| GET | `/plan-years/:id` | All | With `periods`: the tree year → halves → quarters → months |
| POST | `/plan-years` | H | `year` (+ any rule below). Calendar from the settings. Starts as PLANNING. 409 if it exists or overlaps another year |
| PATCH | `/plan-years/:id` | H | Rules, only while PLANNING: `employeeResultsShare`, `managerResultsShare`, `minKpis`, `maxKpis`, `minKpiWeight`, `maxKpiWeight`, `achievementCap`, `minMonthsForRating`, `appealDays`, `planDeadlineDays`, `safetyCapEnabled` |
| PATCH | `/plan-years/:id/status` | H | `status`: PLANNING→ACTIVE (opens the year and every period already started), ACTIVE→PLANNING, ACTIVE→CLOSED (closes all 19), CLOSED→ACTIVE (primary only) |
| PATCH | `/plan-years/:id/months/:periodId/status` | H | `status`: UPCOMING→OPEN, OPEN→CLOSED, CLOSED→OPEN. Only while the year is ACTIVE |
| DELETE | `/plan-years/:id` | H | Only while PLANNING (the 19 periods are deleted with it) |

The old `/evaluation-periods` endpoints list and change version-1 periods only; the periods of a plan year answer 409 there.
Since Module 12, a plan year with plans can no longer go back to PLANNING or be deleted.

### Plans — `/plans` (version 2)
Three levels, in the hierarchy order: **HOLDING** (the group) → **COMPANY** (= the Manager's plan) → **INDIVIDUAL** (one employee). One plan per level per plan year (one per company, one per employee). Every reply to a change returns the whole plan, with `readiness` (what is still missing) and `can` (the buttons this user may use).

| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/plans` | All (scoped) | `planYearId`, `level`, `companyId`, `status`. H: all · M: the Holding plan + own company · E: own ACTIVE plan only |
| GET | `/plans/:id` | Same scope | KPIs with their 12 monthly targets, links up (`parentKpi`) and down (`linkedKpis`, not shown to Managers on the Holding plan) |
| POST | `/plans` | H (HOLDING) · M (COMPANY, own company) · M (INDIVIDUAL, `employeeId` of own team) | `planYearId`, `level`. Not for a Manager himself, not in a CLOSED year. 409 if it exists |
| POST | `/plans/:id/submit` | M (own company plan) | DRAFT/RETURNED → SUBMITTED. Needs the Holding plan ACTIVE and a complete plan |
| POST | `/plans/:id/approve` | H approver | SUBMITTED → ACTIVE (company plans) |
| POST | `/plans/:id/return` | H approver | `comment` (10+ characters). SUBMITTED → RETURNED |
| POST | `/plans/:id/activate` | H approver (Holding plan) · M (employee plan, needs the company plan ACTIVE) | DRAFT/RETURNED → ACTIVE. Needs a complete plan |
| POST | `/plans/:id/acknowledge` | E (own ACTIVE plan) | `comment` (optional). Once |
| DELETE | `/plans/:id` | The writer while DRAFT/RETURNED · primary H while ACTIVE | Not while KPIs of the level below are linked to it |

"Complete" = Holding: at least 1 KPI. Company and employee plans: between `minKpis` and `maxKpis` KPIs, each weighing `minKpiWeight`–`maxKpiWeight` points, all linked to the level above, total = `managerResultsShare` (company) or `employeeResultsShare` (employee); a company plan also needs one KPI in each of the 4 perspectives.

### KPIs — `/kpis` (version 2)
Only the writer of the plan, only while the plan is DRAFT or RETURNED.

| Method | Path | Body / notes |
|---|---|---|
| POST | `/kpis` | `planId`, `perspective` (FINANCIAL, CUSTOMER, INTERNAL_PROCESS, LEARNING_GROWTH), `name`, `description`, `unit`, `direction` (HIGHER_IS_BETTER, LOWER_IS_BETTER, EXACT, ZERO), `aggregation` (SUM, AVERAGE, LAST), `baseline`, `yearTarget`, `weight` (not on the Holding plan), `parentKpiId` (company → a Holding KPI; employee → a KPI of his company's plan). The 12 monthly targets are created automatically |
| PATCH | `/kpis/:id` | Any of the fields above. A new year target, direction or aggregation splits the months again |
| DELETE | `/kpis/:id` | Not while other KPIs are linked to it |
| PUT | `/kpis/:id/months` | `targets`: 12 numbers. SUM: they add up to the year target · AVERAGE: their average is the year target · LAST: the 12th is the year target |

### Audit log — `/audit-logs`
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/audit-logs` | H | `action`, `userId`, `entityType`, `entityId`, `from`, `to` (YYYY-MM-DD). Read only. |
