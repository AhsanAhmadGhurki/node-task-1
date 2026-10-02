# Tasks API

Express + MongoDB REST API with JWT auth (`backend/`) and a small React + Vite UI for testing it in the browser (`frontend/`).

## Setup

**Backend**: copy `backend/.env.example` to `backend/.env` and fill in:

```
PORT=3000
API_KEY=...
MONGO_URI=...
JWT_SECRET=...
```

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
| POST | `/register` | API key. The password needs 8+ characters and a number. Logs a verification link to the console |
| GET | `/verify/:token` | public. The link expires after 24h and works only once |
| POST | `/resend-verification` | API key, body `{ email }`. Logs a new link, and the old one stops working |
| POST | `/auth/login` | API key, returns `{ token, user }` |
| GET / POST | `/tasks` | API key + JWT |
| GET / PUT / DELETE | `/tasks/:id` | API key + JWT |
