# User Guide — Taf EMS

This guide explains how to use the system, step by step, for each kind of user.
Open the system in a web browser (during development: http://localhost:5173).

---

## 1. For everyone

### Logging in
1. Type your **email** and **password**, then press **Log in**.
2. Click **Show** in the password box to see what you typed; click **Hide** to hide it again.
3. If you see *"Invalid email or password"*, check both. For security, the system does not say which one is wrong.
4. After **5 wrong passwords** for the same email, that email is blocked for **15 minutes**.

### Your first login
New accounts get a **temporary password**. At the first login the system asks you to choose your own:
at least **8 characters**, with at least **one letter** and **one number**. You cannot use the system until you have done this.

### Changing your password
Click **Change password** at the bottom of the menu. After the change you stay logged in on this
device; on any other device you must log in again.

### Logging out
Click **Log out** at the top right. Closing the browser tab also logs you out.

### On a phone
The menu is hidden behind the **☰** button at the top left.

### Words you will see

| Word | Meaning |
|---|---|
| **Period** | A time window for evaluations, such as "2026 Annual Evaluation". It is *Upcoming*, *Open* or *Closed*. Most things can only be written while a period is **Open**. |
| **Criterion** | Something people are scored on, such as "Teamwork", with a **weight** (its share of the total). |
| **Draft** | Saved but not sent. Private to the person who wrote it. |
| **Submitted** | Sent for the next step; it can no longer be changed. |
| **Returned** | Sent back to the evaluator to fix, with a reason. |
| **Approved** | Accepted by an approver, but not yet visible to the person evaluated. |
| **Published** | Visible to the person evaluated. |

---

## 2. Employees

### Dashboard
Shows your goals, whether you have written your self-assessment, and your latest published result.

### My profile
You can change your **phone**, **address** and **emergency contact**, then press **Save**.
For any other change (name, job title…), ask your Manager.

### My goals
Your Manager sets your goals. For each goal you see the KPI (how it is measured), the target and the deadline.
1. Press **Update progress**.
2. Move the slider to your progress (0–100%) and write what you did (optional).
3. Press **Save**. At **100%** the goal is marked **Completed**.

**Details** shows the history of all your updates. A red **Overdue** label means the deadline has passed.
You cannot update a goal that your Manager has cancelled, or a goal of a closed period.

### Self-assessment
Your own view of your work during a period: what went well, what was difficult, what you want to improve.
1. Choose the period at the top (an open period is chosen for you).
2. Write your text. Your goals for that period are shown on the right as a reminder.
3. **Save draft** as often as you like. Nobody else can read a draft.
4. When you are ready, press **Submit** and confirm. You need at least 20 characters.
   After submitting, your Manager and the Holding can read it, and it can no longer be changed.

### My evaluations
Your evaluations appear here **after they have been approved and published**.
1. Open an evaluation to see your score for each criterion, the feedback and the recommendations.
2. Write a comment if you want (optional), then press **I have read my evaluation**.
   This means you have read it — not that you agree with everything. You can do this once.

---

## 3. Managers

You see and manage **your own company only**.

### Dashboard
Your team size, team goals, evaluation progress for the period (not started, drafts, returned, waiting
for approval, completed) and your own published result.

### My team
- **+ New employee:** fill in the details and a temporary password; the person changes it at first login.
- **Edit** to change details; **Status** for On leave, Suspended or Terminated (suspended and terminated people cannot log in).
- **Report:** the person's results over time and their goals.
- Moving someone to another company is done by the Holding.

### Goals
- **+ New goal:** choose the employee, optionally a period, then a title, KPI, target and deadline.
- **Edit** to change it. **Cancel goal** stops it (nothing is deleted); **Reopen** brings it back.
- **Details** shows the employee's progress updates.

### Self-assessments
- **My team** tab: who has not started, who has a private draft, and who has submitted. Press **Read** to read a submitted one.
- **My own** tab: write your own self-assessment, in the same way as employees.

### Evaluations — evaluating your employees
1. Choose the period (it must be **open**), then press **+ Start evaluation** and choose the employee.
2. **Scores:** click 1 to 5 for every criterion (1 = far below expectations, 5 = excellent) and add comments if useful.
   The **preview** shows the overall percentage as you go. Press **Save scores**.
3. **Feedback:** write at least 20 characters (what went well, what can improve), plus recommendations. Press **Save feedback**.
4. Press **Submit**. If something is missing, the system lists exactly what.
5. If an approver **returns** it, the reason appears in red at the top. Fix it, save and submit again.

The employee's submitted self-assessment is shown on the right while you evaluate.

### My evaluation
Your own evaluation (written by the Holding) appears here after it is published. Read it and acknowledge it.

### Reports
The **Completion** report for your company: how many evaluations are not started, in progress, waiting for approval or completed.

---

## 4. Holding users

You see **all companies**. What you can change depends on your permissions:
the **primary Holding user** can do everything; other Holding users can approve evaluations only if the primary user allows it.

### Dashboard
Totals for the whole organization, what is **waiting for approval** and **waiting for publication**, the completion rate,
and evaluations by status.

### Companies
**+ New company** (name and a short unique code, such as TAF-SOLAR), **Edit**, **Deactivate** / **Activate**.
When a company is deactivated, nobody from it can log in. Nothing is deleted.

### Managers
- **+ New manager:** their details, a temporary password and the company they will run. If the company already
  has a Manager, the new one **replaces** them (the menu shows who runs each company now).
- **Unassign** / **Assign** a company; **Deactivate** / **Activate** the account.
- **History** lists every company the Manager has run, with dates.

### Employees
Like the Managers' page, but for all companies, with a company filter and **Transfer** to move someone to another company.
Old evaluations stay with the old company.

### Periods & criteria
- **+ New period** starts as *Upcoming*. **Open** it when evaluations should begin; **Close** it at the end;
  **Reopen** a closed period for late corrections.
- A period can only be opened when **each criteria list adds up to 100%** (a green "Total 100% ✓" badge).
- **Criteria are locked while any period is open**, so scores already given keep their meaning.
  Close the period first to add, change or deactivate criteria.

### Evaluations — approving and publishing
1. Press **Waiting for my approval** to see what is waiting.
2. Open an evaluation and read the scores, feedback and self-assessment.
3. **Approve** (a comment is optional), or **Return to fix** (a reason of at least 10 characters is required).
4. When approved, press **Publish**. Only then can the person read it.

You cannot approve an evaluation that **you** submitted — another approver must do it (the primary Holding user is the exception).
Returning is only possible while the period is open.

### Evaluating Managers
Approvers evaluate Managers in the same way Managers evaluate employees, using the **Manager criteria**:
**+ Start evaluation**, choose the Manager, score, write feedback, submit.

### Reports
- **Completion:** per company — to evaluate, not started, in progress, waiting, completed.
- **Compare companies:** average, highest and lowest scores, ranked, plus the numbers for the whole Holding.
- **Manager performance:** how many of their team's evaluations each Manager submitted, how many on time,
  how often they were returned, their team's average, and their own result.

Only **approved or published** results count in averages and completion.

### Holding users
Everyone in the Holding can see the list. Only the **primary Holding user** can:
add accounts, **Allow approving** / **Stop approving**, and deactivate accounts.

### Audit log
Every important action, with who did it and when. Filter by action (for example `EVALUATION_APPROVED`),
record type and dates. **Details** shows exactly what changed. Entries can never be edited or deleted.

---

## 5. Common questions

| Question | Answer |
|---|---|
| I cannot log in after typing a wrong password several times. | Wait 15 minutes, then try again carefully (use **Show**). |
| A button is greyed out. | Usually the period is not open, or the item is already submitted. Hover over it or read the note on the page. |
| I cannot see my evaluation. | It appears only after it has been approved **and** published. |
| "This page is not available for your role." | The page belongs to another role. Use the menu on the left. |
| "Your session is invalid or has expired." | Log in again (sessions last 8 hours, and end when the password changes). |
