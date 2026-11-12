# Tasks API

Express + MongoDB REST API with JWT auth (`backend/`) and a small React + Vite UI for testing it in the browser (`frontend/`).

## Setup

**Backend**: copy `backend/.env.example` to `backend/.env` and fill in:

```
PORT=3000
APP_URL=http://localhost:3000   # public backend URL used in email links; change for production
API_KEY=...
MONGO_URI=...
JWT_SECRET=...
SMTP_USER=you@gmail.com      # optional: send real verification emails
SMTP_PASS=xxxxxxxxxxxxxxxx   # Gmail App Password (not your normal password)
```

Without `SMTP_USER`/`SMTP_PASS`, verification links are only printed to the backend console. For Gmail, turn on 2-Step Verification and create an App Password at https://myaccount.google.com/apppasswords.

**Frontend**: copy `frontend/.env.example` to `frontend/.env` and set `API_KEY` to the same value as the backend's.

```
cd backend && npm install
cd frontend && npm install
```

## Run

Use two terminals:

```
cd backend && npm run dev     # API on http://localhost:3000
cd frontend && npm run dev    # UI  on http://localhost:5173
```

Open http://localhost:5173 to register, log in, and load tasks.

## API

All requests need an `x-api-key` header, except `GET /verify/:token`, which is opened from the link in a browser. `/tasks` also needs `Authorization: Bearer <token>`.

| Method | Path | Auth |
|---|---|---|
| POST | `/register` | API key. Needs a valid email, and a password with 8+ characters and a number. Emails the verification link (printed to the console only when SMTP is not configured) |
| GET | `/verify/:token` | public. The link expires after 24h and works only once |
| POST | `/resend-verification` | API key, body `{ email }`. Emails a new link, and the old one stops working |
| POST | `/verify/resend` | public, HTML form on the verification page. Same as `/resend-verification` |
| POST | `/auth/login` | API key. Returns `{ token, user }` (access token, 15 min) and sets an httpOnly `refreshToken` cookie (7 days) |
| POST | `/auth/refresh` | API key + refresh cookie. Returns a new `{ token, user }` and rotates the cookie |
| POST | `/auth/logout` | API key. Revokes the refresh token and clears the cookie |
| GET / POST | `/tasks` | API key + JWT |
| GET / PUT / DELETE | `/tasks/:id` | API key + JWT |

**Rate limits:** each IP gets 5 resend requests per 15 minutes (shared by both resend routes) and 10 registrations per hour. Each email also gets at most one verification email per 60 seconds. Over the limit, the response is `429` with a `Retry-After` header.

## Workspaces and roles

Every user can belong to several organizations (workspaces). A role belongs to a **membership** (user + org), not to the user, so the same person can be an owner in one org and a viewer in another. Any verified user can create an org and becomes its first owner.

### Permission matrix

| Action | owner | admin | member | viewer |
|---|:-:|:-:|:-:|:-:|
| View the org, its members and pending invites | ✅ | ✅ | ✅ | ✅ |
| View the org's tasks and tickets | ✅ | ✅ | ✅ | ✅ |
| Create tasks and tickets | ✅ | ✅ | ✅ | ❌ |
| Edit or delete **own** tasks and tickets | ✅ | ✅ | ✅ | ❌ |
| Edit or delete **anyone's** tasks and tickets | ✅ | ✅ | ❌ | ❌ |
| Invite as `member` or `viewer` | ✅ | ✅ | ❌ | ❌ |
| Invite as `admin` | ✅ | ❌ | ❌ | ❌ |
| Cancel a pending invite | ✅ | ✅ | ❌ | ❌ |
| Remove a `member` or `viewer` | ✅ | ✅ | ❌ | ❌ |
| Remove an `admin` or `owner` | ✅ | ❌ | ❌ | ❌ |
| Change a role between `member` and `viewer` | ✅ | ✅ | ❌ | ❌ |
| Make someone `admin` or `owner`, or demote an `admin`/`owner` | ✅ | ❌ | ❌ | ❌ |
| Transfer ownership (needs the owner's password) | ✅ | ❌ | ❌ | ❌ |
| Delete the org | ✅ | ❌ | ❌ | ❌ |
| Leave the org | ✅* | ✅ | ✅ | ✅ |

\* Except the last owner.

### Rules

- **At least one owner.** An org can have several owners, but the last owner can't leave, be demoted or be removed: `400` with a clear message. The check and the change happen atomically, so two owners demoting each other at the same time can't leave the org with none.
- **Ownership transfer:** only an owner can transfer, and must re-enter their password (`401` if it's wrong). The chosen member becomes `owner` and the previous owner becomes `admin`.
- **Invites:** nobody can be invited as `owner`. The invite email contains a link with a random token that expires after **48 hours**; only its hash is stored. Inviting an email that is already a member returns `409`. Re-inviting a pending email replaces the old token, so the old link stops working.
- **Accepting an invite** requires being logged in with the same email the invite was sent to, otherwise `403`.
- **Isolation:** a user who isn't a member of an org gets `404` for that org and everything inside it (members, invites, tasks, tickets), even with a valid ID, so the response never reveals that it exists. A member whose role is too low gets `403`.
- **One place for checks:** every org route uses one reusable middleware, `requireRole(...)`. Controllers don't check roles themselves.
