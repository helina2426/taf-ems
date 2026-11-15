# Hand-over — Taf EMS

**Project:** Employee Management and Performance Evaluation System for Taf Energies
**Built by:** Helina Hailu (internship)
**Repository:** https://github.com/helina2426/taf-ems (branch `main`)
**Status:** complete for version 1 in development; ready for deployment (see `08-deployment.md`); not deployed.

---

## 1. What was delivered

| Part | Contents |
|---|---|
| Backend | Node.js/Express API, 11 modules, 68 endpoints (plus 2 health checks), PostgreSQL database with 14 tables |
| Frontend | React app with pages for the three roles (Holding, Manager, Employee) |
| Security | Hashed passwords, signed tokens (invalidated on password change), role checks and company wall on every request, rate limits, security headers, audit log |
| Tests | 26 backend + 15 frontend unit tests; 479 automated API checks on a fresh test database |
| Documents | `docs/01` to `docs/09` (analysis, environment, database, security, testing, user guide, API, deployment, this hand-over) |

All features in the SRS (FR-01 to FR-10) are implemented, plus Manager evaluations and an approval step
for every evaluation (decisions 6 and 7).

---

## 2. Where to start (for the next developer)

1. Read the `README.md` — it explains how to install and run everything.
2. Read `docs/03-database-design.md` (the data and the rules) and `docs/07-api-reference.md` (the API).
3. Run the tests (`npm run test:api` in backend) to see everything working.
4. Each backend feature is one folder in `backend/src/modules/`: `routes → controller → service → repository`.
   **Business rules live in the services.**
5. Each page is one file in `frontend/src/pages/`. All calls to the backend go through `frontend/src/api/client.js`.

---

## 3. Decisions to confirm with the supervisor

These were decided during development so the work could continue. They are recorded in
`docs/03-database-design.md` (section 7) and can be changed if the supervisor decides otherwise.

| # | Decision |
|---|---|
| 6 | Managers are evaluated (by the primary Holding user or an allowed Holding user) — not in the SRS |
| 7 | Every evaluation needs an approval step, including Manager evaluations |
| 10 | Each criterion is scored 1–5; the overall score is a weighted percentage |
| 11 | Self-assessment is optional |
| 13 | After publication, the person acknowledges and may add one comment |
| 18 | Nobody approves an evaluation they submitted, except the primary Holding user |
| 19 | Returning is only possible while the period is open |
| 20 | Reports count only approved or published results |
| 21 | How Manager performance is measured |
| — | The repository is public; it may need to be made private |

---

## 4. Known limitations (version 1)

- Logging out deletes the token in the browser; the token itself stays valid until it expires (8 hours),
  unless the password is changed or the account deactivated.
- Rate-limit counters are kept in memory (reset when the backend restarts; one server only).
- No e-mail notifications (out of scope in the SRS) — people see what is waiting on their dashboard.
- No "forgot password" feature: if someone forgets their password, it cannot be reset from the app in
  version 1 (a developer would have to set a new temporary password directly in the database).
- The screens are tested manually (checklist in `docs/05-testing.md`), not by automated browser tests.
- Performance with very large data (thousands of employees) has not been measured.
- A harmless warning from the PostgreSQL driver appears in the logs (see `docs/04-security.md`).

---

## 5. Ideas for version 2

- "Forgot password" by e-mail, and e-mail reminders (evaluation due, waiting for approval, published).
- Export reports to Excel or PDF.
- Automated browser tests (for example with Playwright).
- Amharic language for the interface.
- Attachments (evidence) on goals.

---

## 6. Accounts and secrets

- **Development:** demo accounts are listed in the README (password `ChangeMe123!`). Demo data only.
- **Production:** no accounts exist until `scripts/create-first-admin.js` is run. No secret is stored in Git;
  each environment has its own `.env` file, which must be kept private.
