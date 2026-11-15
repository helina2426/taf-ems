# Taf EMS — Employee Management and Performance Evaluation System

A web system for **Taf Energies** (the Holding) and its companies to manage employees, set goals,
run performance evaluations with an approval step, and see reports across all companies.

> **Version 1, ready for deployment.** The development database contains demo data only. It has not been deployed to company infrastructure.

---

## What it does

| Area | Features |
|---|---|
| **Organization** | Companies, one Manager per company, employees, transfers between companies, Holding users with approval permission |
| **Goals** | Goals with KPI, target and deadline; employees report progress; status follows progress automatically |
| **Self-assessment** | Private drafts, submit once per period; Managers see who has submitted |
| **Evaluations** | Weighted criteria (1–5 per criterion, weights add up to 100%); Managers evaluate employees, the Holding evaluates Managers |
| **Approval** | Submit → approve or return with a reason → publish → the person acknowledges; full review history |
| **Reports** | Role dashboards, completion per company, company comparison, Manager performance, employee history |
| **Audit log** | Logins and every important change, with who and when (read only) |
| **Security** | Hashed passwords, signed tokens, role checks and a company wall on every request, rate limits, security headers |

**Three roles:** **Holding** (sees everything; approvers approve and publish), **Manager** (their own company only),
**Employee** (their own profile, goals, self-assessment and published results).

---

## Technology

| Part | Tools |
|---|---|
| Backend | Node.js 24, Express 5, Prisma 7, PostgreSQL 17, JWT (jose), bcrypt, zod |
| Frontend | React 19, React Router 8, Vite 8, plain CSS |
| Testing | Node's built-in test runner, Postman collection run with Newman |

All in **JavaScript** (no TypeScript). Package versions are pinned exactly.

---

## Project structure

```
taf-ems/
├── backend/
│   ├── prisma/            database schema, migrations, demo data (seed.js)
│   ├── src/
│   │   ├── config/        settings (env.js) and the database client
│   │   ├── middleware/    login check, role check, validation, rate limits, errors
│   │   ├── shared/        helpers used by every module (audit log, tokens, passwords…)
│   │   └── modules/       one folder per feature: routes → controller → service → repository
│   ├── scripts/           test-api.js (automated API tests)
│   ├── test/unit/         unit tests
│   └── postman/           Postman collection and environment
├── frontend/
│   ├── src/
│   │   ├── api/           the one place that talks to the backend
│   │   ├── auth/          login state and page guards
│   │   ├── components/    reusable pieces (modal, tables, badges…)
│   │   ├── pages/         one file per page, grouped by area
│   │   └── utils/         small helpers
│   └── test/              unit tests
└── docs/                  analysis, design, security, testing, user guide, API reference
```

---

## Getting started (development)

### 1. What you need
- **Node.js 24** and npm
- **PostgreSQL 17** running on port 5432
- Git

### 2. Create the databases (once)
In `psql` as the PostgreSQL administrator (`psql -U postgres -h localhost`):
```sql
CREATE USER taf_ems_user WITH PASSWORD 'choose-a-password' CREATEDB;
CREATE DATABASE taf_ems_dev OWNER taf_ems_user;
CREATE DATABASE taf_ems_test OWNER taf_ems_user;
```

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env            # then fill in the password and a new JWT_SECRET
npm run db:migrate              # creates the tables
npm run db:generate             # creates the Prisma Client the code uses (not stored in Git)
npm run db:seed                 # loads the demo data
npm run dev                     # http://localhost:4000/api/health
```
Make a JWT secret with:
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### 4. Frontend (in a second terminal)
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```
During development, Vite forwards every `/api` request to the backend on port 4000.

### 5. Demo accounts
All demo accounts use the password **`ChangeMe123!`**.

| Role | Person | Email |
|---|---|---|
| Holding — primary user | — | `head@demo.local` |
| Holding — must change password at first login | — | `hr@demo.local` |
| Manager — Alpha Energy | Selam Tesfaye | `manager.alpha@demo.local` |
| Manager — Beta Logistics | Yonas Alemu | `manager.beta@demo.local` |
| Employee — Alpha | Dawit Bekele | `employee1.alpha@demo.local` |
| Employee — Alpha | Hanna Girma | `employee2.alpha@demo.local` |
| Employee — Beta | Meron Haile | `employee1.beta@demo.local` |
| Employee — Beta | Samuel Tadesse | `employee2.beta@demo.local` |

---

## Commands

| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` | Start the API with automatic restart on changes |
| backend | `npm start` | Start the API (no automatic restart) |
| backend | `npm run db:migrate` | Apply database migrations |
| backend | `npm run db:generate` | Re-create the Prisma Client after a fresh clone or a schema change |
| backend | `npm run db:seed` | Load the demo data |
| backend | `npm run db:studio` | Open Prisma Studio to look at the data |
| backend | `npm run test:unit` | Backend unit tests (needs `.env.test`) |
| backend | `npm run test:api` | Full API test run on a fresh test database |
| frontend | `npm run dev` | Start the React app |
| frontend | `npm run build` | Build the app for production (into `dist/`) |
| frontend | `npm test` | Frontend unit tests |

**To start again with clean demo data:** stop the backend, then `npx prisma migrate reset` and `npm run db:seed`
(⚠️ this deletes everything in `taf_ems_dev`).

---

## Testing

| Tests | Result |
|---|---|
| Backend unit tests | 26 / 26 |
| Frontend unit tests | 15 / 15 |
| API tests (355 requests on a fresh test database) | 479 / 479 |

The API tests use their own database (`taf_ems_test`) and port 4001; set them up by copying
`backend/.env.test.example` to `backend/.env.test`. Details and the manual checklist: [docs/05-testing.md](docs/05-testing.md).

---

## Documentation

| Document | Contents |
|---|---|
| [01 — SRS analysis](docs/01-srs-analysis.md) | Requirements, roles, workflows, questions for the supervisor |
| [02 — Environment](docs/02-environment.md) | Tools and versions used |
| [03 — Database design](docs/03-database-design.md) | ERD, tables, rules, design decisions |
| [04 — Security](docs/04-security.md) | Threats and protections, settings, known limitations |
| [05 — Testing](docs/05-testing.md) | Test types, how to run them, manual checklist, results |
| [06 — User guide](docs/06-user-guide.md) | How to use the system, for each role |
| [07 — API reference](docs/07-api-reference.md) | Every endpoint, who may use it, and the error format |
| [08 — Deployment](docs/08-deployment.md) | How to run it in production, settings, backups, updates, go-live checklist |
| [09 — Hand-over](docs/09-handover.md) | What was delivered, where to start, decisions to confirm, limitations, next ideas |

---

## Project phases

- [x] Phase 0 — SRS analysis (`docs/01-srs-analysis.md`)
- [x] Phase 1 — Development environment setup
- [x] Phase 2 — JavaScript essentials
- [x] Phase 3 — Backend setup and architecture
- [x] Phase 4 — Database design (ERD, Prisma schema)
- [x] Phase 5 — Backend modules (11 modules)
- [x] Phase 6 — API testing with Postman
- [x] Phase 7 — Security review (`docs/04-security.md`)
- [x] Phase 8 — React setup
- [x] Phase 9 — Advanced React (pages for all three roles)
- [x] Phase 10 — Full-stack integration (frontend ↔ backend, user guide, API reference)
- [x] Phase 11 — Testing and QA (`docs/05-testing.md`)
- [x] Phase 12 — Deployment readiness (`docs/08-deployment.md`, `docs/09-handover.md`)

---

> This is a confidential company project. Do not upload real employee data.

*Built during an internship at Taf Energies. Internal use only.*
