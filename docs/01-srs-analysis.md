# Phase 0 — SRS Analysis
**Project:** Employee Management and Performance Evaluation System (Taf Energies)
**Status:** Draft — waiting for supervisor answers to Section 8
**Source of truth:** The SRS. This file only organizes it and points out gaps.

---

## 1. The purpose in one paragraph

One parent organization (the **Holding**) owns several companies. Today there is no single place to see all their employees and how well they perform. This system gives:
- the Holding a view over every company,
- each company's Manager a place to run their own team,
- each Employee a place to see their goals and results.

The core work the system supports is: **set goals → employees work → employees rate themselves → Manager evaluates → Holding approves → result is published → employee acknowledges.**

---

## 2. Organizational structure

```
HOLDING
  └── Company (many)
        ├── Manager (one assigned)
        └── Employees (many; each belongs to one company at a time)
```

The most important rule: **company walls.** A Manager sees only their own company. An Employee sees only their own records. The **backend** must check this on every request (SRS 1.3.1 rule 7, and 1.10.1).

---

## 3. The three roles

| Role | In one sentence | Can see |
|---|---|---|
| Holding-level User | Runs the whole organization: companies, Managers, approvals, comparisons | Everything |
| Manager | Runs one company's employees, goals, and evaluations | Their assigned company only |
| Employee | Works on goals, rates themselves, reads published results | Their own records only |

### Permissions matrix (copied from SRS 1.3, unclear cells marked ⚠️)

| Action | Holding | Manager | Employee |
|---|---|---|---|
| View all companies | ✅ | ❌ | ❌ |
| Register / manage companies | ✅ | ❌ | ❌ |
| Assign Managers | ✅ | ❌ | ❌ |
| Access assigned company records | ✅ | ✅ | ❌ |
| Manage employees | ✅ all companies ⚠️ | ✅ own company | ❌ |
| Manage user accounts | ✅ if authorized ⚠️ | ✅ own company, if authorized ⚠️ | Own account |
| Assign performance goals | Oversight only ⚠️ | ✅ own employees | ❌ |
| Monitor progress | ✅ all | ✅ own employees | Own goals |
| Conduct evaluations | Review/approve | ✅ own employees | Self-assessment only |
| Give feedback | Review ⚠️ | ✅ | ❌ |
| View reports | ✅ all | Own company | Own published results |
| Compare companies | ✅ | ❌ | ❌ |
| Monitor Manager performance | ✅ | ❌ | ❌ |
| Approve final evaluations | If authorized ⚠️ | If authorized ⚠️ | ❌ |
| View evaluation history | ✅ all | Own employees | Own records |
| Acknowledge results | ❌ | ❌ | ✅ |

---

## 4. Functional requirements checklist

Each line will be ticked when it is **built and tested in Postman**, not just written.

### FR-01 Authentication
- [ ] Log in with registered credentials
- [ ] Log out
- [ ] Check credentials are valid
- [ ] Give access based on role
- [ ] Block unauthenticated users from protected parts
- [ ] Keep sessions secure

### FR-02 Company Management (Holding)
- [ ] Register a new company
- [ ] Store company information
- [ ] Update company details
- [ ] Activate / deactivate a company
- [ ] List all companies
- [ ] Assign a Manager to each company

### FR-03 Manager Management (Holding)
- [ ] Create Manager accounts
- [ ] Assign Managers to companies
- [ ] Update Manager information
- [ ] Activate / deactivate Manager accounts
- [ ] See which Manager is assigned to each company
- [ ] Monitor Manager activities and performance

### FR-04 Employee Management (Manager)
- [ ] Register new employees
- [ ] Update employee information
- [ ] View employee records
- [ ] Link employees to the right company
- [ ] Manage employee account information
- [ ] Keep employment status (e.g. active, on leave, left)
- [ ] Block Managers from other companies' employees

### FR-05 Performance Goals (Manager)
- [ ] Create goals (title, description, objectives)
- [ ] Set deadlines
- [ ] Define expected results and KPIs
- [ ] Assign goals to employees
- [ ] Track goal progress
- [ ] Keep goal history

### FR-06 Self-Assessment (Employee)
- [ ] Show the employee their goals
- [ ] Let the employee write self-assessment comments
- [ ] Let the employee submit the self-assessment
- [ ] Store it
- [ ] Let the Manager read it

### FR-07 Performance Evaluation (Manager)
- [ ] Show the employee's goals
- [ ] Configurable evaluation criteria
- [ ] Manager enters scores
- [ ] Calculate the overall score using weights
- [ ] Manager writes feedback
- [ ] Save the evaluation
- [ ] Keep evaluation history

### FR-08 Review and Approval
- [ ] Manager submits a completed evaluation
- [ ] Authorized approver reviews it
- [ ] Approver approves **or** returns it for correction
- [ ] Record the decision and comments
- [ ] Block unauthorized users from approving
- [ ] Publish approved results

### FR-09 Reports and Analytics
- [ ] Employee performance report
- [ ] Company performance report
- [ ] Evaluation completion statistics
- [ ] Pending vs. completed evaluations
- [ ] Compare companies
- [ ] Monitor Manager performance
- [ ] Consolidated Holding report

### FR-10 Audit Log
- [ ] Login activity (where required)
- [ ] Company created / changed
- [ ] Manager assigned
- [ ] Employee information changed
- [ ] Evaluation submitted
- [ ] Approval decision made
- [ ] Every record has a time and the user who did it

### Extra employee abilities (SRS 1.2.3, not in the FR list but required)
- [ ] Update permitted personal information
- [ ] View personal evaluation history
- [ ] **Acknowledge** a published evaluation
- [ ] **Comment / respond** to a published evaluation when permitted

---

## 5. Non-functional requirements checklist

| Area | Requirement | How we will meet it |
|---|---|---|
| Security | Login before protected features | JWT check on every protected route |
| Security | Hashed passwords | bcrypt |
| Security | Role-based access | Role-check middleware |
| Security | Company data isolation | Every query filtered by `companyId` on the backend |
| Security | Protect sensitive data | Never send password hashes; limit fields returned |
| Performance | Fast normal requests | Database indexes, pagination on lists |
| Performance | Reports load in acceptable time | Summary queries done by the database |
| Reliability | Accurate records | Database constraints (foreign keys, unique rules) |
| Reliability | No half-finished updates | Database transactions (e.g. approve + publish + audit together) |
| Reliability | Backups | Backup procedure documented in Phase 12 |
| Usability | Simple interface, role-specific dashboards | Three dashboards, clear forms |
| Usability | Clear error messages | One consistent error format from the API |
| Scalability | Add more companies and employees | Nothing hard-coded to "Company A/B/C" |
| Maintainability | Modular, layered, documented | Layered backend, `docs/` folder, README |

---

## 6. Main business workflows

**W1 — Set up the organization**
Holding logs in → registers a company → creates a Manager account → assigns the Manager to the company.

**W2 — Build the team**
Manager logs in → registers employees in their company → creates employee login accounts.

**W3 — Goals**
Manager creates a goal (title, description, objectives, KPI, target, deadline, criteria) → assigns it to an employee → employee updates progress over time.

**W4 — Evaluation cycle**
An evaluation period opens → employee submits a self-assessment (if required) → Manager scores each criterion → system calculates the weighted total → Manager writes feedback → Manager submits.

**W5 — Approval**
```
DRAFT → SUBMITTED → APPROVED → PUBLISHED → ACKNOWLEDGED (by employee)
             ↓
     RETURNED → (Manager fixes) → SUBMITTED
```
Every change is written to the audit log.

**W6 — Oversight**
Holding opens its dashboard → sees totals, completion rates, pending evaluations, company comparisons, and Manager performance.

---

## 7. System modules (build order)

1. Authentication and RBAC
2. Company Management
3. Manager Management
4. Employee Management
5. Evaluation Periods and Criteria (setup data the next modules need)
6. Performance Goals and Progress
7. Self-Assessment
8. Performance Evaluation and Scoring
9. Review, Approval, Publication, Acknowledgement
10. Reports and Dashboards
11. Audit Log (built as a shared helper early, used by every module)

**Out of scope for version 1 (SRS 1.6):** attendance, leave, payroll, training, notifications.

---

## 8. Questions for the supervisor

⭐ = must be answered **before database design (Phase 4)**, because the answer changes the tables.
Each question has a **proposed answer**, so the supervisor can simply say "yes" or correct it.

### A. Approval — the most important conflict
1. ⭐ **Who can approve evaluations?** The SRS matrix says "Holding: if authorized" **and** "Manager: if authorized", and FR-08 mentions "other designated approvers". The project brief says only the Holding approves.
   *Proposed:* In version 1, only Holding-level users approve. A Manager can never approve. The design will leave room for a separate "approver" permission later.
2. ⭐ **Is approval always required?** The SRS says "when approval is required."
   *Proposed:* Yes, every evaluation needs Holding approval.
3. **Is publishing automatic after approval?** The SRS says "according to organizational policy."
   *Proposed:* Approval and publishing are two separate steps, so the Holding can publish a whole period at once.

### B. Users and accounts
4. ⭐ **Can there be several Holding-level users?** Do some of them have fewer rights (e.g. view-only vs. approver)?
   *Proposed:* Several Holding users, all with the same rights in version 1.
5. ⭐ **Is a Manager also an Employee of their company?** If yes, who sets the Manager's goals and evaluates them?
   *Proposed:* A Manager has an employee record in their company, but is **not** evaluated in version 1.
6. **What does "if authorized" mean for managing accounts?**
   *Proposed:* Managers can always create employee accounts in their own company. The Holding can create any account.
7. **How does a new user get their first password?**
   *Proposed:* The person who creates the account sets a temporary password, and the user must change it at first login.
8. **Can the Holding edit employees directly,** or only view them? (The matrix says "manage: all companies".)
   *Proposed:* The Holding can view and edit employees in any company.

### C. Evaluation details
9. ⭐ **Who creates evaluation periods?** Is it the same for all companies? Yearly, half-yearly, or quarterly?
   *Proposed:* The Holding creates periods that apply to all companies.
10. ⭐ **Who defines evaluation criteria and their weights?** Holding for everyone, or each company?
   *Proposed:* The Holding defines a standard set, and weights must add up to 100%.
11. ⭐ **What is the score scale?**
   *Proposed:* 1 to 5 per criterion, with the weighted total shown as a percentage.
12. **Is self-assessment mandatory** before the Manager can submit an evaluation?
   *Proposed:* Optional. The Manager can see whether it was submitted.
13. **Who defines KPIs** ("according to organizational guidelines")?
   *Proposed:* Managers type them freely per goal in version 1.
14. **What can an employee update on a goal?**
   *Proposed:* A progress percentage and a short comment only.
15. **Can an employee see a "returned" evaluation?**
   *Proposed:* No. Employees see nothing until it is published.
16. ⭐ **After publishing, can an employee respond?** Can they only comment, or formally disagree, which would reopen the evaluation?
   *Proposed:* The employee can acknowledge and add one comment. This does not reopen the evaluation.

### D. Organization changes
17. ⭐ **Can an employee move to another company?** What happens to their history?
   *Proposed:* Yes. Old evaluations stay linked to the old company. Only the new company's Manager sees new records.
18. **What happens when a company or Manager is deactivated?**
   *Proposed:* Nothing is deleted. Users of a deactivated company cannot log in. Records stay for reports.
19. **How is "Manager performance" measured?**
   *Proposed:* Evaluation completion rate, on-time submission rate, and the average score of their team.
20. **Which personal fields can an employee edit themselves?**
   *Proposed:* Phone number, address, and emergency contact only.

### E. Other
21. **Language:** English only, or Amharic too? *Proposed:* English in version 1.
22. **Login logging** ("where required"): log every login? *Proposed:* Log successful and failed logins.

---

## 9. Differences between the SRS and the project brief

| Topic | SRS says | Brief says | Plan |
|---|---|---|---|
| Who approves | Holding or Manager "if authorized", or other approvers | Holding only | Ask (Q1). Default: Holding only |
| Employee acknowledgement | Required (acknowledge + comment) | Not in workflow | Added as a final step |
| Use case diagram | Listed in the SRS roadmap (step 3) | Not mentioned | Added to Phase 0 |
| API endpoint list | Listed in the SRS roadmap (step 7) | Covered in Phase 5 | Written before coding each module |
| UI design | Listed in the SRS roadmap (step 8) | Covered in Phase 8 | Simple wireframes before React work |
| Editor | — | Cursor | **VS Code** (changed by Emanda) |

---

## 10. Progress record

**Completed:** SRS received and analyzed. Node.js v24.19.0 and npm 11.17.0 checked.
**In progress:** Environment check (Git next).
**Pending:** Supervisor answers, PostgreSQL check, Git repository, Phase 1 setup.
**Decisions:** JavaScript only, Express, PostgreSQL, Prisma, React, JWT, bcrypt. Editor is VS Code. Push to GitHub at the end of every phase.
**Issues:** Harmless `compdef` warning when Terminal opens (to fix in Phase 1).
**Next step:** Check Git.
