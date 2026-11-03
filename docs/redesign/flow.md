# TaskDesk Redesign — Screens, Flows & States

Every screen and state the redesign has to cover. For each one: what the user sees today, what changes visually, and what behaviour **must stay exactly the same**. This doubles as the manual test script for the final review.

---

## 1. Navigation map

```
          (logged out)                         (logged in)
   ┌───────────────┐   201/200    ┌───────────────┐
   │   /register   │────────────▶ │ Verify screen │──┐ code ok
   └──────┬────────┘              └───────────────┘  │
          │ link                                     ▼
   ┌──────▼────────┐  200                    ┌──────────────┐
   │    /login     │───────────────────────▶ │  /dashboard  │◀─┐
   └──────┬────────┘                         └──┬────────┬──┘  │ navbar
          │ 403 → inline verify ─ code ok ──────┘        │     │
                                                   ┌─────▼──┐ ┌▼────────┐
   any unknown URL → 404 page                      │/tickets│ │/profile │
   "/" → /dashboard (→ /login if no token)         └────────┘ └─────────┘
   session refresh fails → /login + "Session expired" alert
```

Navbar is visible only when logged in. Login/Register redirect to `/dashboard` if a token exists.

---

## 2. Auth flows

### 2.1 Login (`/login`)

| State | Today | After redesign | Must stay |
|---|---|---|---|
| Default | Split card, indigo panel | Centred 400px card: logo → "Welcome back" → email, password, Login → "No account? Register" below card | Fields, autocomplete, required |
| Session expired | Alert above form | Same alert, new radius | `notice` from context shown, cleared on submit |
| Submitting | Button "Please wait…" disabled | Same text, `md` height | Single request |
| 401 wrong password | Red alert | Same | Generic message |
| 423 locked / 429 limited | Red alert | Same | Message from backend |
| 403 unverified | Inline verify below divider | Same position, new VerifyEmail look | Uses the email+password that got 403, not current inputs; no "code sent" wording |
| Verified | → `/dashboard` | Same | `login(data)` + replace navigation |

### 2.2 Register (`/register`)

| State | After redesign | Must stay |
|---|---|---|
| Default | Centred card, email, password + one-column checklist | Live checklist from `passwordChecks` |
| Weak password submit | Red alert (client) | No request sent |
| 201 / 200 | Second screen "Verify your email" with code input | Same screen for both; email normalised |
| 409 | Red alert + "already have an account — Login" line | No verify screen |
| "Wrong email? Back" | Ghost button in footer | Clears password + alert |

### 2.3 Verify email (component in both)

| State | After redesign | Must stay |
|---|---|---|
| Code sent | Plain paragraph with bold email, 48px mono OTP input, primary "Verify & login", ghost "Send new code (60s)" | 60s countdown on register, digits-only, max 6, `one-time-code` |
| Not sent (from login 403) | Paragraph tells user to request a code | Countdown starts at 0 |
| Resend ok / 429 | Alert above; countdown restarts | 429 restarts the countdown |
| Wrong code | Red alert | Button re-enabled |

---

## 3. Tasks (`/dashboard`)

Layout after redesign:

```
Tasks                                         [↻ Refresh]
Good evening, hamza
┌──────────────────────────────────────────────────────┐
│ [ + New task…                         ] [ Add task ] │
│                                            12/200    │
├──────────────────────────────────────────────────────┤
│ [All 8 | Pending 5 | Done 3]        3 of 8 done ▬▬▭▭ │  ← only when tasks exist
├──────────────────────────────────────────────────────┤
│ ☐ Write report                              ✎  🗑   │
│ ☑ ~~Call bank~~                                      │
└──────────────────────────────────────────────────────┘
```

| State | After redesign | Must stay |
|---|---|---|
| Loading | Skeleton rows inside the panel | `sr-only` text; StrictMode double GET is fine |
| No tasks | Form + EmptyState "No tasks yet"; toolbar hidden | Same copy |
| Filter empty (Done / Pending) | EmptyState variant | Local filtering, `aria-pressed` |
| Add | Toast "Task added: …" (3s) | Input cleared only on success; `maxLength` 200 + counter (red near limit) |
| Toggle | Checkbox fills, title muted + strikethrough | `PUT { completed }`; toast "Done/Pending: …" |
| Edit | Row turns into input + Save + Cancel (same height) | Enter saves, Esc cancels, unchanged title sends nothing |
| Delete | 1st click → red "Delete?" (3s), 2nd click deletes | Two-click confirm, 3s timeout |
| 404 on toggle/delete | Row removed + toast | `onNotFound` path |
| Busy | All buttons disabled, refresh icon spins | `inFlight` ref guard |
| Error | Red toast with close | Error stays until next action / close |
| Actions visibility | Hover/focus on mouse; always on touch (40px) | `pointer-fine` behaviour |

Mobile: header action shows icon only; toolbar wraps (filter on one line, progress on the next); long titles wrap (`wrap-anywhere`), never horizontal scroll.

---

## 4. Support tickets (`/tickets`)

```
Support
Describe the problem — screenshots or PDF welcome.
┌─ New ticket ──────────────┐  ┌─ My tickets  3 ─────────────────────┐
│ Title                     │  │ Login button does nothing    2h ago │
│ [                       ] │  │ #a1b2c3                             │
│ Description               │  │ When I click login on Safari …      │
│ [                       ] │  │ Read more                            │
│ Attachments (optional)    │  │ [▣ shot.png 210 KB ⤓] [▤ log.pdf ⤓] │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │  ├─────────────────────────────────────┤
│   Drop files or browse    │  │ …                                    │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │  └─────────────────────────────────────┘
│ 1 of 3 files · 0.2/5 MB ▬ │
│ [ Submit ticket         ] │
└───────────────────────────┘
```

| State | After redesign | Must stay |
|---|---|---|
| Loading / empty | Skeleton / EmptyState inside the list panel | — |
| Title too short | Red caption under field, submit disabled | 5–100 after trim, counter |
| Description | Counter caption | ≤ 1000 |
| Files picked | Compact chips with thumbnail/PDF label, size, remove | Multiple picks append, duplicates skipped, object URLs revoked |
| Invalid file / 4th file / > 5 MB | Chip turns red, error caption, submit disabled | Never silently dropped |
| Drag over | Drop zone `primary-soft` + `border-primary` | Drop disabled when full/busy |
| Uploading | Progress fill inside submit button with % | `onUploadProgress` |
| Created | New ticket on top, toast | Form cleared only on success |
| Long description | Clamped to 3 lines + "Read more / Show less" | `aria-expanded` |
| Image attachment | 32px thumbnail opens full image in new tab | Signed URL, `noopener` |
| Download | 32px (40px touch) button | Blob download, errors → toast |

Mobile: form first, list below (unchanged order). Chips wrap; filename truncates.

---

## 5. Profile (`/profile`)

```
Profile
Your name, phone and photo. Email can't be changed.
┌──────────────────────────────────────────────────────┐
│ Photo              (◯)  [Change photo]               │
│ Shown in the       JPEG, PNG or WebP, up to 2 MB     │
│ navbar                                               │
├──────────────────────────────────────────────────────┤
│ Personal info      Email   hamza@example.com         │
│ Used across the    Name    [                    ]    │
│ app                Phone   [                    ]    │
│                            03XXXXXXXXX — 11 digits   │
├──────────────────────────────────────────────────────┤
│                                           [ Save ]   │
└──────────────────────────────────────────────────────┘
```

| State | After redesign | Must stay |
|---|---|---|
| Loading | Skeleton in the Personal info section | Form hidden until `GET /user/profile` returns |
| Unchanged | Save disabled | Only changed fields sent |
| Client error | Red border on field + red caption | `profileFieldErrors` |
| Server 400 | Per-field captions + toast | Editing a field removes only its server error (key deleted) |
| Saved | Toast (3s) | Session + navbar updated |
| Avatar uploading | Avatar dimmed, button "Uploading…" | `avatarFileError` first, FormData upload |
| Avatar error | Red caption | — |

Mobile: sections stack (label above controls); Save button full width at the bottom.

---

## 6. 404

Centred text block: small "404" caption, "This page doesn't exist", one line of help, secondary "Back to home". No card.

---

## 7. Cross-cutting states

| Concern | Rule |
|---|---|
| Focus | Every interactive element shows the 2px primary outline on keyboard focus; inputs show border + 2px soft ring |
| Disabled | 50% opacity, `not-allowed` cursor |
| Dark mode | Every state above checked in dark too |
| Long text | `wrap-anywhere` on titles, messages, emails; no horizontal scroll at 320px |
| Reduced motion | Pulse/spin respect `motion-reduce:animate-none` |
| Toast | One at a time; success auto-hides after 3s, errors stay until closed |
