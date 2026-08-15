# Time Zone Converter tab — design spec

## Context

The tools site (`index.html`) is a single-file, no-build static page with a tab bar of small
client-side dev utilities (YAML↔JSON, JSON Minify, JOLT Transform, Key/Cert Verify, Drools Test).
The user frequently needs to convert times between IST and other zones (EST, PST, UTC, and
occasionally others) and finds doing this manually error-prone and unintuitive. The goal is a new
"Time Zone Converter" tab that makes this fast and hard to get wrong: set a time in any zone and
immediately see the corresponding time in every other zone shown, without a separate "which zone
is the source" step.

A working interactive HTML/CSS/JS mockup was built and validated (drag-to-set, live sync, AM/PM
handling, dark mode, add/remove zones, DST/date-rollover correctness) before this spec was
written; the design below reflects what was validated, not a fresh proposal.

## Requirements (confirmed with user)

- Default zones shown: **IST, Eastern (America/New_York), Pacific (America/Los_Angeles), UTC**.
- Zones are **addable/removable**: a searchable list of all IANA time zones, filtered by typing
  (e.g. "London", "CET"); each zone card has a small ✕ to remove it. The zone *list* persists
  across visits (localStorage); the *time shown* does not — the page always opens live on "now".
- Any zone is a **full peer**, not a fixed "source": editing (dragging or typing) any one zone's
  time recomputes every other zone from that same instant. There is no separate "pick a source
  zone" step.
- Editing supports a **specific date + time**, not just "today" — needed for planning things like
  a call next Tuesday, and to get cross-midnight conversions right.
- Time is set via a **12-hour analog clock face** with draggable hour/minute hands (not a 24-hour
  face — user tried 24h in the mockup and found it unfamiliar/unintuitive), plus an editable
  digital time field and an AM/PM toggle pill for precision and unambiguous period selection.
- Each clock face is **tinted for day vs. night** (fixed 06:00–18:00 = day, not real
  sunrise/sunset) as an at-a-glance "is this a reasonable hour to call" cue.
- Clocks **tick live** every second when untouched; dragging/typing/toggling AM-PM on any single
  clock **freezes** all clocks at that chosen instant. A **"Now"** button resumes live ticking.

## Non-goals (explicitly out of scope, YAGNI)

- Real sunrise/sunset-based shading (geolocation/astronomical calculation) — fixed 6am/6pm bands
  only.
- Persisting the dragged/typed time across page reloads — only the zone *list* persists.
- Any external timezone or date library — the browser's built-in `Intl` API covers everything
  needed (zone list via `Intl.supportedValuesOf('timeZone')`, formatting/offsets via
  `Intl.DateTimeFormat`), consistent with this tool needing no new CDN dependency (unlike the
  CodeMirror-based tabs).

## UI / interaction (validated in the mockup)

Each zone renders as a card: zone name + short offset/abbreviation (from `Intl.DateTimeFormat`
`timeZoneName: 'short'`) + remove (✕) button, a 12-hour analog clock (12 numerals, 60-tick minute
ring, draggable hour/minute hands, tinted face), and beneath it an editable digital time field
("09:15"), an AM/PM pill (click to flip ±12h), an editable date field, and the weekday.

Cards sit in a responsive grid (`repeat(auto-fill, minmax(250px, 1fr))`), single column on narrow
viewports. A control bar above the grid holds "+ Add zone" (opens a search popover over the full
IANA zone list) and "Now", plus a small live/frozen status pill.

**Sync model:** one shared UTC instant (`sharedInstant`) drives every card. Any edit — drag, typed
time/date, or AM/PM toggle — on any card converts that card's zone-local wall-clock time back to a
UTC instant (small helper, 2-pass convergence against `Intl.DateTimeFormat`, handles DST), sets it
as the new `sharedInstant`, freezes live ticking, and re-renders every card from that instant.

**12-hour dial specifics:**
- Hour hand: one full rotation = 12 hours (`angle = ((hour % 12) + minute/60) / 12 * 360`).
  Dragging is continuous (encodes hour + fractional minute); a full lap past 12 o'clock during a
  single drag gesture flips AM/PM (tracked via unwrapped cumulative angle across the gesture,
  not just the instantaneous angle), so continuing to drag around the face behaves the way a real
  clock's hour hand would.
- Minute hand: independent, `angle = minute/60*360`; dragging only sets minutes within the
  currently-active hour/period.
- AM/PM pill: explicit, always-available alternative to the drag-past-12 behavior — click to
  add/subtract 12 hours from the zone's current wall-clock hour, same date.
- Face tint: solid color for the whole face (not a split arc, since a 12h face repeats twice a
  day) — warm/light for the resolved 24-hour hour in `[6, 18)`, dark otherwise. Recomputed on
  every render, including live ticks and dark-mode toggles.
- Typing into the digital time field only ever sets hour(1–12)/minute within whatever AM/PM period
  is already showing; the AM/PM pill is the only direct control for switching the period
  explicitly (matches how a person reads a 12-hour clock: type "9:15", then confirm/flip AM vs PM
  if needed).

**Live/frozen behavior:** a 1-second interval updates `sharedInstant = new Date()` and re-renders,
unless frozen. Any manual edit sets `frozen = true`. "Now" sets `frozen = false` and jumps
`sharedInstant` to the current instant immediately.

## Visual design

Reuses the site's existing design system exactly — no new palette/typeface introduced:
- Brand gradient `#667eea → #764ba2`, white/`#1e1e2e` cards, existing border/text colors, existing
  `body.dark-mode` convention (a manual toggle class, not `prefers-color-scheme`-driven — matches
  how the rest of the site already handles dark mode).
- System font stack for UI text; `'Monaco', 'Menlo', 'Ubuntu Mono', monospace` +
  `font-variant-numeric: tabular-nums` for the digital time readout, consistent with the site's
  existing monospace usage in code editors.
- New CSS is additive only: `.tz-*` classes for the card grid, clock face, hands, ticks, AM/PM
  pill, and add-zone popover. No changes to any existing tab's CSS.

## Integration into `index.html`

Following the same pattern every existing tab uses (no central tab registry in this codebase —
confirmed via the Drools Test tab, the most recently added one):

1. **Nav button** — new `<button class="tab" onclick="switchTab('timezone')">Time Zone
   Converter</button>` appended to the `.tabs` div.
2. **Panel markup** — new `<div id="timezone-panel" class="tab-panel">` appended after the Drools
   Test panel, containing the controls bar + `.tz-grid` container (cards are built by JS, not
   hardcoded markup, since the zone list is dynamic).
3. **`switchTab()`** — add a branch for `'timezone'` following the existing if/else chain
   convention, including the `:nth-child(N)` nav-button selector matching its position.
4. **No CodeMirror editors** — this tab uses plain inputs/buttons/divs only, so it's skipped in
   `initEditors()`'s CodeMirror instantiation and in `updateCodeMirrorThemes()`.
5. **`showError`/`showSuccess`** — not used by this tab. Invalid typed input (e.g. malformed time
   text) is handled by silently ignoring the edit and re-rendering from the last valid
   `sharedInstant`, so no error/success banner branch is added for `'timezone'`.
6. **Persistence** — reuse the existing `loadPane`/`savePane` localStorage helpers to persist only
   the zone list (an array of IANA zone IDs) under a new key, e.g. `paneContent:timezoneZones`
   (JSON-stringified). Not wired into the existing per-editor autosave `forEach` array, since
   there's no CodeMirror editor here — a plain `change`-driven call to `savePane` on
   add/remove is sufficient.
7. **New JS**: the timezone conversion helpers (`zoneParts`, `zoneShortLabel`, `zonedTimeToUtc`),
   card rendering/drag/edit logic, and the add/remove-zone search — all namespaced with a `tz`
   prefix to match the existing per-tab naming convention (`jsonMinify...`, `drools...`).

## Testing / verification

Manual, in-browser (no existing test suite in this repo to extend):
- Drag each clock's hands and confirm every other card updates correctly, including a case that
  crosses a midnight boundary (date rolls over on the affected zones) and a case that drags the
  hour hand past 12 o'clock (AM/PM flips).
- Type an exact time and date into a card; confirm all other cards recompute correctly.
- Click the AM/PM pill and confirm ±12h + correct resync.
- Add a zone via search, remove a zone, reload the page, and confirm the zone list (but not the
  time) persists.
- Toggle dark mode and confirm the new `.tz-*` elements pick up dark styling correctly, including
  face tint colors.
- Verify against a known DST-transition date (e.g. a March/November date) to confirm offsets are
  correct across the transition.
- Confirm the new tab's nav button position doesn't break `switchTab()`'s existing
  `:nth-child(N)` selectors for the other five tabs.
