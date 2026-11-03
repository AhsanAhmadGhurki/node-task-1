# TaskDesk Redesign — Implementation Plan & QA Checklist

Starts **only after approval** of [design.md](design.md) (including answers to Q1–Q5).

## Steps

Each step ends with: `npm run lint`, `npm run build`, screenshots at **1280px and 375px, light and dark** via the browser, and a fix pass before moving on.

| # | Step | Files | Check |
|---|---|---|---|
| 0 | Baseline screenshots of every page/state (for before/after) | — | Uses a `+qa-redesign@example.test` user, deleted afterwards per CLAUDE.md |
| 1 | Foundation: tokens, type scale, `styles.js`, favicon, `index.html`, LogoMark | `index.css`, `styles.js`, `icons.jsx`, `index.html`, `favicon.svg` | Every page still renders; no class conflicts |
| 2 | Shell: container + navbar | `App.jsx`, `Navbar.jsx` | Logo / title / content edges line up on all pages |
| 3 | Auth: AuthLayout, Login, Register, VerifyEmail, PasswordInput, Alert | auth files | Login 401/403/423, register 201/409, verify, resend countdown |
| 4 | Tasks: one-panel dashboard, TaskForm, TaskItem, EmptyState, Loader | dashboard files | Add/toggle/edit/delete/404, filters, touch vs mouse actions |
| 5 | Tickets: page grid, TicketForm, TicketItem | ticket files | Files add/remove/invalid/4th/drag, upload progress, download, preview |
| 6 | Profile: settings layout, AvatarUpload, Avatar | profile files | Load, partial save, client + server errors, avatar upload |
| 7 | Toast, 404, copy (Q3) and greeting (Q4) if approved | `Toast.jsx`, `NotFound.jsx` | — |
| 8 | Final review (below) + update `CLAUDE.md` frontend section to describe the new styles API | `CLAUDE.md` | — |
| 9 | Delete all QA data, confirm by DB query, report | — | Users, tasks, otps, refresh tokens, tickets, avatar/ticket files |

No commits — the user commits.

## Final QA checklist

**Consistency**
- [ ] One container width; logo, page titles and content share a left edge on every page
- [ ] Only radii: `rounded-md` (controls/chips), `rounded-lg` (panels/toast), `rounded-full` (avatar, dots, bars)
- [ ] Only shadow in the app is the toast
- [ ] All buttons are 32px or 36px (40px icon buttons on touch); inputs 36px (OTP 48px)
- [ ] Type sizes only from the scale (24 / 16 / 14 / 13 / 12); weights 400/500/600
- [ ] All icons 16px (empty states 20px); no icon on a coloured tile
- [ ] No `indigo`/`#4f46e5` left (`grep -ri "4f46e5\|indigo" frontend/src frontend/index.html frontend/public`)
- [ ] No `rounded-2xl`, `rounded-3xl`, `rounded-xl`, `shadow-sm`, `backdrop-blur`, `ring-4` left (`grep`)

**Responsive**
- [ ] 320px, 375px, 768px, 1024px, 1440px: no horizontal scroll, nothing overlaps
- [ ] Navbar fits at 320px
- [ ] Long unbroken titles / emails / filenames wrap or truncate

**Accessibility**
- [ ] Text contrast ≥ 4.5:1 in both themes (values in design.md §4)
- [ ] Keyboard: every control reachable, visible focus, filter `aria-pressed`, Esc cancels edit
- [ ] Labels, `aria-label`s and `sr-only` text unchanged or improved

**No regressions** — run every row in [flow.md](flow.md) §2–§5 by hand, plus `npm test` in `backend/` (should be unaffected).
