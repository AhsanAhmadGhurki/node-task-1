# TaskDesk — Design Audit & Redesign Direction

Status: **Implemented (2026-11-03).** Decisions: Q1 A, Q2 A, Q3 A (wording unchanged), Q4 not done (no logic edits), Q5 A. Deviations found while building are listed in §12.

Related docs:
- [structure.md](structure.md) — which files change, and how the shared style API changes
- [flow.md](flow.md) — every screen and state that must look right (and keep working)
- [implementation-plan.md](implementation-plan.md) — order of work and the final QA checklist

Audit method: every file under `frontend/src/` that renders UI was read (`index.css`, `ui/styles.js`, `ui/icons.jsx`, all of `components/` and `pages/`, `index.html`, `public/favicon.svg`). Screenshots at 1280px and 375px (light and dark) will be taken during implementation, before and after each page.

---

## 1. Summary

The app is functionally solid and already has good foundations: semantic tokens, one shared class file, accessible labels, skeleton loaders, a toast instead of jumping alerts. The problem is the *visual voice*. It uses the exact defaults that make a product read as "generated": Tailwind indigo `#4f46e5`, very rounded everything (`rounded-2xl`/`rounded-3xl`), a shadow on every box, a saturated brand panel with translucent decorative circles, icon tiles in tinted squares, a frosted sticky header, and three stacked cards where one would do.

The direction: **a quiet, neutral, tool-like interface** — grey surfaces, one restrained blue used only for the primary action, focus and links, small radii, borders instead of shadows, a real type scale, and fewer boxes. Think of a well-made internal tool or issue tracker, not a landing page.

---

## 2. Current design problems

### 2.1 Things that read as "AI-generated"

| Where | What | Why it's a problem |
|---|---|---|
| `index.css` | Primary `#4f46e5` (Tailwind `indigo-600`), `primary-soft` lavender | The single most common AI/template colour. Instantly generic. |
| `AuthLayout.jsx` | Full-height indigo panel, two translucent decorative circles, icon tiles on white/15 | Decoration with no purpose; the textbook "SaaS template" hero. |
| `styles.js` `panel` | `rounded-2xl … shadow-sm` on every card | Soft, pillowy, everything floats. Shadows on static content add noise, not hierarchy. |
| `AuthLayout.jsx` | `rounded-3xl` outer card | Even rounder; inconsistent with the rest. |
| `styles.js` buttons/inputs | `rounded-xl` + `shadow-xs` + `focus:ring-4` halo | Bubbly controls; the 4px glow ring is the "glow" look. |
| `Navbar.jsx` | `bg-card/85 backdrop-blur` | Glassmorphism for no reason — content behind is a plain grey background. |
| `EmptyState.jsx`, `VerifyEmail.jsx`, `AuthLayout.jsx` | Icon inside a tinted rounded square | Generic decoration pattern; adds a colour block that competes with content. |
| `LogoMark` | Indigo tile + `shadow-sm` | Same indigo, plus a shadow on a logo. |
| `NotFound.jsx` | `text-6xl font-bold` indigo "404" | Shouty, decorative. |
| `Avatar.jsx` | Indigo fill + `ring-4 ring-primary-soft` on the large avatar | Another indigo block and a glow ring. |

### 2.2 Inconsistencies

- **Content widths don't line up.** Navbar is `max-w-5xl`, Dashboard and Profile are `max-w-2xl` centred, Tickets is `max-w-5xl`. Switching tabs, the page title jumps horizontally and the Dashboard column doesn't align with the logo.
- **Too many button sizes.** `md` (~40px), `lg` (~44px), `compact` (~40px), `sm` (~32px), `icon` (36px). Heights come from padding + line-height, so they drift. Full-width submit buttons are 44px on auth but the same component elsewhere is 40px.
- **Radius scale is all over the place:** `rounded-3xl` (auth), `rounded-2xl` (cards, empty-state tile), `rounded-xl` (inputs, buttons, chips, alerts, toast, drop zone), `rounded-lg` (nav links, icon tiles), `rounded-md` (checkbox), `rounded-full` (badges).
- **Type sizes are ad hoc:** `text-[15px]` (task title, lg button), `text-[9px]` (file label), `text-2xl sm:text-3xl` (page title), `text-6xl` (404). `leading-[normal]` on `<body>` and `--text-sm--line-height: normal` make multi-line text cramped (descriptions, alerts, ticket bodies).
- **Two list patterns for similar data:** tasks are rows in one panel; tickets are separate floating cards. They should share one list language.
- **Mixed language in the UI:** headings and buttons are English ("My tasks", "Support", "Login", "Save"), most body text is Roman Urdu ("Naya ticket", "Ticket bhejo", "Zaati maloomat", "Photo badlo"). Some buttons are Urdu, some English. See open question Q3.
- **Greeting uses the email prefix** (`hamza` from `hamza@…`) even when the user has set a real name. See Q4.

### 2.3 Clutter and hierarchy

- **Dashboard stacks three boxes** (progress card, add-task card, list card) plus a free-floating filter between them. Four separate visual units for one list.
- **Progress card is oversized** for one number (`text-2xl` count + percentage + 8px bar in its own card).
- **Ticket form drop zone** has an icon in a shadowed circle, two lines of text, then a separate size meter with a bar, then a hint — a lot of chrome for an optional field.
- **Profile** puts everything in one card with a full-width "Save" button, which looks like a sign-up form rather than a settings page.

### 2.4 Usability / responsive

- Download button on ticket attachments is 28px — too small for touch.
- Icon buttons are 36px on touch devices; 40px is the comfortable minimum.
- On phones the Tickets page shows the whole form before the user's own tickets (this order is kept; see flow.md — changing it would be a behaviour change).
- Toast sits at `bottom-6` centred — fine; keep, with full width on phones.

### 2.5 What is already good (keep)

- Semantic tokens in `index.css` + `@theme inline` → only values change, not the class names.
- `ui/styles.js` single source of truth for repeated classes.
- Accessible patterns: `aria-pressed` filter, `useId` labels, `sr-only` text, focus-visible outlines, `role="alert"`/`status`.
- Skeleton loader shaped like the list; toast instead of layout-shifting alerts; hover-only row actions on fine pointers.
- Light/dark via `prefers-color-scheme`.
- No external font or icon library.

---

## 3. Visual direction

**"Calm utility."** The interface should disappear behind the user's tasks and tickets.

1. **Neutral first.** Greys carry the layout. Colour appears only where it means something: the primary action, focus, links, selected state, success/error.
2. **Borders, not shadows.** Static surfaces are separated by 1px borders. Shadows only on things that float (toast).
3. **Small, consistent radii.** 6px on controls, 8px on containers, full circle only for avatars and status dots.
4. **Fewer boxes.** One panel per job. Group related controls inside it instead of stacking cards.
5. **Real typography.** A fixed scale with proper line-height; hierarchy from size and weight, not colour.
6. **One page skeleton.** Every signed-in page has the same container, the same header (title, one-line description, optional action on the right) and the same spacing below it.
7. **Motion only for feedback.** Colour transitions (150ms), the skeleton pulse, the spinning refresh icon, the progress bar width. Nothing decorative.

---

## 4. Colour palette

Token names stay the same (`bg`, `card`, `subtle`, `text`, `muted`, `border`, `primary`, `primary-hover`, `primary-soft`, `primary-text`, `success-*`, `error-*`). One new token is added: **`input`** — a slightly stronger border for form controls so fields are recognisable as fields.

### Light

| Token | Value | Use | Contrast |
|---|---|---|---|
| `bg` | `#f7f7f8` | Page background | — |
| `card` | `#ffffff` | Panels, inputs, navbar | — |
| `subtle` | `#f1f1f3` | Hover rows, segmented control, chips | — |
| `text` | `#18181b` | Primary text | 16.6 : 1 on `bg` |
| `muted` | `#62626c` | Secondary text, icons | 6.0 : 1 on `card`, 5.4 : 1 on `subtle` |
| `border` | `#e4e4e7` | Panel and divider lines | — |
| `input` *(new)* | `#d4d4d8` | Input / secondary-button border | — |
| `primary` | `#2557d6` | Primary button, checkbox, progress, focus | white on it 6.2 : 1 |
| `primary-hover` | `#1d48b8` | Primary hover | — |
| `primary-soft` | `#edf2fd` | Drag-over, selected tint | — |
| `primary-text` | `#1d48b8` | Links, text on `primary-soft` | 7.9 : 1 on `card` |
| `success-bg` / `-text` | `#effaf3` / `#157a3c` | Success alert, checklist | 5.1 : 1 |
| `error-bg` / `-text` | `#fef3f2` / `#b42318` | Errors, destructive | 6.1 : 1 |

### Dark

| Token | Value | Contrast |
|---|---|---|
| `bg` | `#0f0f11` | — |
| `card` | `#18181b` | — |
| `subtle` | `#202024` | — |
| `text` | `#ededef` | 16.4 : 1 on `bg` |
| `muted` | `#a0a0aa` | 6.8 : 1 on `card`, 6.3 : 1 on `subtle` |
| `border` | `#27272a` | — |
| `input` | `#3a3a40` | — |
| `primary` | `#2f62e0` | white on it 5.3 : 1 |
| `primary-hover` | `#2557d6` | — |
| `primary-soft` | `#1a2340` | — |
| `primary-text` | `#9db8ff` | 9.1 : 1 on `card` |
| `success-bg` / `-text` | `#0f2a1b` / `#6fdc9c` | 9.1 : 1 |
| `error-bg` / `-text` | `#2d1414` / `#fca5a5` | 9.1 : 1 |

**Why this blue:** a cobalt that is less saturated and less violet than indigo. It reads as "serious tool" rather than "startup template", and white text on it passes AA comfortably in both themes. The greys are neutral (no blue tint), so the blue is the only hue on screen.

`index.html` `theme-color` and `public/favicon.svg` change from `#4f46e5` to `#2557d6`.

---

## 5. Typography

Font stays: `Inter` if installed, else the system UI font (no external loading — see Q5).

| Role | Size / line-height | Weight | Tailwind | Used for |
|---|---|---|---|---|
| Page title | 24 / 32 | 600, tracking-tight | `text-2xl` | One per page |
| Section title | 16 / 24 | 600 | `text-base` | Card / section headings |
| Body | 14 / 20 | 400 | `text-sm` | Default UI text, task titles, inputs, buttons |
| Body strong | 14 / 20 | 500 | `text-sm font-medium` | Labels, list item titles, nav |
| Small | 13 / 18 | 400 | `text-[13px]` (one token, see structure.md) | Ticket description, meta rows |
| Caption | 12 / 16 | 400–500 | `text-xs` | Hints, counters, timestamps, badges |
| Code | 24, mono, tracking 0.3em | 500 | — | OTP input only |

Rules:
- Only weights 400, 500, 600. No `font-bold`.
- Remove `leading-[normal]` from `<body>` and the `--text-sm/xs--line-height: normal` overrides; use the scale above. (They were added because padding-based buttons grew taller — with fixed control heights, §7, that problem goes away.)
- No more `text-[15px]`, `text-[9px]`, `sm:text-3xl`, `text-6xl`.
- Colour is not used for hierarchy except `text` vs `muted`.

---

## 6. Spacing & layout

**Base unit 4px.** Allowed steps: 4, 8, 12, 16, 20, 24, 32, 48.

| Context | Value |
|---|---|
| Page side gutter | 16px mobile, 24px ≥ `sm` |
| Content container | **`max-w-4xl` (896px), same for navbar and every signed-in page** |
| Navbar height | 56px (`h-14`) |
| Main top / bottom padding | 32px / 64px |
| Page header → content | 24px |
| Between sections | 24px |
| Panel padding | 20px (`p-5`); 24px on ≥ `sm` for forms |
| List row padding | 12px × 16px |
| Form field gap | 16px; label → input 6px; input → hint 6px |
| Auth card width | 400px (`max-w-[400px]`) |

**Why one container:** the logo, the page title and the content's left edge line up on every page, so switching tabs doesn't shift anything.

---

## 7. Components

### Controls — one height system

| Size | Height | Padding-x | Use |
|---|---|---|---|
| `sm` | 32px (`h-8`) | 12px | Toolbar / in-row actions (Refresh, Delete?, Change photo) |
| `md` (default) | 36px (`h-9`) | 14px | Everything else, incl. full-width submits |
| `icon` | 32px square; **40px on `pointer-coarse`** | — | Edit, delete, remove-file, download, close |

Inputs are **36px** (`h-9`, `px-3`), so an input and a button always sit at the same height. Textarea: `min-h-24`, `py-2`. OTP input: 48px tall (deliberate exception — it is the only thing on that screen).

`lg` and `compact` sizes are removed (call sites move to `md`).

### Buttons

| Variant | Look |
|---|---|
| `primary` | `bg-primary`, white text, no shadow; hover `primary-hover` |
| `secondary` | `bg-card`, 1px `border-input`, `text`; hover `bg-subtle` |
| `ghost` | transparent, `muted` text; hover `bg-subtle` + `text` |
| `danger` | `bg-card`, 1px `border-input`, `error-text`; hover `bg-error-bg`. (The two-click "Delete?" state uses this.) |

All: `rounded-md`, `font-medium`, `gap-2`, 16px icons, disabled = 50% opacity.

### Inputs

`rounded-md`, `border-input`, `bg-card`, no shadow. Focus: `border-primary` + `ring-2 ring-primary/20` (replaces the 4px glow). Invalid (`aria-invalid`): `border-error-text`. Placeholder `muted` at 70%.

### Containers

- `panel` = `rounded-lg border border-border bg-card` — **no shadow**.
- `card` = `panel` + `p-5 sm:p-6`.
- Lists: one `panel` with `divide-y divide-border` rows. Tasks and tickets both use this.
- Section header inside a panel: 16px title + 12px muted description, `border-b` below.

### Other components

| Component | Change |
|---|---|
| Navbar | Solid `bg-card`, `border-b`, `h-14`, `max-w-4xl`. Active link: `bg-subtle text-text`; inactive `muted`. |
| LogoMark | 28px, `rounded-md`, `bg-primary`, no shadow. Favicon to match. |
| Avatar | Neutral: `bg-subtle text-text` + 1px `border` letter fallback. `sm` 32px, `lg` 64px. No rings. |
| Badge | `rounded-md bg-subtle text-muted text-xs font-medium px-1.5`. |
| Alert (auth pages) | `rounded-md`, 1px tinted border, tinted bg, 16px icon. Same as now, smaller radius. |
| Toast | `rounded-lg`, `border`, `bg-card`, `shadow-md` (the only shadow in the app). Full width minus 16px on phones, 400px max. |
| EmptyState | 20px `muted` icon, **no tile**; 14px medium title; 13px muted text; `py-10`. |
| Loader | Unchanged shape; `rounded` instead of `rounded-full` bars to match radii. |
| Checkbox | 16px, `rounded-[4px]`, `border-input`, checked `bg-primary`. |
| Segmented filter | Track `bg-subtle rounded-md p-0.5`; active `bg-card` + `border` (no shadow); count in `muted`. |
| Progress bar | 4px tall, `rounded-full`, `bg-subtle` track, `bg-primary` fill. |
| Drop zone | 1px dashed `border-input`, `rounded-md`, no icon circle, one line ("Drop files here or **browse**") + caption. |
| File / attachment chip | `rounded-md border bg-card`, 32px thumbnail, download button 32px (40px touch). |

### Icons

All UI icons 16px (`size-4`), `muted` unless inside a coloured button. Empty states 20px. No icon is placed on a coloured tile anywhere.

---

## 8. Page-by-page plan

Detailed states for each page are in [flow.md](flow.md).

### 8.1 App shell (`App.jsx`, `Navbar.jsx`)
- `main` gets the shared container (`mx-auto max-w-4xl px-4 sm:px-6 pt-8 pb-16`); pages stop setting their own `max-w-*`.
- Navbar as in §7. Mobile: logo mark only, nav links with icon + label, avatar, logout as icon.
- A shared **page header** pattern (title, description, optional right-side action) used on Tasks, Support, Profile — implemented as a class set in `styles.js`, not a new component (see structure.md).

### 8.2 Login & Register (`AuthLayout.jsx`, `Login.jsx`, `Register.jsx`, `VerifyEmail.jsx`, `PasswordInput.jsx`)
- **Replace the split card** with a centred column on the plain background: logo + "TaskDesk" wordmark, then a 400px card with heading, one-line description and the form, then the footer link *below* the card. (Q1)
- Remove the indigo panel, circles and feature list.
- Password checklist: single column, 12px, small check dot (unchanged logic).
- Verify screen: the "code sent to **email**" message becomes a plain paragraph (no icon tile); OTP input stays large and monospaced; "Send new code (45s)" becomes a `ghost` button under the primary button; "Wrong email? Back" stays in the footer.
- Login's inline verify section keeps its divider.

### 8.3 Tasks (`Dashboard.jsx`, `TaskForm.jsx`, `TaskItem.jsx`)
- Header: "Tasks" + greeting as description + `Refresh` (secondary, sm) on the right.
- **One panel instead of three boxes:**
  1. Top: add-task input + "Add task" button (same height), counter under the input as now.
  2. Toolbar row (`border-y`, `bg-subtle/40`): segmented filter on the left; "3 of 8 done" + 4px progress bar (96px wide) on the right. Shown only when there are tasks, as now.
  3. Rows (`divide-y`): 16px checkbox, 14px title, actions on hover/focus (fine pointer) or always (touch).
- Edit mode row: input + Save (primary sm) + Cancel (ghost sm) — same height.
- Delete confirm: `danger` sm "Delete?".
- Empty / filter-empty states use the new EmptyState.

### 8.4 Support tickets (`Tickets.jsx`, `TicketForm.jsx`, `TicketItem.jsx`)
- Header: "Support" + description.
- `lg`: two columns inside 896px — form card (≈ 5/12, sticky) left, list (≈ 7/12) right. Below `lg`: form, then list (order unchanged).
- Form: labels 14 medium, counters as captions, simplified drop zone, a single caption line "2 of 3 files · 1.4 MB of 5 MB" with the 4px bar under it, file rows as compact chips. Submit full width, `md`, upload progress inside the button (as now).
- List: **one panel, divided rows** (not separate cards). Row: title (14/600) + relative time (12 muted) on one line, `#a1b2c3` mono caption under it, description 13px clamp-3 with "Read more", attachments as chips at the bottom.

### 8.5 Profile (`Profile.jsx`, `AvatarUpload.jsx`)
- Header: "Profile" + description.
- One card, **settings layout**: on `md`+ each section is two columns — left: section title + 12px description (200px), right: the controls.
  - *Photo*: 64px avatar, "Change photo" secondary sm button, caption with formats/limit or the error.
  - *Personal info*: Email shown as read-only text (it was a muted subtitle — now labelled "Email", clearly not editable), Name, Phone with hint.
- Footer row of the card (`border-t`, `bg-subtle/40`): **Save** button right-aligned, auto width, disabled when nothing changed (as now).
- Mobile: sections stack.

### 8.6 404 (`NotFound.jsx`)
- Centred, no card: "404" as a 12px muted caption, 24px title, 14px muted text, `secondary` "Back to home" button.

---

## 9. Desktop vs mobile

| Area | Desktop (≥ 1024) | Mobile (≤ 640) |
|---|---|---|
| Container | 896px centred | full width, 16px gutters |
| Navbar | Logo + wordmark, links, name + avatar, "Log out" | Logo mark, links (icon + label), avatar, logout icon |
| Auth | Centred 400px card | Same card, full width, no outer border on very small screens (`max-sm:border-0 max-sm:bg-transparent`) |
| Tasks | Row actions on hover/focus | Actions always visible, 40px touch targets |
| Toolbar | Filter left, progress right | Wraps: filter, then progress line |
| Tickets | 2 columns, sticky form | Stacked |
| Profile | 2-column settings sections | Stacked |
| Toast | Bottom centre, 400px | Bottom, full width − 32px |

---

## 10. Open questions (please answer when approving)

- **Q1 — Auth layout.** (A, recommended) centred single card, no brand panel. (B) keep the split layout but make the left panel neutral (`bg-subtle`, no circles, no icon tiles).
- **Q2 — Primary colour.** (A, recommended) cobalt `#2557d6` as above. (B) near-black primary buttons (`#18181b`) with blue only for links/focus — even more minimal. (C) keep indigo.
- **Q3 — UI language.** Labels are mixed English / Roman Urdu. (A) leave the words exactly as they are (pure visual redesign). (B) make every button, heading and label English, keep Roman Urdu nowhere in the UI. (C) make it consistently Roman Urdu. *Changing text touches strings only, no logic.*
- **Q4 — Greeting.** It shows the email prefix even when a name is set. Use `user.name` when present, else the email prefix? (Tiny display-logic change; skip if you want zero logic edits.)
- **Q5 — Font.** (A, recommended) keep system font / local Inter — no network request. (B) bundle Inter via `@fontsource-variable/inter` (one new npm dependency) so everyone sees the same font.

---

## 11. Not changing

APIs, `api/`, `context/`, hooks, `utils/helpers.js` logic, validation rules, routes, the order of sections on any page, any feature, any backend file. All functionality listed in `CLAUDE.md` must behave identically.

---

## 12. Implementation notes (deviations from the plan above)

- **Auth heading is 20px** (`text-xl`), not 24px: inside a 400px card, 24px felt heavy next to 14px fields.
- **All buttons use weight 500**, including primary; 600 on a 14px button looked bolder than the headings.
- **Dashboard toolbar has no tinted background**: the segmented control's `bg-subtle` track lost contrast on a tinted row.
- **`index.html` got `[scrollbar-gutter:stable]`**: without it the whole layout jumped 8px sideways between short pages (Profile) and long ones (Tickets).
- **PDF chips in the ticket form** show "PDF · 120 KB" in the caption instead of a 9px "PDF" label inside the icon box (that text was unreadably small).
- **Profile email** is shown as labelled plain text, not a disabled input, so it doesn't look like something you could edit.
