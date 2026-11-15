# Phase 12 — Deployment readiness

**Status:** the system is **ready to be deployed**, but it has **not** been deployed.
Deploying to company infrastructure needs the supervisor's permission and the IT team's decisions
(which server, which address, who looks after it). This document is the plan to follow when that happens.

---

## 1. How the system runs in production

In development we run two programs (the backend on 4000, the React app on 5173 through Vite).
In production it is **one program**: the backend also serves the built React app.

```
Browser ──HTTPS──▶ nginx (or another proxy, handles HTTPS)
                     │
                     ▼
               Node.js backend (port 4000)
                 ├─ /api/...      → the API
                 └─ everything else → the React app (frontend/dist)
                     │
                     ▼
               PostgreSQL (taf_ems database)
```

Because the app and the API share one address, the browser needs no CORS permission, and there is
only one thing to start, stop and monitor.

---

## 2. What the server needs

| Item | Version / note |
|---|---|
| Linux server (or Windows/macOS) | Any that runs Node.js 24 |
| Node.js | 24 (the same as development) |
| PostgreSQL | 17 |
| A proxy for HTTPS | nginx, Caddy, or the company's existing one, with a certificate |
| A process manager | systemd (Linux) or PM2 — restarts the backend if it stops or the server reboots |
| Disk | Small: the database grows slowly; keep room for backups |

---

## 3. Production settings (`backend/.env` on the server — never in Git)

| Setting | Production value |
|---|---|
| `NODE_ENV` | `production` (hides technical error details, stricter checks) |
| `PORT` | `4000` (only reachable through the proxy) |
| `DATABASE_URL` | The production database, with its **own** user and a strong password |
| `JWT_SECRET` | A **new** random string of at least 48 characters (the backend refuses shorter ones in production) |
| `JWT_EXPIRES_IN` | `8h` |
| `SERVE_FRONTEND` | `true` |
| `FRONTEND_DIST` | `../frontend/dist` (the default) |
| `CORS_ORIGINS` | The real address, e.g. `https://ems.tafenergies.example` |
| `TRUST_PROXY` | `1` when nginx is in front (so rate limits see real visitor addresses) |
| `RATE_LIMIT_MAX` | `1000` |
| `LOGIN_MAX_FAILURES` | `5` |

Generate the secret on the server:
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

---

## 4. First installation — step by step

```bash
# 1. Get the code (a specific, tested version)
git clone https://github.com/helina2426/taf-ems.git
cd taf-ems

# 2. Backend
cd backend
npm ci                          # installs exactly the versions in package-lock.json
#    create backend/.env with the production settings (section 3)
npx prisma migrate deploy       # creates the tables (never use "migrate dev" or "reset" in production)
npm run db:generate             # creates the Prisma Client

# 3. Frontend
cd ../frontend
npm ci
npm run build                   # creates frontend/dist

# 4. First user (the database is empty: no demo data in production)
cd ../backend
node --env-file=.env scripts/create-first-admin.js "Taf Energies" head@tafenergies.example
#    → prints a temporary password ONCE; give it to the person privately

# 5. Start (normally through systemd or PM2, see section 6)
node --env-file=.env src/server.js
```

Then check:
- `https://<address>/api/health` → `"status": "ok"`
- `https://<address>/api/health/ready` → `"database": "ok"`
- Open the address in a browser, log in with the first user, change the password.

**Never run `npm run db:seed` in production** — it creates demo accounts with a known password.
The seed script refuses to run when `NODE_ENV=production`.

---

## 5. After the first login (in the app)

1. **Periods & criteria:** create the employee and manager criteria (each list must total 100%).
2. **Companies:** create the companies.
3. **Managers:** create each Manager with their company.
4. **Holding users:** add other Holding users; allow approving only for those who should approve.
5. Managers add their employees (or the Holding does).
6. Create and **open** the first evaluation period when evaluations should start.

---

## 6. Keeping it running

**systemd example** (`/etc/systemd/system/taf-ems.service`):
```ini
[Unit]
Description=Taf EMS backend
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/taf-ems/backend
ExecStart=/usr/bin/node --env-file=.env src/server.js
Restart=on-failure
User=taf-ems

[Install]
WantedBy=multi-user.target
```
`sudo systemctl enable --now taf-ems` · status: `systemctl status taf-ems` · logs: `journalctl -u taf-ems`.

When systemd stops or restarts the service, the backend finishes the requests in progress and closes
its database connections cleanly (it handles the `SIGTERM` signal).

**nginx example** (only the parts that matter here):
```nginx
server {
    listen 443 ssl;
    server_name ems.tafenergies.example;
    # ssl_certificate / ssl_certificate_key: provided by IT

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Monitoring:** check `/api/health/ready` every minute (most monitoring tools can do this);
alert when it does not answer 200.

---

## 7. Backups

The database is the only thing that must be backed up (the code is in Git).

**Daily backup** (for example at night, with cron):
```bash
pg_dump -U taf_ems_user -h localhost -Fc -f /backups/taf_ems_$(date +%F).dump taf_ems
```
`-Fc` makes a compressed file that `pg_restore` can read.

**Keep:** the last 14 daily backups, and one per month for a year. Store a copy **outside** the server.

**Restore** (into an empty database):
```bash
createdb -U postgres -O taf_ems_user taf_ems_restored
pg_restore -U taf_ems_user -h localhost -d taf_ems_restored /backups/taf_ems_2026-11-15.dump
```
**Test a restore at least once a month.** A backup that has never been restored is not proven to work.

---

## 8. Updating to a new version

```bash
pg_dump ... (take a backup first — section 7)
git pull                                    # or check out the new tagged version
cd backend && npm ci && npx prisma migrate deploy && npm run db:generate
cd ../frontend && npm ci && npm run build
sudo systemctl restart taf-ems
```
Check `/api/health/ready` and log in.

**If something goes wrong:** check out the previous version, rebuild, restart. If the update changed the
database, restore the backup taken just before.

Before every update, run the tests on a development machine: `npm run test:unit`, `npm test`, `npm run test:api`.

---

## 9. Checklist before going live

- [ ] Supervisor's permission to deploy, and the server chosen with IT
- [ ] Repository made **private** (or confirmed acceptable as public by the supervisor)
- [ ] HTTPS working, with a valid certificate
- [ ] Production `.env` filled in (section 3); new `JWT_SECRET`; strong database password
- [ ] `NODE_ENV=production`, `SERVE_FRONTEND=true`, `TRUST_PROXY=1`, real `CORS_ORIGINS`
- [ ] `npx prisma migrate deploy` done; **no** seed
- [ ] First Holding user created; temporary password changed
- [ ] Criteria (100% each), companies, managers set up
- [ ] Backups running, and one restore tested
- [ ] Monitoring on `/api/health/ready`
- [ ] `npm audit` checked in backend and frontend
- [ ] Open questions in the hand-over document answered by the supervisor
