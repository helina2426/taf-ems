# Taf EMS — Employee Management and Performance Evaluation System

A system for **Taf Energies** that manages employees and their performance evaluations across multiple companies operating under one central Holding.

- The **Holding** oversees all companies, assigns Managers, compares performance, and approves evaluations.
- Each **Manager** manages the employees of their own company and evaluates them.
- Each **Employee** views their goals, submits self-assessments, and sees published results.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React (JavaScript) |
| Backend | Node.js + Express.js (JavaScript) |
| Database | PostgreSQL 17 |
| Database access | Prisma ORM |
| Authentication | JWT + bcrypt |
| API testing | Postman |

## Project structure

```
taf-ems/
├── backend/    # Express API (Phase 3)
├── frontend/   # React app (Phase 8)
└── docs/       # Requirements, design, and progress documents
```

## Development progress

- [x] Phase 0 — SRS analysis (`docs/01-srs-analysis.md`)
- [ ] Phase 1 — Development environment setup
- [ ] Phase 2 — JavaScript essentials
- [ ] Phase 3 — Backend setup and architecture
- [ ] Phase 4 — Database design (ERD, Prisma schema)
- [ ] Phase 5 — Backend modules
- [ ] Phase 6 — API testing with Postman
- [ ] Phase 7 — Security review
- [ ] Phase 8 — React setup
- [ ] Phase 9 — Advanced React
- [ ] Phase 10 — Full-stack integration
- [ ] Phase 11 — Testing and QA
- [ ] Phase 12 — Deployment readiness

## Local environment

- Node.js v24, npm 11
- PostgreSQL 17 on port 5432

> This is a confidential company project. Do not upload real employee data.