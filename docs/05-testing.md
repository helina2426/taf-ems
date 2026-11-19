# Phase 9 — Testing

**Rule we follow:** a test only counts as passed when it has actually been run and passed.
The results below are from real runs; re-run them before every demo or hand-over.

---

## 1. Three kinds of tests

| Kind | What it checks | Tool | How to run | Size |
|---|---|---|---|---|
| **Unit tests (backend)** | Small pieces on their own: the score formula, validation rules, passwords, tokens | Node's built-in test runner (`node --test`) — nothing to install | `cd backend && npm run test:unit` | 81 tests |
| **Unit tests (frontend)** | The display helpers and the rules that decide which buttons to show | `node --test` | `cd frontend && npm test` | 32 tests |
| **API tests** | Every endpoint, every role, every business rule, security (401/403/409/429…) | Postman collection, run by Newman | `cd backend && npm run test:api` | 538 requests, 735 checks |
| **Manual tests (UI)** | The screens, for each role | A person, with the checklist in section 4 | — | 3 roles |

**Why so many API tests and so few unit tests?** Most of our rules (the company wall, who may approve, one evaluation per person and period…) live in the services and depend on the database. The API tests check them exactly as a real user would hit them, including the database. Unit tests are used where a piece of logic can be checked alone.

---

## 2. The test database

The API tests create records every time they run (test companies, managers, employees…). To keep the demo data clean, they use their **own** database:

| Database | Used by | Content |
|---|---|---|
| `taf_ems_dev` | You, the browser and the normal server (port 4000) | Demo data you click around in |
| `taf_ems_test` | `npm run test:api` and its own server (port 4001) | **Wiped and refilled at the start of every test run** |

Settings for the tests are in `backend/.env.test` (not in Git — copy `.env.test.example`).
**Safety:** the test script refuses to run unless the database name ends in `_test`, so it can never wipe the development database by mistake.

---

## 3. What `npm run test:api` does

1. Reads `.env.test` and checks the database name ends in `_test`.
2. Wipes `taf_ems_test` and rebuilds the tables from our migrations (`prisma migrate reset`).
3. Loads the demo data (`prisma/seed.js`).
4. Starts the backend on port 4001 and waits for `/api/health`.
5. Runs the Postman collection with Newman.
6. Stops the backend. Ends with "✔ All API checks passed" (exit code 0) or "✖ Some API checks failed".

Newman is run with `npx` and is **not** added to the project's packages. It is a test tool only (never part of the running system); some of its own dependencies have published advisories, and keeping it out of `package.json` keeps `npm audit` for the application at 0 vulnerabilities.

---

## 4. Manual test checklist (UI)

Use the demo accounts (password `ChangeMe123!`). Tick each line when it works.

### Everyone
- [ ] Wrong password → "Invalid email or password."
- [ ] 5 wrong passwords for one email → blocked for 15 minutes (429)
- [ ] Refreshing the page keeps you logged in; closing the tab logs you out
- [ ] Log out works; going back to a page afterwards shows the login page
- [ ] A new account must change its temporary password before seeing anything else
- [ ] On a phone-sized window the menu folds behind ☰

### Holding (head@demo.local)
- [ ] Dashboard shows organization totals, waiting for approval/publication, completion
- [ ] Companies: create (errors under empty fields), edit, deactivate, activate
- [ ] Managers: create with a company, history, unassign, assign, deactivate
- [ ] Employees: create, edit, status, transfer, report
- [ ] Holding users: create, allow approving, stop approving, deactivate (primary only)
- [ ] Periods: create, open, close, reopen; criteria locked while a period is open
- [ ] Criteria: totals show 100% ✓ or a warning
- [ ] Evaluations: "Waiting for my approval", return with reason, approve, publish
- [ ] Evaluate a Manager; cannot approve an evaluation you submitted (unless primary)
- [ ] Reports: completion, compare companies, Manager performance
- [ ] Audit log: filter by action and date, open details

### Manager (manager.alpha@demo.local)
- [ ] Sees only Alpha everywhere; Holding-only pages say "Not available"
- [ ] My team: create, edit, change status (no Transfer button)
- [ ] Goals: create, edit, cancel, reopen, details with history
- [ ] Self-assessments: team overview (drafts stay private), read submitted ones, write own
- [ ] Evaluations: start, score (preview %), feedback, submit; fix a returned one
- [ ] My evaluation: sees own result only after publication

### Employee (employee1.alpha@demo.local)
- [ ] Dashboard: goals, self-assessment status, latest published result
- [ ] My profile: change phone/address/emergency contact only
- [ ] My goals: update progress with a comment; 100% marks completed
- [ ] Self-assessment: save draft, submit (locked afterwards)
- [ ] My evaluations: only published ones; acknowledge with a comment, once

---

## 5. Results

| Date | Unit (backend) | Unit (frontend) | API | Manual | By |
|---|---|---|---|---|---|
| 15 Nov 2026 | 26 / 26 | 15 / 15 | 479 / 479 | (fill in after the manual checklist) | Helina Hailu |

---

## 6. Not covered by automated tests (version 1)

- The screens themselves are tested manually (section 4), not by an automated browser test.
- Performance with large amounts of data (thousands of employees) has not been measured.
- Two people changing the same record at the same moment is covered for manager assignment
  (row locking, tested with a race test in Phase 5) and for review decisions; other forms use
  "last save wins".
