# Phase 7 — Security

**Status:** Done for the backend. Every item marked ✅ is tested by the Postman collection (the **Security** folder, plus the 403/401 checks in every module folder).

---

## 1. What protects the system

| Threat (what an attacker might try) | Protection | Where |
|---|---|---|
| Reading passwords from the database | Passwords are stored only as **bcrypt hashes** (scrambled, salted, slow to guess). The hash is never sent in any reply. | `shared/password.js` ✅ |
| Guessing a password by trying many | After **5 failed logins** for one email from one computer, that email is blocked for **15 minutes** (status 429). | `middleware/rateLimit.js` ✅ |
| Finding out which emails exist | A wrong email and a wrong password get the **same message** and take the **same time**. | `auth.service.js` ✅ |
| Flooding the server with requests | At most **1000 requests per 15 minutes** per computer (setting `RATE_LIMIT_MAX`). | `middleware/rateLimit.js` |
| Sending huge request bodies | Bodies over **100 KB** are refused (status 413). | `app.js` ✅ |
| Faking or editing a login token | Tokens are **signed** (HS256) with a secret only the server knows; an edited token, or one with `alg: none`, is refused (401). | `shared/token.js` ✅ |
| Using a stolen token after the password was changed | Each token carries a **password stamp**. Changing the password makes all older tokens stop working. | `middleware/authenticate.js` ✅ |
| Using an account that was deactivated | Every request re-checks the account in the database; deactivated users and users of deactivated companies get 401. | `middleware/authenticate.js` ✅ |
| Doing something your role does not allow | **Role checks** on every route (`authorize`), and detailed rules in the services. | every module ✅ |
| A Manager reading another company's data by changing an id in the URL | The **company wall** is checked in the services, using the company from the database — never from the request. | every service ✅ |
| Changing fields you must not change (e.g. your own role or company) | **Validation** (zod) accepts only the expected fields; extra fields are ignored or refused. | `*.validation.js` ✅ |
| SQL injection | All database access goes through **Prisma**, which sends values separately from the SQL. | repositories |
| Guessing other records' ids | Ids are random **UUIDs**, and permissions are checked anyway. | schema |
| Learning which software the server runs | `X-Powered-By: Express` is removed. | `app.js` ✅ |
| Browser attacks (clickjacking, file-type guessing, etc.) | **Helmet** adds security headers such as `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN`. | `app.js` ✅ |
| Another website calling the API from a visitor's browser | **CORS**: only the origins in `CORS_ORIGINS` (our React app) are allowed. | `app.js` ✅ |
| Internal details leaking in error messages | Unexpected errors return a general message; the technical detail is only shown in development. | `errorHandler.js` |
| Half-finished changes | Every change and its audit entry are saved in **one transaction**; manager assignment uses **row locking**; review decisions use "change only if still SUBMITTED". | services |
| Nobody knowing who did something | The **audit log** records logins, failed logins, and every important change, with the user and the time. Holding users can read it; nobody can edit it. | `shared/auditLog.js`, `/api/audit-logs` ✅ |
| Secrets in Git | `.env` is in `.gitignore`; only `.env.example` (with placeholders) is committed. | repository |
| Known security problems in packages | `npm audit` → **0 vulnerabilities**. Package versions are pinned exactly. | `package.json` |

---

## 2. Settings (`backend/.env`)

| Setting | Meaning | Development value |
|---|---|---|
| `JWT_SECRET` | The secret that signs tokens. At least 32 random characters. Different in every environment. | (your own) |
| `JWT_EXPIRES_IN` | How long a token works. | `8h` |
| `CORS_ORIGINS` | Websites allowed to call the API, separated by commas. | `http://localhost:5173` |
| `RATE_LIMIT_MAX` | Requests per computer per 15 minutes. | `1000` |
| `LOGIN_MAX_FAILURES` | Failed logins per email per computer per 15 minutes. | `5` |

---

## 3. Known limitations (version 1)

1. **Logout does not cancel the token on the server.** The frontend deletes the token; it would otherwise keep working until it expires (8 hours). Changing the password, or deactivating the account, cancels it immediately.
2. **Rate-limit counters live in the server's memory.** Restarting the server resets them, and with several servers each would count separately. A shared store (such as Redis) would be used in a larger deployment.
3. **A warning from the database driver** (`DeprecationWarning: Calling client.query() when the client is already executing a query`) appears in the server log. It comes from inside Prisma's PostgreSQL adapter (version 7.10.1), not from our code, and it does not affect results. It should disappear when Prisma releases an update.

---

## 4. Before going to production (checklist — not done in development)

- [ ] `NODE_ENV=production` (hides technical error details).
- [ ] A new, long, random `JWT_SECRET`, stored only on the server.
- [ ] `CORS_ORIGINS` set to the real frontend address only.
- [ ] HTTPS in front of the backend (passwords and tokens must never travel unencrypted).
- [ ] If the backend runs behind a proxy, set Express's `trust proxy` so rate limits see the real visitor address.
- [ ] A database user with only the permissions the app needs, and regular backups (Phase 12).
- [ ] Run `npm audit` again and update packages.
- [ ] Repository visibility confirmed with the supervisor.
- [ ] Only with the supervisor's permission: deployment to company infrastructure.
