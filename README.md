# TaskDesk API

A REST API for tasks, support tickets, file uploads and **multi-user workspaces with role-based access control**. It's built with Express and MongoDB (`backend/`), and a small React UI for trying it in the browser lives in `frontend/`.

Users sign up with an email code, log in with two-factor email codes, and can belong to several organizations. What they can do in an organization depends on their role in it: `owner`, `admin`, `member` or `viewer`. A user in one organization can never read, guess or change anything in another one.

## Contents

1. [Features](#features)
2. [Technology stack](#technology-stack)
3. [Project structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Installation and setup](#installation-and-setup)
6. [MongoDB replica set setup](#mongodb-replica-set-setup)
7. [Environment variables](#environment-variables)
8. [Database structure](#database-structure)
9. [RBAC permission matrix](#rbac-permission-matrix)
10. [API endpoints](#api-endpoints)
11. [Invitation workflow](#invitation-workflow)
12. [Ownership transfer](#ownership-transfer)
13. [Security](#security)
14. [Running tests](#running-tests)
15. [Postman and Newman](#postman-and-newman)

## Features

- **Accounts:** register with an email verification code, 2FA login (password, then a 6-digit email code), 15-minute access tokens, and rotating refresh tokens in an httpOnly cookie. After 5 wrong passwords the account is locked for 15 minutes.
- **Organizations:** any verified user can create one and becomes its owner. A user can belong to many organizations, and owners and admins can rename an organization. Only an owner can delete it, which also removes all its memberships and invitations in one transaction.
- **Four roles:** `owner`, `admin`, `member` and `viewer`. A role belongs to the membership, not to the user, so one person can be an owner in one organization and a viewer in another.
- **Members:** list members, view a member's details, change roles, remove members and leave. An organization always keeps at least one owner.
- **Email invitations:** single-use links that expire after 48 hours. Re-inviting a pending email replaces the old link, and only the invited email can accept.
- **Ownership transfer:** the owner re-enters their password, and the change happens in one transaction.
- **Tasks, support tickets and files:** tasks and tickets belong to each user. Tickets take up to 3 attachments, uploads are checked by their real bytes, and files are served only to their owner or through a 10-minute signed link.
- **API docs:** Swagger UI at `/api-docs`.

## Technology stack

| Layer | Tools |
|---|---|
| Runtime | Node.js 22 (built-in `--env-file` and `--watch`, no dotenv) |
| API | Express 5, express-validator, helmet, express-rate-limit, cookie-parser, Multer, file-type |
| Auth | bcryptjs, jsonwebtoken (HS256) |
| Database | MongoDB 8 (**replica set**, for transactions), Mongoose 9 |
| Email | Nodemailer (any SMTP server, Gmail by default) |
| Docs | swagger-jsdoc and swagger-ui-express |
| Tests | Node's built-in test runner (`node:test`), Postman, Newman with the htmlextra HTML reporter |
| Frontend | React, Vite, Tailwind CSS v4 |

## Project structure

```
backend/
  src/
    index.js           checks .env, connects to MongoDB, starts the server
    app.js             middleware order and route mounting (no server start, so tests can import it)
    config/            the only place that reads process.env; .env validation; Multer upload setup
    routes/            URLs, the middleware chain for each route, and the @openapi docs above each one
    middleware/        API key, JWT auth, requireRole, validation, rate limits, error handler
    validators/        express-validator rule chains
    controllers/       request in, response out; no database access and no role checks
    services/          business rules and all database access (transactions live here)
    models/            Mongoose schemas and indexes
    utils/             error classes, the role policy (roles.js), file signature checks, signed links
    docs/              OpenAPI setup and shared schemas (components.yaml)
  test/                node:test suites; each file uses its own throwaway database
  scripts/             Newman runner and Postman test-data cleanup
  uploads/             uploaded files (gitignored)
frontend/              React + Vite UI
postman/               collection, local/staging environments, upload fixture, reports/ (gitignored)
```

The request flow is `route → validation → controller → service → model`. Errors are thrown as small classes in `utils/` (for example `NotFoundError`, which is a 404) and one error handler turns them into `{ message }` responses.

## Prerequisites

- **Node.js 22+** and npm. The scripts use `node --env-file`, which needs Node 20.6 or later.
- **MongoDB 7 or 8 running as a replica set.** A single-node set is enough locally, see [MongoDB replica set setup](#mongodb-replica-set-setup). A standalone server won't work, because organization writes use transactions. MongoDB Atlas is already a replica set.
- Optional: an SMTP account (for example a Gmail App Password) to send real emails. Without it, codes and invite links are printed to the backend console.

## Installation and setup

```bash
git clone <repo-url> && cd node-task-1

cd backend
npm install
cp .env.example .env        # then fill in the values (see Environment variables)

cd ../frontend
npm install
cp .env.example .env        # set API_KEY to the same value as backend/.env
```

Generate the two secrets with `openssl rand -hex 32` (once for `API_KEY`, once for `JWT_SECRET`).

Run the backend and frontend in two terminals:

```bash
cd backend && npm run dev       # API on http://localhost:<PORT> (restarts on file changes)
cd frontend && npm run dev      # UI on http://localhost:5173
```

The browser never calls the API directly. The Vite dev server proxies `/api/*` to the backend and adds the `x-api-key` header on the server side, so the key never reaches the browser.

When the server starts, it validates `.env` and lists every problem before it connects to the database. A missing secret, a key shorter than 32 characters, a bad `MONGO_URI`, an invalid port or URL, half-set SMTP credentials, or `EXPOSE_DEV_OTP=true` in production each stop it with a clear message.

## MongoDB replica set setup

Organization creation and deletion, role changes, removing members, leaving, accepting invitations and ownership transfer all run in **MongoDB transactions**, and transactions only work on a replica set. These steps turn a local Homebrew MongoDB into a single-node replica set. Your existing data is kept.

1. **Back up** (recommended):
   ```bash
   mongodump --host 127.0.0.1 --port 27017 --out ~/mongo-backups/before-replset
   cp /opt/homebrew/etc/mongod.conf ~/mongo-backups/mongod.conf.bak
   ```
2. **Add the replica set name** to the MongoDB config (`/opt/homebrew/etc/mongod.conf` on Apple Silicon, `/usr/local/etc/mongod.conf` on Intel Macs):
   ```yaml
   replication:
     replSetName: rs0
   ```
3. **Restart MongoDB:**
   ```bash
   brew services restart mongodb-community
   # if MongoDB runs as a launchd agent instead:
   launchctl kickstart -k gui/$(id -u)/homebrew.mxcl.mongodb-community
   ```
4. **Initiate the set once.** With `mongosh`:
   ```js
   rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })
   ```
   Without `mongosh`, run this from `backend/`:
   ```bash
   node -e 'const { MongoClient } = require("mongodb"); (async () => { const c = await MongoClient.connect("mongodb://127.0.0.1:27017/?directConnection=true"); console.log(await c.db("admin").command({ replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] } })); await c.close(); })()'
   ```
5. **Check it:** `db.hello()` in `mongosh` should show `setName: "rs0"` and `isWritablePrimary: true` (this takes a few seconds after initiating).

`MONGO_URI` doesn't need to change. A plain `mongodb://127.0.0.1:27017/tasksdb` works, because the driver discovers the set. Other apps on the same MongoDB can keep their connection strings too; check them once after the switch, since only this project was tested.

> **Indexes after a schema change:** Mongoose creates missing indexes but never changes an existing one whose options changed. If you already ran an older version of this project, run this once from `backend/`:
> ```bash
> node --env-file=.env -e 'const m=require("mongoose");(async()=>{await m.connect(process.env.MONGO_URI);for(const n of ["Invitation","OrganizationMember","Organization"])console.log(n,await require("./src/models/"+n).syncIndexes());await m.disconnect()})()'
> ```

## Environment variables

`backend/.env` (template: `backend/.env.example`):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGO_URI` | yes | | `mongodb://` or `mongodb+srv://` connection string, pointing to a replica set |
| `API_KEY` | yes | | At least 32 characters. Every request must send it as `x-api-key`. |
| `JWT_SECRET` | yes | | At least 32 characters. Signs access tokens. |
| `PORT` | no | `3000` | API port, 1–65535 |
| `APP_URL` | no | `http://localhost:<PORT>` | Public API address. With `https://` the refresh cookie is `Secure`. |
| `FRONTEND_URL` | no | `http://localhost:5173` | Base of invitation links: `<FRONTEND_URL>/invitations/<token>` |
| `SMTP_HOST` / `SMTP_PORT` | no | `smtp.gmail.com` / `465` | SMTP server |
| `SMTP_USER` / `SMTP_PASS` | together; **required in production** | | SMTP login (for Gmail, a 16-character App Password; spaces are removed). Without them, codes and invite links are only printed to the console. |
| `NODE_ENV` | no | | `production` turns on the production-only checks |
| `EXPOSE_DEV_OTP` | no | off | **Development only.** See the warning below. |

> ⚠️ **`EXPOSE_DEV_OTP=true` puts secrets in API responses.** It adds `devOtp` (the email code) to `POST /auth/register` and `POST /auth/login/request-otp`, and `devToken` (the raw invite token) to `POST /orgs/:orgId/invitations`, so the Postman collection can run without reading email. **Never set it outside local development.** The server refuses to start when it's `true` with `NODE_ENV=production`, and the config ignores it in production anyway. The automated tests force it off.

`frontend/.env` needs only `API_KEY`, set to the same value as the backend's. Don't give it a `VITE_` prefix, or it would be bundled into the browser code.

## Database structure

| Collection (model) | Main fields | Constraints |
|---|---|---|
| `users` (`User`) | `email`, `password` (bcrypt hash), `isVerified`, `name`, `phone`, `avatar`, `failedLoginAttempts`, `lockUntil` | unique `email` (stored trimmed and lowercase). The password and lock fields are never returned. |
| `organizations` (`Organization`) | `name` (2–100), `createdBy` → User, `ownerCount` | `ownerCount` always equals the number of owner memberships (see Security) |
| `organizationmembers` (`OrganizationMember`) | `org` → Organization, `user` → User, `role` | **unique `{ org, user }`**, so there are no duplicate memberships. The `role` enum is `owner`, `admin`, `member`, `viewer`. Indexes on `user` and `{ org, role }`. |
| `invitations` (`Invitation`) | `org`, `email`, `role` (`admin`, `member` or `viewer`), `tokenHash`, `invitedBy`, `status` (`pending`, `accepted` or `replaced`), `expiresAt`, `acceptedAt`, `acceptedBy`, `replacedAt` | unique `tokenHash`; **unique `{ org, email }` only for pending invitations** (a partial index); a TTL index removes expired pending invitations 7 days after they expire |
| `otps`, `refreshtokens` | email and login codes (bcrypt), refresh token hashes (SHA-256) | TTL cleanup |
| `tasks`, `tickets`, `files` | owned by one user (`user` or `owner`) | every query filters by the owner |

Relationships are ObjectId references (`ref`). MongoDB has no foreign keys, so the services keep them consistent. For example, deleting an organization deletes its memberships and invitations in the same transaction.

## RBAC permission matrix

| Action | owner | admin | member | viewer |
|---|:-:|:-:|:-:|:-:|
| View the org, its members and pending invitations | ✅ | ✅ | ✅ | ✅ |
| Rename the org | ✅ | ✅ | ❌ | ❌ |
| Delete the org (with all memberships and invitations, in one transaction) | ✅ | ❌ | ❌ | ❌ |
| Invite as `member` or `viewer` | ✅ | ✅ | ❌ | ❌ |
| Invite as `admin` | ✅ | ❌ | ❌ | ❌ |
| Cancel a pending invitation | ✅ | ✅ | ❌ | ❌ |
| Change a role between `member` and `viewer` | ✅ | ✅ | ❌ | ❌ |
| Make someone `admin` or `owner`, or demote an `admin` or `owner` | ✅ | ❌ | ❌ | ❌ |
| Remove a `member` or `viewer` | ✅ | ✅ | ❌ | ❌ |
| Remove an `admin` or `owner` | ✅ | ❌ | ❌ | ❌ |
| Transfer ownership (needs the owner's password) | ✅ | ❌ | ❌ | ❌ |
| Leave the org | ✅* | ✅ | ✅ | ✅ |

\* Except the last owner. Nobody can be invited as `owner`; a member becomes owner only through a role change by an owner or through ownership transfer.

**Where the checks live:** every organization route uses one reusable middleware, `requireRole(minRole)` (`src/middleware/requireRole.js`). It returns `404` if the caller isn't a member and `403` if their role is lower than `minRole`. Rules that also depend on the *target* member, such as "an admin can't touch an owner", live in one policy module, `src/utils/roles.js` (`canManageMember`, `canAssignRole`), which the services call. Controllers never check roles.

**Last owner:** an organization can have several owners, but the last one can't be demoted, removed or leave (`400` with a message that says why).

## API endpoints

Every request needs the `x-api-key` header. 🔒 means it also needs `Authorization: Bearer <access token>`. Interactive docs with request and response examples are at **`GET /api-docs`** (the page opens without the key; "Try it out" requests still need it) and the raw spec is at `GET /api-docs.json`.

**Auth**

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create an unverified account and email a 6-digit code. Returns `201`, or `200` if the account exists but isn't verified yet; `409` only for a verified email. |
| POST | `/auth/verify-email` | `{ email, otp, password }`. Verifies the account, sets the password and logs in. |
| POST | `/auth/resend-verification` | `{ email }`. Always returns the same `200`, so it can't be used to check which emails exist. |
| POST | `/auth/login/request-otp` | `{ email, password }`. Returns `{ loginToken, expiresInSeconds }` and emails a code. `401` wrong credentials, `403` unverified, `423` locked. |
| POST | `/auth/login/verify-otp` | `{ loginToken, otp }`. Returns `{ token, user }` and sets the refresh cookie. |
| POST | `/auth/refresh` | Rotates the refresh cookie and returns a new access token |
| POST | `/auth/logout` | Revokes the refresh token |
| POST | `/auth/login` | `410`: password-only login is disabled, so 2FA can't be skipped |

`/register`, `/verify-email` and `/resend-verification` without the `/auth` prefix are old aliases with the same rate limits.

**Organizations, members and ownership** 🔒

| Method | Path | Min role | Description |
|---|---|---|---|
| POST | `/orgs` | any verified user | Create an org; the caller becomes owner |
| GET | `/orgs` | | The caller's orgs, each with their role |
| GET | `/orgs/:orgId` | viewer | Org details and the caller's role |
| PATCH | `/orgs/:orgId` | admin | `{ name }` rename |
| DELETE | `/orgs/:orgId` | owner | Delete the org, its memberships and its invitations (transaction) |
| GET | `/orgs/:orgId/members` | viewer | Members, owners first |
| GET | `/orgs/:orgId/members/:userId` | viewer | One member |
| PATCH | `/orgs/:orgId/members/:userId/role` | admin | `{ role }` (target rules in the matrix) |
| DELETE | `/orgs/:orgId/members/:userId` | admin | Remove someone else (yourself: use `/leave`) |
| POST | `/orgs/:orgId/leave` | viewer | Leave the org |
| POST | `/orgs/:orgId/transfer-ownership` | owner | `{ newOwnerId, password }` |

**Invitations**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/orgs/:orgId/invitations` | 🔒 admin | `{ email, role }` send or re-send an invitation |
| GET | `/orgs/:orgId/invitations` | 🔒 viewer | Pending invitations (with an `expired` flag) |
| DELETE | `/orgs/:orgId/invitations/:inviteId` | 🔒 admin | Cancel a pending invitation |
| GET | `/invitations/:token` | API key only | Check a link and show the org name, role and expiry (for the invite page, before login) |
| POST | `/invitations/:token/accept` | 🔒 | Accept as the invited email |
| GET | `/invitations` | 🔒 | Invitations **received** by the logged-in user's email, from any org (pending and not expired) |
| POST | `/invitations/received/:inviteId/accept` | 🔒 | Accept a received invitation without the link (the verified email is the proof; someone else's invite id returns `404`) |
| POST | `/invitations/received/:inviteId/decline` | 🔒 | Decline a received invitation (it's deleted and its link stops working) |

**Tasks, tickets, profile and files** 🔒 (each user sees only their own)

| Method | Path | Description |
|---|---|---|
| GET / POST | `/tasks` | List or create (`{ title }`, at most 200 characters) |
| GET / PUT / DELETE | `/tasks/:id` | Read, update (`title` and/or `completed`) or delete |
| GET / POST | `/tickets` | List, or create (`multipart/form-data`: `title`, `description`, 0–3 `attachments`: JPEG, PNG, WebP or PDF, 2 MB each, 5 MB in total) |
| GET | `/tickets/:id` | One ticket |
| GET / PATCH | `/user/profile` | Profile; `{ name, phone }` update |
| POST | `/user/upload-avatar` | `multipart/form-data` field `avatar` (JPEG, PNG or WebP, 2 MB) |
| GET | `/files/:fileId` | Download your own file (avatar or attachment) |
| POST | `/files/:fileId/signed-url` | A 10-minute link that works without a token (for `<img src>`) |

**Error format:** every error is `{ message }`. Validation errors (`400`) add `errors: [{ field, message }]`. Rate limits (`429`) and account locks (`423`) add `retryAfter` (seconds) and `resetAt` plus a `Retry-After` header.

**Common status codes:** `400` validation or a broken business rule (for example the last owner) · `401` missing or invalid API key or token · `403` role too low, wrong invite email or wrong password · `404` not found **or not visible to you** · `409` conflict (already a member, invitation already accepted, a concurrent change) · `410` invitation expired or replaced · `423` account locked · `429` rate limited.

## Invitation workflow

1. An owner or admin calls `POST /orgs/:orgId/invitations` with `{ email, role }`. An admin can invite only `member` or `viewer`, and nobody can be invited as `owner`. If the email already belongs to a member of the org, the response is `409`.
2. The server creates a token with `crypto.randomBytes(32)` (43 base64url characters), stores **only its SHA-256 hash**, and sets `expiresAt` to exactly **48 hours** after creation.
3. After the database write is committed, the invitation email is sent with a link to `<FRONTEND_URL>/invitations/<token>`. With SMTP configured the link is never logged; without SMTP it's printed to the console for development.
4. Re-inviting an email that has a pending invitation marks the old one `replaced`, so its link stops working, and creates a new token.
5. The invite page calls `GET /invitations/:token` (no login) to show the org name, role and expiry.
6. The person logs in **with the invited email** and calls `POST /invitations/:token/accept`, or accepts it from their received list (`GET /invitations`, then `POST /invitations/received/:inviteId/accept`). **One transaction** checks the link, checks that the logged-in email matches, creates the membership with the invited role and marks the invitation `accepted`.

| Situation | Response |
|---|---|
| Unknown or cancelled token | `404` Invitation not found |
| Older than 48 hours | `410` expired |
| Replaced by a newer invitation | `410` |
| Already accepted (even if the member later left) | `409` |
| Logged in with a different email | `403` |
| Already a member | `409` |
| Several accepts of one link at the same time | exactly one `200`, one membership |

Expired pending invitations are deleted automatically 7 days after they expire. Accepted and replaced ones are kept as history, and deleting an org deletes all its invitations.

## Ownership transfer

`POST /orgs/:orgId/transfer-ownership` with `{ newOwnerId, password }`. Only an owner can call it.

1. **Password check first,** before any database change. A wrong password returns `403` "Incorrect password". It's not `401`, because the frontend would treat a `401` as an expired session and refresh. Wrong passwords count toward the same lockout as login: 5 failures lock the account for 15 minutes (`423`).
2. The new owner must already be a member of the **same** org. Otherwise the response is `404`, including for a user who is in a different org. Transferring to yourself, or to someone who is already an owner, returns `400`.
3. **One transaction:** the chosen member becomes `owner`, the previous owner becomes `admin`, and `ownerCount` goes up by one and back down. If any step fails, nothing changes. If two transfers run at the same time, only one succeeds and the other returns `409`.

The response is `{ message, newOwner, previousOwner }`. The password is never returned or logged.

## Security

- **Authentication:** an API key on every request (compared through SHA-256 with `timingSafeEqual`), then JWT access tokens that are HS256-only and need `exp` and a valid `sub`. The user must still exist. Refresh tokens rotate, and reusing an old one revokes all of the user's sessions.
- **Passwords:** bcrypt cost 12, at most 72 bytes, strong-password rules for new passwords. They never appear in responses, logs or JWTs.
- **Login protection:** 2FA email codes (single use, 5 minutes, 5 attempts, stored as bcrypt hashes), account lockout, per-IP rate limits, and the same timing and message for unknown and wrong accounts.
- **Authorization:** `requireRole(...)` on every organization route, and the target-member rules in `utils/roles.js`. Controllers never check roles.
- **Organization isolation (multi-tenancy):** every organization query filters by `orgId`, and membership is checked before anything else. A non-member gets **`404` "Organization not found"** for the org and everything inside it, whether the org exists or not, even with a valid ID or a malformed one. That way the response never confirms that an org exists. `404` also comes back before validation, so a bad request body doesn't reveal anything either. A member of org A can't use org A's routes to reach org B's members or invitations (`404`).
- **Concurrency:** writes that can remove an owner run in transactions and first atomically decrement `ownerCount`, but only when it's above 1. Two owners demoting, removing or leaving at the same time write the same document, MongoDB lets only one through, and the org never ends up with no owner. Unique indexes stop duplicate memberships and duplicate pending invitations.
- **Invitation tokens:** 256 random bits; only the SHA-256 is stored and `tokenHash` is never returned. Tokens are single use, expire after 48 hours, and are replaced on re-invite. The org name is HTML-escaped in the email.
- **Uploads:** server-generated file names, real-content (magic-byte) checks, files served with the owner checked and helmet's `nosniff`.
- **Errors:** a central error handler that never echoes database or parser messages, which can contain request data such as passwords; unexpected errors become a generic `500`.

## Running tests

```bash
cd backend
npm test
```

This runs every `test/*.test.js` with Node's built-in test runner (currently **188 tests**). It needs MongoDB **as a replica set**. Each file creates its own `<db>_<name>_test` database and drops it afterwards, so your data isn't touched. Emails are captured instead of sent, and `EXPOSE_DEV_OTP` is forced off.

| File | Covers |
|---|---|
| `auth`, `loginotp`, `lockout`, `validation`, `ratelimit` | Register, 2FA, lockout, validation shapes, real rate limits |
| `tasks`, `tickets`, `avatar`, `profile` | Per-user resources and uploads |
| `orgs` | Org CRUD, `requireRole`, isolation, delete rollback |
| `members` | List, details, roles, remove, leave, last owner, concurrent changes, rollback, `ownerCount` |
| `invitations` | All invite rules: replace, expiry, wrong email, single use, concurrent accepts, rollback, `devToken` disabled in production |
| `transfer` | Password check, lockout, transaction rollback, concurrent transfers |
| `docs` | Every route is documented and has no broken `$ref` |

One file: `node --env-file=.env --test test/members.test.js`; one test: add `--test-name-pattern="<regex>"`.

## Postman and Newman

The collection is `postman/Node-Backend-API.postman_collection.json`, with the folders **Auth**, **Tickets**, **Files** and **Orgs** (the last one has the subfolders **Invitations**, **Members** and **Ownership**). It runs end to end with no manual steps: 77 requests and 236 assertions.

**Before running:** the backend must be running with `EXPOSE_DEV_OTP=true` in `backend/.env`, so the collection can read email codes and invite tokens from the responses.

**From the terminal (Newman):**

```bash
cd backend
npm run test:postman             # local environment
npm run test:postman -- staging  # staging environment
```

This passes `API_KEY` from `.env` (the committed environment files keep it empty) and writes an HTML report to **`postman/reports/report-local.html`** (or `report-staging.html`; the folder is gitignored). For `local` it then runs `npm run postman:cleanup`, which deletes only the run's test users (`pm-a-*` and `pm-b-*@example.test`) together with their orgs, memberships, invitations, tasks, tickets and files. Each run registers 2 users, and the register limit is 10 per hour per IP, so 5 runs fit in an hour; restarting the server resets the in-memory limit.

**In the Postman app:**

1. Import the collection and `postman/environments/local.postman_environment.json` (`staging` differs only in `baseUrl`).
2. In the `local` environment, set `apiKey` to the backend's `API_KEY`. Keep it a local value so it isn't synced.
3. Set **Settings → General → Working directory** to the `postman/` folder, so the ticket upload finds `fixtures/sample.png`.
4. Select `local` and run the collection with the Collection Runner. Afterwards, run `npm run postman:cleanup` from `backend/`.

When the collection changes, re-import only the collection file; re-importing the environment would clear `apiKey`.

**How the Orgs folder works:** user A creates the org. User B is invited using the `devToken` from the response and joins as `admin`, then the owner changes B to `member` and then to `viewer`, and each role's allowed and denied actions are checked. Then ownership goes to B and both orgs are deleted. The negative cases are: unverified login, empty name, owner-role invite, invalid email, wrong-email accept, accepting twice, inviting an existing member, a replaced link (`410`), admin inviting an admin, cancelled and invalid tokens, admin removing the owner or deleting the org, member and viewer permission errors, invalid role, the last owner demoting or leaving, cross-org access (`404`), wrong transfer password and a viewer attempting a transfer. Expired invitations can't be simulated in Postman, because it can't move time forward; `npm test` covers them.
