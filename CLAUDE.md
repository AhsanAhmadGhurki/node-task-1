# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Two separate apps:
- **`backend/`**: Tasks REST API built on Express 5 + Mongoose 9 (MongoDB), CommonJS, with JWT auth (bcryptjs + jsonwebtoken). No build step, linter, or test suite.
- **`frontend/`**: React + Vite single-page app (ESM) for manually testing register, login, resend verification and task CRUD in the browser. Tasks load automatically after login; you can add, toggle and delete them. It has no router; everything is in `src/App.jsx`, and every `/tasks` call goes through `taskApi()`, which logs the user out on a 401.

## Commands

Backend (run from `backend/`):
- `npm run dev`: run with `node --watch` (auto-restart on file changes)
- `npm start`: run normally

Both use Node's built-in `--env-file=.env` (no dotenv package), so `backend/.env` must exist with `PORT` (default 3000), `MONGO_URI`, `API_KEY` and `JWT_SECRET`, plus the optional `SMTP_USER` and `SMTP_PASS` for real emails.

Frontend (run from `frontend/`):
- `npm run dev`: Vite dev server on http://localhost:5173
- `npm run build`, `npm run lint` (oxlint)

`frontend/.env` must contain `API_KEY` with the same value as the backend's.

Every API request needs an `x-api-key` header. `/tasks` routes also need `Authorization: Bearer <token>` from `POST /auth/login`:
```
curl -H "x-api-key: $API_KEY" -H "Authorization: Bearer $TOKEN" http://localhost:3000/tasks
```

## Frontend ↔ backend

The browser never calls `localhost:3000` directly. `frontend/src/api.js` fetches `/api/...`, and the Vite proxy in `frontend/vite.config.js` strips `/api`, forwards the request to the backend, and **adds the `x-api-key` header server-side** (read with `loadEnv` and no `VITE_` prefix). Because of this, the backend has no CORS middleware and the API key never reaches the browser bundle. Don't expose it with a `VITE_` variable.

## Backend architecture

Layered flow: `routes → (validation middleware) → controllers → services → models`. All paths below are under `backend/src/`.

- **`index.js`** first runs `config/validateEnv.js`, which checks for required `MONGO_URI`, `API_KEY` and `JWT_SECRET` (at least 32 characters), that `SMTP_USER` and `SMTP_PASS` are set together, and that `PORT` and `APP_URL` are valid. It lists every problem and exits with code 1. After that it connects to MongoDB, then starts the server. It exits the process if either step fails. **`app.js`** only builds the Express app, so it can be imported without starting a server.
- **Middleware order in `app.js` matters:** `express.json` → logger → `GET /verify/:token` (public, mounted before the API key check because the link is opened in a browser without headers) → API key check (global, after the logger so rejected requests still get logged) → `/tasks` (with `authMiddleware`) → `authRoutes`, mounted at the root with full paths: `POST /register` and `POST /auth/login` (no JWT check, since login is where the token is issued) → `POST /resend-verification` → 404 handler → central error handler (always last).
- **Auth:** `services/authService.js` hashes passwords with bcrypt on register, and on login compares the password and signs a JWT with `{ sub: user.id }` (1-hour expiry). `middleware/auth.js` verifies `Bearer` tokens (HS256 only) and sets `req.user = { id }`. The `User` model's `toJSON` removes `password`, so it's safe to return user documents. Login gives the same 401 message for an unknown email and a wrong password.
- **Email verification:** register uses `validateRegister` (8+ characters, at least one digit; login keeps the looser `validateAuth`) and bcrypt cost 12. It stores `isVerified: false`, plus `verificationTokenHash` (the SHA-256 of a `crypto.randomBytes(32)` hex token) and `verificationTokenExpires` (24h). The raw token exists only in the link, which `services/emailService.js` prints to the console **only when SMTP is not configured** (labelled `[dev — SMTP not configured]`; with SMTP the raw token is never logged, and `middleware/logger.js` masks `/verify/<token>` in request logs) (`${APP_URL}/verify/<token>`; `config.appUrl` comes from `APP_URL`, falls back to `http://localhost:${PORT}`, and has any trailing slash removed) and also emails through Nodemailer when `SMTP_USER`/`SMTP_PASS` are set (default host `smtp.gmail.com:465`, configured in `config.smtp`). Register and resend call it without `await`, so the response doesn't wait for SMTP (which takes 1–4s). A failed send is logged, not thrown, so this never causes an unhandled rejection. SMTP gives up after a 10s connection timeout, and an App Password pasted with spaces gets the spaces stripped in config. On verify, a malformed token gives 400; an unknown, used or replaced token gives 410; an expired one gives 410. Success sets `isVerified` and `$unset`s both token fields through an atomic `updateOne`. The verify controller uses `res.format`: browsers (`Accept: text/html`) get a small HTML page from `views/verifyPage.js` with the same status code, and API clients get `{ message }` JSON. Resend overwrites the hash, so the old link stops working. Failed verify pages include a resend form that posts to the public `POST /verify/resend` (urlencoded, mounted before the API key check). It shares the controller and `validateEmail` with `POST /resend-verification`. `views/verifyPage.js` exports `respondPage(res, status, {...})`, which sends an HTML page to browsers and `{ message }` JSON to everyone else; the verify and resend controllers and `validateEmail` all use it. **Rate limiting:** `middleware/rateLimit.js` (express-rate-limit, in-memory, keyed by IP) gives `resendLimiter` 5 per 15 minutes, shared by both resend routes, and `registerLimiter` 10 per hour. Both return 429 through `respondPage`. On top of that, a 60s per-email cooldown is stored in `User.verificationEmailSentAt` and checked atomically in `resendVerification` (`TooManyRequestsError`, 429). Behind a reverse proxy in production, set Express `trust proxy`, or every client shares one IP. Login returns 403 for unverified users. The check runs after the password check, so a wrong password still gives the generic 401 and does not reveal verification status.
- **Config:** `process.env` is read only in `config/index.js`. Everything else imports that config module.
- **Separation of concerns:** controllers handle req/res and never touch Mongoose. All DB access goes through `services/`.
- **Error handling:** controllers wrap their logic in try/catch and call `next(err)`. Services and middleware throw the Error subclasses in `utils/` (`BadRequestError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `GoneError` 410, `TooManyRequestsError` 429), each carrying a `statusCode`. `middleware/errorHandler.js` maps Mongoose `CastError` and `ValidationError` to 400 and MongoDB duplicate-key errors (`11000`) to 409, uses `err.statusCode` when it's set, and returns 500 otherwise. Every error response has the shape `{ message }`.
- **Validation is two-layered:** `middleware/validation.js` checks request bodies before they reach the controller (`validateCreateTask`, `validateAuth` for login, `validateRegister`, `validateEmail` for resend). Register and resend share `emailError()`, which needs the simple `x@y.z` shape; login doesn't check the format, since a bad email just gets 401. The Mongoose schema rules also apply on updates because `findOneAndUpdate` is called with `runValidators: true`.
- **Express 5 specifics:** `req.body` is `undefined` when no body is sent, so code guards with `req.body || {}`. `app.listen` reports startup errors (such as a port already in use) through its callback's `error` argument.
- **Partial updates:** PUT only changes fields that are `!== undefined`, so `completed: false` still counts as a real update.
- **Task ownership:** `Task.user` (ObjectId, `ref: "User"`, required) is always set from `req.user.id`, never from the request body. Every task service function takes `userId` and queries `{ _id: id, user: userId }` (or `{ user: userId }` for lists). Another user's task gives 404, not 403, so the response doesn't reveal whether that ID exists.

## Conventions

Code comments are written in Roman Urdu/Hindi, explaining the "why". Match this style when adding comments.
