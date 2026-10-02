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
