# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Tasks REST API built on Express 5 + Mongoose 9 (MongoDB), CommonJS modules. There is no build step, linter, or test suite configured.

## Commands

- `npm run dev`: run with `node --watch` (auto-restart on file changes)
- `npm start`: run normally

Both use Node's built-in `--env-file=.env` (no dotenv package), so a `.env` file must exist. Copy `.env.example` and set `PORT` (default 4000), `MONGO_URI`, and `API_KEY`.

Every request needs an `x-api-key` header matching `API_KEY`, e.g.:
```
curl -H "x-api-key: $API_KEY" http://localhost:4000/tasks
```

## Architecture

Layered flow: `routes → (validation middleware) → controllers → services → models`.

- **`src/index.js`** connects to MongoDB first, then starts the server. It exits the process if either step fails. **`src/app.js`** only builds the Express app, so it can be imported without starting a server.
- **Middleware order in `app.js` matters:** `express.json` → logger → API key check (after the logger so rejected requests still get logged) → `/tasks` routes → 404 handler → central error handler (always last).
- **Config:** `process.env` is read only in `src/config/index.js`. Everything else imports that config module.
- **Separation of concerns:** controllers handle req/res and never touch Mongoose. All DB access goes through `src/services/taskService.js`.
- **Error handling:** controllers wrap their logic in try/catch and call `next(err)`. Services throw `NotFoundError` (from `src/utils/`, it carries `statusCode = 404`). `src/middleware/errorHandler.js` maps Mongoose `CastError` (bad ObjectId or bad type) and `ValidationError` to 400, uses `err.statusCode` when it's set, and returns 500 otherwise. Every error response has the shape `{ message }`. To add a new HTTP error type, create an Error subclass with a `statusCode`.
- **Validation is two-layered:** `src/middleware/validation.js` checks the POST body before it reaches the controller. The Mongoose schema rules (`required`, `trim`) also apply on updates because `findByIdAndUpdate` is called with `runValidators: true`.
- **Express 5 specifics:** `req.body` is `undefined` when no body is sent, so code guards with `req.body || {}`. `app.listen` reports startup errors (such as a port already in use) through its callback's `error` argument.
- **Partial updates:** PUT only changes fields that are `!== undefined`, so `completed: false` still counts as a real update.

## Conventions

Code comments are written in Roman Urdu/Hindi, explaining the "why". Match this style when adding comments.
