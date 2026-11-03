# TaskDesk Redesign — Frontend Structure & Change Map

Which files change, what changes in each, and what stays untouched. Read with [design.md](design.md).

Rule: **styling only.** No new pages, no new routes, no new state, no API changes. No new components unless noted (none are planned).

---

## 1. Current UI structure

```
frontend/
├── index.html                 body classes, theme-color
├── public/favicon.svg         indigo tile + tick
└── src/
    ├── index.css              tokens (light/dark) + @theme inline
    ├── ui/
    │   ├── styles.js          shared class sets: panel, card, input, button(), badge …
    │   └── icons.jsx          inline SVG icons + LogoMark
    ├── App.jsx                <Navbar/> + <main> + routes
    ├── components/
    │   ├── Navbar.jsx         sticky header (only when logged in)
    │   ├── AuthLayout.jsx     split card for Login/Register
    │   ├── PasswordInput.jsx  password field + show/hide
    │   ├── VerifyEmail.jsx    6-digit code + resend countdown
    │   ├── Alert.jsx          inline message (auth pages)
    │   ├── Toast.jsx          floating message (Dashboard/Tickets/Profile)
    │   ├── Avatar.jsx         image or initial
    │   ├── AvatarUpload.jsx   Profile photo + "Photo badlo"
    │   ├── TaskForm.jsx       add-task input
    │   ├── TaskItem.jsx       task row (toggle / edit / delete)
    │   ├── TicketForm.jsx     ticket form + attachments
    │   ├── TicketItem.jsx     ticket card + attachment chips
    │   ├── EmptyState.jsx     empty list placeholder
    │   ├── Loader.jsx         skeleton rows
    │   └── ProtectedRoute.jsx (logic only)
    └── pages/
        ├── Login.jsx  Register.jsx
        ├── Dashboard.jsx  Tickets.jsx  Profile.jsx
        └── NotFound.jsx
```

---

## 2. Change map

Legend: **T** tokens/theme · **S** shared styles · **L** layout/markup classes · — no change

### Foundation (done first; every page picks these up automatically)

| File | Kind | Change |
|---|---|---|
| [frontend/src/index.css](../../frontend/src/index.css) | T | New palette (design.md §4), add `--app-input` → `--color-input`. Remove `--text-sm/xs--line-height: normal`. Add one `--text-small` (13px / 18px) theme size → `text-small`. |
| [frontend/index.html](../../frontend/index.html) | T | `theme-color` → `#2557d6`; drop `leading-[normal]` from `<body>`. |
| [frontend/public/favicon.svg](../../frontend/public/favicon.svg) | T | Fill → `#2557d6`, `rx` 8 → 7. |
| [frontend/src/ui/styles.js](../../frontend/src/ui/styles.js) | S | See §3. |
| [frontend/src/ui/icons.jsx](../../frontend/src/ui/icons.jsx) | L | `LogoMark` only: `rounded-md`, no shadow, default `size-7`. Icons themselves unchanged. |

### Shell

| File | Kind | Change |
|---|---|---|
| [frontend/src/App.jsx](../../frontend/src/App.jsx) | L | `<main>` gets the shared container (`max-w-4xl`). Auth pages keep their own centring inside it. |
| [frontend/src/components/Navbar.jsx](../../frontend/src/components/Navbar.jsx) | L | Solid background, `h-14`, `max-w-4xl`, neutral active link, `pointer-coarse` sizes. |

### Auth

| File | Kind | Change |
|---|---|---|
| [frontend/src/components/AuthLayout.jsx](../../frontend/src/components/AuthLayout.jsx) | L | Rewrite markup: logo row → 400px card (heading, description, children) → footer under the card. Same props (`heading`, `description`, `children`, `footer`), so Login/Register don't change how they call it. |
| [frontend/src/pages/Login.jsx](../../frontend/src/pages/Login.jsx) | L | Submit button size `lg` → `md`. Nothing else. |
| [frontend/src/pages/Register.jsx](../../frontend/src/pages/Register.jsx) | L | Submit size; password checklist to one column + smaller dot. |
| [frontend/src/components/VerifyEmail.jsx](../../frontend/src/components/VerifyEmail.jsx) | L | Info box → paragraph; OTP input `h-12`; resend → `ghost`. |
| [frontend/src/components/PasswordInput.jsx](../../frontend/src/components/PasswordInput.jsx) | L | Use `inputBase` + new padding (`h-9 pl-3 pr-10`); toggle button 28px inside. |
| [frontend/src/components/Alert.jsx](../../frontend/src/components/Alert.jsx) | L | `rounded-md`, spacing. |

### Tasks

| File | Kind | Change |
|---|---|---|
| [frontend/src/pages/Dashboard.jsx](../../frontend/src/pages/Dashboard.jsx) | L | Page header classes; merge progress + form + filter + list into **one panel** (same JSX pieces, re-nested); remove own `max-w-2xl`. No handler/state changes. |
| [frontend/src/components/TaskForm.jsx](../../frontend/src/components/TaskForm.jsx) | L | Input `h-9`, button `md`. |
| [frontend/src/components/TaskItem.jsx](../../frontend/src/components/TaskItem.jsx) | L | 16px checkbox, `text-sm` title, row padding, `sm`/`icon` buttons, `danger` confirm. |
| [frontend/src/components/EmptyState.jsx](../../frontend/src/components/EmptyState.jsx) | L | Drop icon tile; sizes. |
| [frontend/src/components/Loader.jsx](../../frontend/src/components/Loader.jsx) | L | Bar radius only. |

### Tickets

| File | Kind | Change |
|---|---|---|
| [frontend/src/pages/Tickets.jsx](../../frontend/src/pages/Tickets.jsx) | L | Header, grid ratio inside `max-w-4xl`, list becomes one `panel` with `divide-y`. |
| [frontend/src/components/TicketForm.jsx](../../frontend/src/components/TicketForm.jsx) | L | Simpler drop zone, merged size caption, compact file chips, `md` submit. Drag/drop, validation, preview URLs, progress untouched. |
| [frontend/src/components/TicketItem.jsx](../../frontend/src/components/TicketItem.jsx) | L | `<li>` becomes a row (no own border/radius), type sizes, chip + 32/40px download button. |

### Profile

| File | Kind | Change |
|---|---|---|
| [frontend/src/pages/Profile.jsx](../../frontend/src/pages/Profile.jsx) | L | Settings layout (two-column sections on `md`), email as labelled read-only text, Save in card footer, right-aligned. Same form, same handlers. |
| [frontend/src/components/AvatarUpload.jsx](../../frontend/src/components/AvatarUpload.jsx) | L | Fits the "Photo" section; heading moves to the section label. |
| [frontend/src/components/Avatar.jsx](../../frontend/src/components/Avatar.jsx) | L | Neutral fallback, `sm` 32 / `lg` 64, no rings. |

### Shared feedback / misc

| File | Kind | Change |
|---|---|---|
| [frontend/src/components/Toast.jsx](../../frontend/src/components/Toast.jsx) | L | `rounded-lg`, `shadow-md`, width rules. |
| [frontend/src/pages/NotFound.jsx](../../frontend/src/pages/NotFound.jsx) | L | No card; caption-sized 404; secondary button. |

### Not touched

`src/api/*`, `src/context/AuthContext.jsx`, `src/hooks/*`, `src/utils/helpers.js`, `src/main.jsx`, `components/ProtectedRoute.jsx`, `vite.config.js`, `package.json` (unless Q5 = B), everything in `backend/`.

Optional, only if approved: string edits for Q3 (language) and the one-line greeting change for Q4.

---

## 3. `ui/styles.js` — before / after

Names are kept wherever possible so call sites barely change.

| Export | Before | After |
|---|---|---|
| `focusRing` | outline-2 offset-2 primary | same |
| `panel` | `rounded-2xl border bg-card shadow-sm` | `rounded-lg border border-border bg-card` |
| `card` | `panel p-6 sm:p-8` | `panel p-5 sm:p-6` |
| `pageTitle` | `text-2xl … sm:text-3xl` | `text-2xl font-semibold tracking-tight` |
| `titleText` | `text-lg font-semibold` | `text-base font-semibold` |
| `subtitle` | `mt-1 text-sm text-muted` | same |
| **`pageHeader`** *(new class set)* | — | `mb-6 flex items-end justify-between gap-4` — wrapper for title/description/action |
| **`sectionLabel`** *(new)* | — | Profile settings left column: `text-sm font-medium` + caption |
| `form` / `field` | gap-4 / gap-1.5 | same |
| `label` | `text-sm font-medium` | same |
| `inputBase` | `rounded-xl … shadow-xs focus:ring-4 ring-primary/15` | `rounded-md border-input bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-error-text` (no shadow) |
| `input` | `inputBase px-3.5 py-2.5` | `inputBase h-9 px-3` |
| `hint` / `hintText` / `muted` / `link` | — | same |
| `badge` | `rounded-full px-2` | `rounded-md px-1.5` |
| `button()` sizes | md, lg, compact, sm, icon | **sm `h-8 px-3`, md `h-9 px-3.5`, icon `size-8 pointer-coarse:size-10`** (`lg`, `compact` removed; callers → `md`) |
| `button()` variants | primary has `shadow-sm`, secondary `shadow-xs`, danger solid on hover | no shadows; secondary/danger use `border-input`; danger hover `bg-error-bg` |
| `button()` base | `rounded-xl` | `rounded-md text-sm` |

Call sites using removed sizes (to update): `Login` (`lg`), `Register` (`lg`), `VerifyEmail` (`lg`), `Profile` (`lg`), `TicketForm` (`lg`), `TaskForm` (`compact`), `TaskItem` (`compact` ×2).

---

## 4. Conventions kept during implementation

- Tailwind classes in JSX only; `index.css` holds tokens and `@import` only.
- Never append a class that overrides a property the shared set already sets (e.g. `cn(input, 'px-4')`) — add an option or use the `*Base` / `*Text` variant.
- Code comments in Roman Urdu explaining the "why".
- No new icon library, no external fonts (unless Q5 = B).
- `npm run lint` and `npm run build` must pass after every step.
