# Time Zone Converter Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Time Zone Converter" tab to the tools site where any zone's 12-hour analog clock can be set (by dragging its hands or typing a time/date), instantly recomputing every other displayed zone from that same instant.

**Architecture:** A new pure-logic file (`tz-utils.js`) holds DST-aware timezone conversion built on the browser's `Intl` API, unit-tested with Node's built-in test runner. `index.html` gets a new tab (nav button + panel) following the exact structural pattern of the existing tabs, with all new DOM building, rendering, drag interaction, and zone-list persistence living in a `tz`-prefixed block inside the existing single inline `<script>`.

**Tech Stack:** Vanilla HTML/CSS/JS, no build step, no new CDN dependency. `Intl.DateTimeFormat` / `Intl.supportedValuesOf('timeZone')` for all timezone math and zone listing. Node's built-in `node:test` + `node:assert/strict` (Node 22 available) for the one automatable unit-test suite.

## Global Constraints

- No new CDN/library dependency — timezone math uses only the browser's built-in `Intl` API.
- Default zones are IST (`Asia/Kolkata`), Eastern (`America/New_York`), Pacific
  (`America/Los_Angeles`), UTC — addable/removable via a searchable list of all IANA zones.
- Only the zone *list* persists across page reloads (via the existing `loadPane`/`savePane`
  localStorage helpers); the displayed time never persists — the page always opens live on "now".
- The clock face is 12-hour (not 24-hour), with an AM/PM pill and drag-past-12 carrying the period
  over, the way a real clock's hour hand would.
- Day/night face tint uses a fixed 06:00–18:00 band, not real sunrise/sunset.
- Reuse the site's existing visual system exactly (brand gradient `#667eea → #764ba2`, existing
  `body.dark-mode` class convention, existing monospace/tabular-nums usage) — no new palette or
  typeface.
- Every existing tab (`switchTab()`, the five current nav buttons/panels) must keep working
  unchanged.

Spec reference: `docs/superpowers/specs/2026-08-15-timezone-converter-design.md`. A validated
interactive mockup (drag/type/AM-PM/add-zone/dark-mode all confirmed working, including DST and
cross-midnight correctness) preceded this plan — the code below is adapted directly from that
validated mockup, not written fresh.

---

### Task 1: `tz-utils.js` — DST-aware timezone conversion helpers

**Files:**
- Create: `tz-utils.js` (repo root, sibling of `index.html`)
- Test: `tz-utils.test.js` (repo root)

**Interfaces:**
- Produces (used by every later task, via `<script src="tz-utils.js">` in `index.html`, global
  `TzUtils`, and via `require('./tz-utils.js')` in the test file):
  - `TzUtils.zoneParts(tz: string, date: Date) -> { year, month, day, hour, minute, second, weekday }`
    — wall-clock fields (1-indexed month, 0-23 hour, short weekday name) for `date` as seen in IANA
    zone `tz`.
  - `TzUtils.zoneShortLabel(tz: string, date: Date) -> string` — short zone abbreviation as of
    `date` (e.g. `"EST"`, `"EDT"`, `"UTC"`, `"GMT+5:30"`).
  - `TzUtils.zonedTimeToUtc(tz: string, y: number, mo: number, d: number, h: number, mi: number) -> Date`
    — the UTC instant at which zone `tz`'s wall clock reads `y-mo-d h:mi` (1-indexed month,
    0-23 hour). DST-correct.

- [ ] **Step 1: Write the failing test file**

Create `tz-utils.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { zoneParts, zoneShortLabel, zonedTimeToUtc } = require('./tz-utils.js');

test('zoneParts reads wall-clock fields in a zone for a known UTC instant (EST, winter)', () => {
    const instant = new Date(Date.UTC(2026, 0, 15, 12, 0, 0)); // 2026-01-15 12:00 UTC
    const p = zoneParts('America/New_York', instant);
    assert.equal(p.year, 2026);
    assert.equal(p.month, 1);
    assert.equal(p.day, 15);
    assert.equal(p.hour, 7); // EST = UTC-5
    assert.equal(p.minute, 0);
});

test('zonedTimeToUtc converts EST wall-clock time back to the correct UTC instant', () => {
    const utc = zonedTimeToUtc('America/New_York', 2026, 1, 15, 9, 0); // 09:00 EST
    assert.equal(utc.getTime(), Date.UTC(2026, 0, 15, 14, 0, 0));
});

test('zonedTimeToUtc uses the summer (EDT) offset on a DST date', () => {
    const utc = zonedTimeToUtc('America/New_York', 2026, 7, 15, 9, 0); // 09:00 EDT
    assert.equal(utc.getTime(), Date.UTC(2026, 6, 15, 13, 0, 0));
});

test('zonedTimeToUtc is a no-op offset for UTC itself', () => {
    const utc = zonedTimeToUtc('UTC', 2026, 3, 1, 6, 30);
    assert.equal(utc.getTime(), Date.UTC(2026, 2, 1, 6, 30, 0));
});

test('zoneParts/zonedTimeToUtc round-trip for several zones and times', () => {
    const cases = [
        ['Asia/Kolkata', 2026, 8, 15, 23, 45],
        ['America/Los_Angeles', 2026, 12, 31, 0, 5],
        ['Europe/London', 2026, 6, 1, 12, 0],
    ];
    for (const [tz, y, mo, d, h, mi] of cases) {
        const utc = zonedTimeToUtc(tz, y, mo, d, h, mi);
        const p = zoneParts(tz, utc);
        assert.deepEqual(
            [p.year, p.month, p.day, p.hour, p.minute],
            [y, mo, d, h, mi],
            `round-trip failed for ${tz} ${y}-${mo}-${d} ${h}:${mi}`
        );
    }
});

test('zoneShortLabel returns the expected abbreviation for winter and summer', () => {
    const winter = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    const summer = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    assert.equal(zoneShortLabel('America/New_York', winter), 'EST');
    assert.equal(zoneShortLabel('America/New_York', summer), 'EDT');
    assert.equal(zoneShortLabel('UTC', winter), 'UTC');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test` (from repo root)
Expected: fails immediately with `Error: Cannot find module './tz-utils.js'` (the file doesn't
exist yet).

- [ ] **Step 3: Write `tz-utils.js`**

```js
// Pure timezone conversion helpers — no DOM access, so they're usable both from
// index.html (via <script src="tz-utils.js">, exposed as window.TzUtils) and from
// plain Node.js for automated tests (via require('./tz-utils.js')).
(function (root) {
    // Read a UTC instant's wall-clock fields as seen in a given IANA time zone.
    function zoneParts(tz, date) {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
        });
        const map = {};
        dtf.formatToParts(date).forEach(p => map[p.type] = p.value);
        return {
            year: +map.year, month: +map.month, day: +map.day,
            hour: map.hour === '24' ? 0 : +map.hour, minute: +map.minute, second: +map.second,
            weekday: map.weekday,
        };
    }

    // Short zone label as of a given instant, e.g. "EST", "EDT", "GMT+5:30".
    function zoneShortLabel(tz, date) {
        try {
            const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short', hour: '2-digit' });
            const part = dtf.formatToParts(date).find(p => p.type === 'timeZoneName');
            return part ? part.value : tz;
        } catch (e) {
            return tz;
        }
    }

    // Convert a zone-local wall-clock time back to a UTC instant. Two-pass
    // convergence against zoneParts handles DST correctly (the zone's offset at
    // the target instant may differ from its offset at the initial UTC guess).
    function zonedTimeToUtc(tz, y, mo, d, h, mi) {
        let guess = Date.UTC(y, mo - 1, d, h, mi, 0);
        for (let i = 0; i < 2; i++) {
            const p = zoneParts(tz, new Date(guess));
            const guessedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
            const wanted = Date.UTC(y, mo - 1, d, h, mi, 0);
            guess += (wanted - guessedAsUtc);
        }
        return new Date(guess);
    }

    const TzUtils = { zoneParts, zoneShortLabel, zonedTimeToUtc };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TzUtils;
    } else {
        root.TzUtils = TzUtils;
    }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test` (from repo root)
Expected: `# tests 6`, `# pass 6`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add tz-utils.js tz-utils.test.js
git commit -m "Add DST-aware timezone conversion helpers with unit tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Tab shell + live, draggable, editable clocks (default zones only)

Adds the nav button, panel, CSS, and full interactive clock rendering for the four default zones
(IST, Eastern, Pacific, UTC). No add/remove-zone UI and no persistence yet — those are Task 3.
By the end of this task the tab is fully usable end-to-end for the fixed default zones: clocks
tick live, dragging hands or typing a time/date syncs every zone, and the AM/PM pill works.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `TzUtils.zoneParts`, `TzUtils.zoneShortLabel`, `TzUtils.zonedTimeToUtc` (Task 1).
- Produces (used by Task 3 and Task 4):
  - State: `let tzZones`, `let tzNextId`, `let tzSharedInstant`, `let tzFrozen`, `let tzDrag`,
    `let tzGridEl`, `let tzAllZoneNames` (declared here, populated in Task 3).
  - `tzPrettyName(tzId: string) -> string`, `tzDefaultZones() -> Array<{tz, name, id}>`.
  - `tzBuildCardSkeleton(zone) -> HTMLElement`, `tzRebuildGrid()`, `tzRenderAll()`,
    `tzFaceTint(dark: boolean, hour24: number) -> string`.
  - `tzGoToNow()`, `tzTogglePeriod(zoneId: string)`, `tzInit()` (called once from
    `DOMContentLoaded`).

- [ ] **Step 1: Add the `<script src="tz-utils.js">` include**

In `index.html`, find this block (currently around line 790-793):

```html
        </div>
    </div>

    <script>
```

Replace it with (adds the new script tag between the closing `.container` div and the existing
inline script):

```html
        </div>
    </div>

    <script src="tz-utils.js"></script>
    <script>
```

- [ ] **Step 2: Add the nav button**

Find the `.tabs` div (around line 524-530):

```html
        <div class="tabs">
            <button class="tab active" onclick="switchTab('yaml-json')">YAML ↔ JSON Escaped</button>
            <button class="tab" onclick="switchTab('json-minify')">JSON Minify/Unminify</button>
            <button class="tab" onclick="switchTab('jolt-transform')">JOLT Transform</button>
            <button class="tab" onclick="switchTab('key-verify')">Key/Cert Verify</button>
            <button class="tab" onclick="switchTab('drools-test')">Drools Test</button>
        </div>
```

Add a sixth button so it reads:

```html
        <div class="tabs">
            <button class="tab active" onclick="switchTab('yaml-json')">YAML ↔ JSON Escaped</button>
            <button class="tab" onclick="switchTab('json-minify')">JSON Minify/Unminify</button>
            <button class="tab" onclick="switchTab('jolt-transform')">JOLT Transform</button>
            <button class="tab" onclick="switchTab('key-verify')">Key/Cert Verify</button>
            <button class="tab" onclick="switchTab('drools-test')">Drools Test</button>
            <button class="tab" onclick="switchTab('timezone')">Time Zone Converter</button>
        </div>
```

- [ ] **Step 3: Add the panel markup**

Find the end of the Drools Test panel (currently around line 790-791):

```html
            </div>
        </div>
    </div>

    <script src="tz-utils.js"></script>
```

Insert the new panel between the Drools panel's closing `</div>` and the `.container`'s closing
`</div>`:

```html
            </div>
        </div>

        <div id="timezone-panel" class="tab-panel">
            <div class="tz-controls">
                <button class="tz-btn primary" onclick="tzGoToNow()">⦿ Now</button>
                <div class="tz-live-pill">
                    <span class="tz-live-dot" id="tz-live-dot"></span>
                    <span id="tz-live-label">Live</span>
                </div>
            </div>

            <div class="tz-grid" id="tz-grid"></div>
        </div>
    </div>

    <script src="tz-utils.js"></script>
```

- [ ] **Step 4: Add the CSS**

Find the end of the `<style>` block (currently around line 493-511):

```css
        @media (max-width: 768px) {
            .dark-mode-toggle {
                position: static;
                margin-bottom: 15px;
                width: 100%;
                justify-content: center;
            }

            .header-container {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            h1 {
                margin-bottom: 15px;
            }
        }
    </style>
```

Insert the new rules before the closing `</style>`:

```css
        @media (max-width: 768px) {
            .dark-mode-toggle {
                position: static;
                margin-bottom: 15px;
                width: 100%;
                justify-content: center;
            }

            .header-container {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            h1 {
                margin-bottom: 15px;
            }
        }

        /* ---- Time Zone Converter tab ---- */
        .tz-controls {
            display: flex; align-items: center; gap: 12px; margin-bottom: 22px; flex-wrap: wrap;
        }
        .tz-btn {
            padding: 10px 18px; border-radius: 8px; font-size: 0.92em; font-weight: 600;
            cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; border: none;
        }
        .tz-btn:focus-visible { outline: 3px solid rgba(102,126,234,0.5); outline-offset: 2px; }
        .tz-btn.primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .tz-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(102,126,234,0.3); }
        .tz-btn.secondary { background: transparent; color: #667eea; border: 2px solid #667eea; }
        .tz-btn.secondary:hover { background: rgba(102,126,234,0.08); }
        body.dark-mode .tz-btn.secondary { color: #8c9eff; border-color: #8c9eff; }
        body.dark-mode .tz-btn.secondary:hover { background: rgba(140,158,255,0.1); }

        .tz-live-pill { display: flex; align-items: center; gap: 6px; font-size: 0.85em; color: #666; margin-left: auto; }
        body.dark-mode .tz-live-pill { color: #b0b0b0; }
        .tz-live-dot {
            width: 8px; height: 8px; border-radius: 50%; background: #3cb371;
            box-shadow: 0 0 0 0 rgba(60,179,113,0.6); animation: tz-pulse 2s infinite;
        }
        .tz-live-dot.frozen { background: #999; animation: none; }
        @keyframes tz-pulse {
            0% { box-shadow: 0 0 0 0 rgba(60,179,113,0.5); }
            70% { box-shadow: 0 0 0 6px rgba(60,179,113,0); }
            100% { box-shadow: 0 0 0 0 rgba(60,179,113,0); }
        }
        @media (prefers-reduced-motion: reduce) { .tz-live-dot { animation: none; } }

        .tz-add-wrap { position: relative; }
        .tz-add-popover {
            position: absolute; top: calc(100% + 8px); left: 0; z-index: 50;
            background: white; border: 2px solid #e0e0e0; border-radius: 10px; box-shadow: 0 12px 30px rgba(0,0,0,0.18);
            width: 300px; padding: 10px; max-height: 320px; overflow: hidden; display: none; flex-direction: column;
        }
        .tz-add-popover.open { display: flex; }
        body.dark-mode .tz-add-popover { background: #2a2a3e; border-color: #3a3a4e; }
        .tz-add-search {
            padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 0.95em;
            outline: none; margin-bottom: 8px;
        }
        .tz-add-search:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
        body.dark-mode .tz-add-search { background: #1e1e2e; color: #e0e0e0; border-color: #3a3a4e; }
        .tz-add-results { overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
        .tz-add-result {
            text-align: left; padding: 8px 10px; border-radius: 6px; border: none; background: transparent;
            cursor: pointer; font-size: 0.9em; color: #333; display: flex; justify-content: space-between; gap: 8px; width: 100%;
        }
        .tz-add-result:hover, .tz-add-result:focus-visible { background: rgba(102,126,234,0.1); outline: none; }
        .tz-add-result .off { color: #888; font-size: 0.85em; white-space: nowrap; }
        body.dark-mode .tz-add-result { color: #e0e0e0; }
        body.dark-mode .tz-add-result:hover { background: rgba(102,126,234,0.18); }

        .tz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }

        .tz-card {
            border: 2px solid #e0e0e0; border-radius: 14px; padding: 18px 16px 16px;
            display: flex; flex-direction: column; align-items: center; gap: 12px;
            transition: border-color 0.2s;
        }
        body.dark-mode .tz-card { border-color: #3a3a4e; }

        .tz-card-head { display: flex; align-items: baseline; gap: 8px; width: 100%; justify-content: center; position: relative; }
        .tz-card-title { font-weight: 700; font-size: 1.05em; color: #333; letter-spacing: 0.02em; }
        body.dark-mode .tz-card-title { color: #e0e0e0; }
        .tz-card-sub { font-size: 0.78em; color: #888; }
        .tz-card-remove {
            position: absolute; right: 0; top: 2px; border: none; background: transparent; color: #bbb;
            cursor: pointer; font-size: 1em; line-height: 1; padding: 2px 4px; border-radius: 4px;
        }
        .tz-card-remove:hover { color: #d33; background: rgba(211,51,51,0.08); }
        .tz-card-remove:focus-visible { outline: 2px solid #d33; }

        .tz-face {
            width: 184px; height: 184px; border-radius: 50%; position: relative;
            border: 3px solid #fff; box-shadow: 0 0 0 2px #e0e0e0, inset 0 0 14px rgba(0,0,0,0.06);
            touch-action: none; cursor: grab; transition: background 0.25s ease;
        }
        body.dark-mode .tz-face { border-color: #1e1e2e; box-shadow: 0 0 0 2px #3a3a4e, inset 0 0 14px rgba(0,0,0,0.35); }
        .tz-face:active { cursor: grabbing; }

        .tz-tick { position: absolute; left: 50%; top: 50%; width: 1px; height: 5px; background: rgba(0,0,0,0.22); transform-origin: 50% 0; margin-left: -0.5px; }
        .tz-tick.major { height: 9px; width: 2px; background: rgba(0,0,0,0.4); margin-left: -1px; }
        body.dark-mode .tz-tick { background: rgba(255,255,255,0.3); }
        body.dark-mode .tz-tick.major { background: rgba(255,255,255,0.55); }

        .tz-label { position: absolute; font-size: 0.72em; font-weight: 700; color: #555; transform: translate(-50%, -50%); pointer-events: none; font-variant-numeric: tabular-nums; }
        body.dark-mode .tz-label { color: #cfcfe6; }

        .tz-hand { position: absolute; left: 50%; top: 50%; transform-origin: 50% 100%; border-radius: 3px; }
        .tz-hand.hour { width: 5px; height: 50px; margin-left: -2.5px; margin-top: -50px; background: #333; cursor: grab; }
        .tz-hand.minute { width: 3px; height: 74px; margin-left: -1.5px; margin-top: -74px; background: #667eea; cursor: grab; }
        body.dark-mode .tz-hand.hour { background: #e8e8f5; }
        .tz-hand:active { cursor: grabbing; }

        .tz-center-dot {
            position: absolute; left: 50%; top: 50%; width: 9px; height: 9px; margin-left: -4.5px; margin-top: -4.5px;
            border-radius: 50%; background: #764ba2; box-shadow: 0 0 0 2px white; z-index: 5; pointer-events: none;
        }
        body.dark-mode .tz-center-dot { box-shadow: 0 0 0 2px #1e1e2e; }

        .tz-readout { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; }
        .tz-time-row { display: flex; align-items: center; gap: 6px; }
        .tz-time-input {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 1.3em; font-weight: 700;
            color: #333; border: none; background: transparent; text-align: center; width: 3.4em;
            font-variant-numeric: tabular-nums; border-radius: 6px; padding: 2px 4px;
        }
        .tz-time-input:focus { outline: none; background: rgba(102,126,234,0.1); }
        body.dark-mode .tz-time-input { color: #e0e0e0; }

        .tz-ampm-pill {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.72em; font-weight: 700;
            letter-spacing: 0.03em; padding: 4px 8px; border-radius: 20px; border: 2px solid #667eea;
            background: transparent; color: #667eea; cursor: pointer; transition: background 0.2s;
        }
        .tz-ampm-pill:hover { background: rgba(102,126,234,0.1); }
        .tz-ampm-pill:focus-visible { outline: 2px solid #667eea; outline-offset: 2px; }
        body.dark-mode .tz-ampm-pill { color: #8c9eff; border-color: #8c9eff; }
        body.dark-mode .tz-ampm-pill:hover { background: rgba(140,158,255,0.12); }
        .tz-date-input {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.78em; color: #777;
            border: none; background: transparent; text-align: center; border-radius: 6px; padding: 2px 4px;
            color-scheme: light;
        }
        body.dark-mode .tz-date-input { color-scheme: dark; color: #a0a0c0; }
        .tz-date-input:focus { outline: none; background: rgba(102,126,234,0.1); }
        .tz-weekday { font-size: 0.78em; color: #888; letter-spacing: 0.04em; text-transform: uppercase; }
        body.dark-mode .tz-weekday { color: #9090b0; }

        @media (max-width: 560px) {
            .tz-controls { justify-content: center; }
            .tz-live-pill { margin-left: 0; width: 100%; justify-content: center; }
            .tz-grid { grid-template-columns: 1fr; }
        }
    </style>
```

- [ ] **Step 5: Add the timezone JS block**

Find the `switchTab` function definition (currently around line 1290):

```js
        function switchTab(tabName) {
```

Insert this whole block immediately **before** it (keep `function switchTab(tabName) {` as the
next line after):

```js
        // ---------------- Time Zone Converter ----------------
        const TZ_DEFAULT_ZONE_IDS = ['Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'UTC'];
        const TZ_FRIENDLY_NAMES = {
            'Asia/Kolkata': 'IST',
            'America/New_York': 'Eastern',
            'America/Los_Angeles': 'Pacific',
            'UTC': 'UTC',
        };

        let tzZones = [];
        let tzNextId = 0;
        let tzSharedInstant = new Date();
        let tzFrozen = false;
        let tzDrag = null; // { zoneId, hand: 'hour'|'minute', faceEl, period, cumulative, lastAngle }
        let tzGridEl = null;
        let tzAllZoneNames = [];

        function tzPrettyName(tzId) {
            if (TZ_FRIENDLY_NAMES[tzId]) return TZ_FRIENDLY_NAMES[tzId];
            return tzId.replace(/_/g, ' ').split('/').pop();
        }

        function tzDefaultZones() {
            return TZ_DEFAULT_ZONE_IDS.map((tzId, i) => ({ tz: tzId, name: tzPrettyName(tzId), id: 'z' + i }));
        }

        function tzBuildCardSkeleton(zone) {
            const card = document.createElement('div');
            card.className = 'tz-card';
            card.dataset.id = zone.id;

            // 60 minute ticks (every 5th one taller), matching a familiar analog face.
            const ticks = [];
            for (let m = 0; m < 60; m++) {
                const angle = (m / 60) * 360;
                const major = m % 5 === 0;
                ticks.push(`<div class="tz-tick${major ? ' major' : ''}" style="transform: rotate(${angle}deg);"></div>`);
            }
            // Hour numerals 1-12 at their usual clock-face positions.
            const hourLabels = Array.from({ length: 12 }, (_, i) => i + 1).map(hr => {
                const angle = ((hr % 12) / 12) * 360;
                const rad = (angle - 90) * Math.PI / 180;
                const r = 76, c = 92;
                const x = c + r * Math.cos(rad);
                const y = c + r * Math.sin(rad);
                return `<div class="tz-label" style="left:${x}px; top:${y}px;">${hr}</div>`;
            }).join('');

            card.innerHTML = `
                <div class="tz-card-head">
                    <span class="tz-card-title">${zone.name}</span>
                    <span class="tz-card-sub" data-role="sub"></span>
                </div>
                <div class="tz-face" data-role="face">
                    ${ticks.join('')}
                    ${hourLabels}
                    <div class="tz-hand hour" data-role="hourhand"></div>
                    <div class="tz-hand minute" data-role="minhand"></div>
                    <div class="tz-center-dot"></div>
                </div>
                <div class="tz-readout">
                    <div class="tz-time-row">
                        <input class="tz-time-input" data-role="time" type="text" value="12:00" maxlength="5" aria-label="${zone.name} time">
                        <button class="tz-ampm-pill" type="button" data-role="ampm" onclick="tzTogglePeriod('${zone.id}')" title="Toggle AM/PM">AM</button>
                    </div>
                    <input class="tz-date-input" data-role="date" type="date" aria-label="${zone.name} date">
                    <div class="tz-weekday" data-role="weekday"></div>
                </div>
            `;
            return card;
        }

        function tzRebuildGrid() {
            tzGridEl.innerHTML = '';
            tzZones.forEach(zone => {
                const card = tzBuildCardSkeleton(zone);
                tzGridEl.appendChild(card);

                const face = card.querySelector('[data-role="face"]');
                face.addEventListener('pointerdown', e => tzStartDrag(e, zone.id, face));

                const timeInput = card.querySelector('[data-role="time"]');
                timeInput.addEventListener('change', () => tzApplyManualEdit(zone.id));
                const dateInput = card.querySelector('[data-role="date"]');
                dateInput.addEventListener('change', () => tzApplyManualEdit(zone.id));
            });
            tzRenderAll();
        }

        // Whole-face tint standing in for day/night, since a 12h face repeats twice a day
        // and can't show it as a fixed split the way a 24h dial could.
        function tzFaceTint(dark, hour24) {
            const isDay = hour24 >= 6 && hour24 < 18;
            if (dark) return isDay ? '#33335a' : '#111124';
            return isDay ? '#fff6da' : '#dde3f6';
        }

        function tzRenderAll() {
            if (!tzGridEl) return;
            const isDark = document.body.classList.contains('dark-mode');
            tzZones.forEach(zone => {
                const card = tzGridEl.querySelector(`.tz-card[data-id="${zone.id}"]`);
                if (!card) return;
                const p = TzUtils.zoneParts(zone.tz, tzSharedInstant);
                const hour12 = p.hour % 12;
                const hourAngle = ((hour12 + p.minute / 60) / 12) * 360;
                const minAngle = (p.minute / 60) * 360;
                const period = p.hour >= 12 ? 'PM' : 'AM';
                const displayHour12 = hour12 === 0 ? 12 : hour12;

                card.querySelector('[data-role="face"]').style.background = tzFaceTint(isDark, p.hour);
                if (!(tzDrag && tzDrag.zoneId === zone.id && tzDrag.hand === 'hour')) {
                    card.querySelector('[data-role="hourhand"]').style.transform = `rotate(${hourAngle}deg)`;
                }
                if (!(tzDrag && tzDrag.zoneId === zone.id && tzDrag.hand === 'minute')) {
                    card.querySelector('[data-role="minhand"]').style.transform = `rotate(${minAngle}deg)`;
                }
                const timeInput = card.querySelector('[data-role="time"]');
                if (document.activeElement !== timeInput) {
                    timeInput.value = `${String(displayHour12).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
                }
                card.querySelector('[data-role="ampm"]').textContent = period;
                const dateInput = card.querySelector('[data-role="date"]');
                if (document.activeElement !== dateInput) {
                    dateInput.value = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
                }
                card.querySelector('[data-role="weekday"]').textContent = p.weekday;
                card.querySelector('[data-role="sub"]').textContent = TzUtils.zoneShortLabel(zone.tz, tzSharedInstant);
            });

            document.getElementById('tz-live-dot').classList.toggle('frozen', tzFrozen);
            document.getElementById('tz-live-label').textContent = tzFrozen ? 'Set time' : 'Live';
        }

        // ---------- interaction: drag hands ----------
        function tzAngleFromCenter(cx, cy, x, y) {
            const dx = x - cx, dy = y - cy;
            let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
            if (deg < 0) deg += 360;
            return deg;
        }

        function tzStartDrag(e, zoneId, faceEl) {
            const target = e.target.closest('[data-role="hourhand"], [data-role="minhand"]');
            const hand = target && target.dataset.role === 'hourhand' ? 'hour' : 'minute';
            const zone = tzZones.find(z => z.id === zoneId);
            const p = TzUtils.zoneParts(zone.tz, tzSharedInstant);
            const startAngle = ((p.hour % 12) + p.minute / 60) / 12 * 360;
            tzDrag = {
                zoneId, hand, faceEl,
                period: p.hour >= 12 ? 1 : 0,   // 0 = AM, 1 = PM, at drag start
                cumulative: startAngle,          // unwrapped running angle, for crossing detection
                lastAngle: startAngle,
            };
            faceEl.setPointerCapture(e.pointerId);
            tzFrozen = true;
            tzOnDragMove(e);
            faceEl.addEventListener('pointermove', tzOnDragMove);
            faceEl.addEventListener('pointerup', tzEndDrag, { once: true });
        }

        function tzOnDragMove(e) {
            if (!tzDrag) return;
            const rect = tzDrag.faceEl.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const deg = tzAngleFromCenter(cx, cy, e.clientX, e.clientY);
            const card = tzGridEl.querySelector(`.tz-card[data-id="${tzDrag.zoneId}"]`);

            if (tzDrag.hand === 'hour') {
                // Track the shortest-path delta so a full lap past 12 o'clock is detected
                // as a genuine AM<->PM crossing, the way a real clock's hour hand would carry on.
                let delta = deg - tzDrag.lastAngle;
                if (delta > 180) delta -= 360;
                if (delta < -180) delta += 360;
                tzDrag.cumulative += delta;
                tzDrag.lastAngle = deg;
                const laps = Math.floor(tzDrag.cumulative / 360);
                const period = (((tzDrag.period + laps) % 2) + 2) % 2; // 0 = AM, 1 = PM

                card.querySelector('[data-role="hourhand"]').style.transform = `rotate(${deg}deg)`;
                const hour12Float = deg / 360 * 12;
                const hour12 = Math.floor(hour12Float);
                const minute = Math.round((hour12Float - hour12) * 60) % 60;
                const displayHour12 = hour12 === 0 ? 12 : hour12;
                card.querySelector('[data-role="time"]').value = `${String(displayHour12).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                card.querySelector('[data-role="ampm"]').textContent = period === 0 ? 'AM' : 'PM';
                card.querySelector('[data-role="minhand"]').style.transform = `rotate(${(minute / 60) * 360}deg)`;
            } else {
                card.querySelector('[data-role="minhand"]').style.transform = `rotate(${deg}deg)`;
                const minute = Math.round((deg / 360) * 60) % 60;
                const cur = card.querySelector('[data-role="time"]').value.split(':');
                card.querySelector('[data-role="time"]').value = `${cur[0]}:${String(minute).padStart(2, '0')}`;
            }
        }

        function tzEndDrag(e) {
            if (!tzDrag) return;
            const zoneId = tzDrag.zoneId;
            tzDrag.faceEl.removeEventListener('pointermove', tzOnDragMove);
            tzDrag = null;
            tzApplyManualEdit(zoneId);
        }

        // ---------- manual edits (typed time/date, AM/PM toggle, or after drag) ----------
        function tzApplyManualEdit(zoneId) {
            const zone = tzZones.find(z => z.id === zoneId);
            const card = tzGridEl.querySelector(`.tz-card[data-id="${zoneId}"]`);
            const timeVal = card.querySelector('[data-role="time"]').value;
            const dateVal = card.querySelector('[data-role="date"]').value;
            const period = card.querySelector('[data-role="ampm"]').textContent.trim().toUpperCase();
            const m = /^(\d{1,2}):(\d{1,2})$/.exec(timeVal.trim());
            if (!m) { tzRenderAll(); return; }
            const [, hStr, minStr] = m;
            let hour12 = Math.min(12, Math.max(1, parseInt(hStr, 10)));
            const min = Math.min(59, Math.max(0, parseInt(minStr, 10)));
            const base = hour12 % 12; // 12 -> 0
            const h = period === 'PM' ? base + 12 : base;
            let y, mo, d;
            if (dateVal) {
                [y, mo, d] = dateVal.split('-').map(Number);
            } else {
                const p = TzUtils.zoneParts(zone.tz, tzSharedInstant);
                y = p.year; mo = p.month; d = p.day;
            }
            tzFrozen = true;
            tzSharedInstant = TzUtils.zonedTimeToUtc(zone.tz, y, mo, d, h, min);
            tzRenderAll();
        }

        function tzTogglePeriod(zoneId) {
            const zone = tzZones.find(z => z.id === zoneId);
            const p = TzUtils.zoneParts(zone.tz, tzSharedInstant);
            const newHour = (p.hour + 12) % 24;
            tzFrozen = true;
            tzSharedInstant = TzUtils.zonedTimeToUtc(zone.tz, p.year, p.month, p.day, newHour, p.minute);
            tzRenderAll();
        }

        // ---------- now / live ----------
        function tzGoToNow() {
            tzFrozen = false;
            tzSharedInstant = new Date();
            tzRenderAll();
        }

        function tzInit() {
            tzGridEl = document.getElementById('tz-grid');
            tzZones = tzDefaultZones();
            tzNextId = tzZones.length;
            tzRebuildGrid();
            setInterval(() => {
                if (!tzFrozen) {
                    tzSharedInstant = new Date();
                    tzRenderAll();
                }
            }, 1000);
        }

        function switchTab(tabName) {
```

- [ ] **Step 6: Wire `switchTab()` for the new tab**

Find the end of `switchTab` (currently around line 1352-1363):

```js
            } else if (tabName === 'drools-test') {
                document.querySelector('.tab:nth-child(5)').classList.add('active');
                document.getElementById('drools-test-panel').classList.add('active');
                // Restore content
                droolsInputEditor.setValue(droolsInput);
                droolsRulesEditor.setValue(droolsRules);
                droolsOutputEditor.setValue(droolsOutput);
                droolsInputEditor.refresh();
                droolsRulesEditor.refresh();
                droolsOutputEditor.refresh();
            }
        }
```

Add a branch for `'timezone'` (no CodeMirror editors to restore — `tzZones`/`tzSharedInstant` are
plain module state that persists regardless of which tab is visually active):

```js
            } else if (tabName === 'drools-test') {
                document.querySelector('.tab:nth-child(5)').classList.add('active');
                document.getElementById('drools-test-panel').classList.add('active');
                // Restore content
                droolsInputEditor.setValue(droolsInput);
                droolsRulesEditor.setValue(droolsRules);
                droolsOutputEditor.setValue(droolsOutput);
                droolsInputEditor.refresh();
                droolsRulesEditor.refresh();
                droolsOutputEditor.refresh();
            } else if (tabName === 'timezone') {
                document.querySelector('.tab:nth-child(6)').classList.add('active');
                document.getElementById('timezone-panel').classList.add('active');
            }
        }
```

- [ ] **Step 7: Call `tzInit()` on load**

Find the bootstrap block (currently around line 1980-1986):

```js
        // Initialize editors when page loads
        window.addEventListener('DOMContentLoaded', function() {
            initDarkMode();
            initEditors();
            updateInfoText();
            updateJsonInfoText();
        });
```

Add the call:

```js
        // Initialize editors when page loads
        window.addEventListener('DOMContentLoaded', function() {
            initDarkMode();
            initEditors();
            updateInfoText();
            updateJsonInfoText();
            tzInit();
        });
```

- [ ] **Step 8: Manually verify in a browser**

Run: `python3 -m http.server 8765` (from repo root, in the background)
Open: `http://localhost:8765/index.html`

Check:
- Click through all six tabs; each of the original five still shows its own content correctly
  (regression check on the `:nth-child` indices, which didn't shift since Time Zone Converter was
  appended last).
- On "Time Zone Converter": four cards (IST, Eastern, Pacific, UTC) render, each showing a 12-hour
  face with numerals 1-12, ticking live once per second, matching real-world current time for
  each zone, with a light face tint for zones currently in daytime and dark tint for nighttime.
- Drag an hour hand a full lap past 12 o'clock; confirm the AM/PM pill flips and every other card
  recomputes correctly (spot-check the math by hand for at least one pair of zones).
- Type a time into one card's time field (e.g. `09:15`) and tab out; confirm all other cards
  recompute, including a case where the new time is close enough to midnight that another zone's
  date changes.
- Click a card's AM/PM pill directly; confirm ±12h and resync.
- Click "Now"; confirm all clocks resume live ticking from the current moment.
- Open the browser console; confirm no errors during any of the above.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "Add Time Zone Converter tab with live, draggable 12-hour clocks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Zone list persistence + add/remove zones

Adds the "+ Add zone" search popover, per-card remove (✕) button, and persistence of the zone
*list* (not the displayed time) across reloads, using the existing `loadPane`/`savePane`
localStorage helpers.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: everything produced by Task 2 (`tzZones`, `tzNextId`, `tzAllZoneNames`, `tzGridEl`,
  `tzPrettyName`, `tzDefaultZones`, `tzRebuildGrid`, `tzInit`), plus the site's existing
  `loadPane(key, defaultValue)` / `savePane(key, value)` helpers (defined earlier in the same
  script, around the `PANE_STORAGE_PREFIX` constant).
- Produces: `tzLoadZones() -> Array<{tz, name, id}>`, `tzSaveZones()`,
  `tzToggleAddPopover()`, `tzRenderAddResults()`, `tzAddZone(tz: string, prettyName: string)`,
  `tzRemoveZone(id: string)`.

- [ ] **Step 1: Add the "+ Add zone" control to the panel markup**

Find the controls bar added in Task 2:

```html
        <div id="timezone-panel" class="tab-panel">
            <div class="tz-controls">
                <button class="tz-btn primary" onclick="tzGoToNow()">⦿ Now</button>
```

Replace with:

```html
        <div id="timezone-panel" class="tab-panel">
            <div class="tz-controls">
                <div class="tz-add-wrap">
                    <button class="tz-btn secondary" id="tz-add-btn" onclick="tzToggleAddPopover()">+ Add zone</button>
                    <div class="tz-add-popover" id="tz-add-popover">
                        <input class="tz-add-search" id="tz-add-search" type="text" placeholder="Search city or zone… e.g. London, CET" oninput="tzRenderAddResults()">
                        <div class="tz-add-results" id="tz-add-results"></div>
                    </div>
                </div>
                <button class="tz-btn primary" onclick="tzGoToNow()">⦿ Now</button>
```

- [ ] **Step 2: Add the remove button to each card**

Find, in `tzBuildCardSkeleton` (added in Task 2):

```js
                <div class="tz-card-head">
                    <span class="tz-card-title">${zone.name}</span>
                    <span class="tz-card-sub" data-role="sub"></span>
                </div>
```

Replace with:

```js
                <div class="tz-card-head">
                    <span class="tz-card-title">${zone.name}</span>
                    <span class="tz-card-sub" data-role="sub"></span>
                    <button class="tz-card-remove" title="Remove zone" onclick="tzRemoveZone('${zone.id}')">✕</button>
                </div>
```

- [ ] **Step 3: Add persistence + add/remove functions**

Find `tzInit` (added in Task 2):

```js
        function tzInit() {
            tzGridEl = document.getElementById('tz-grid');
            tzZones = tzDefaultZones();
            tzNextId = tzZones.length;
            tzRebuildGrid();
            setInterval(() => {
                if (!tzFrozen) {
                    tzSharedInstant = new Date();
                    tzRenderAll();
                }
            }, 1000);
        }
```

Replace it, and add the new functions right after it:

```js
        function tzLoadZones() {
            const raw = loadPane('timezoneZones', null);
            if (raw) {
                try {
                    const ids = JSON.parse(raw);
                    if (Array.isArray(ids) && ids.length > 0) {
                        return ids.map((tzId, i) => ({ tz: tzId, name: tzPrettyName(tzId), id: 'z' + i }));
                    }
                } catch (e) { /* malformed storage — fall back to defaults */ }
            }
            return tzDefaultZones();
        }

        function tzSaveZones() {
            savePane('timezoneZones', JSON.stringify(tzZones.map(z => z.tz)));
        }

        function tzToggleAddPopover() {
            const pop = document.getElementById('tz-add-popover');
            pop.classList.toggle('open');
            if (pop.classList.contains('open')) {
                document.getElementById('tz-add-search').value = '';
                document.getElementById('tz-add-search').focus();
                tzRenderAddResults();
            }
        }

        function tzRenderAddResults() {
            const q = document.getElementById('tz-add-search').value.trim().toLowerCase();
            const results = tzAllZoneNames
                .filter(tz => tz.toLowerCase().replace(/_/g, ' ').includes(q))
                .slice(0, 8);
            const box = document.getElementById('tz-add-results');
            box.innerHTML = results.map(tz => {
                const label = TzUtils.zoneShortLabel(tz, tzSharedInstant);
                const pretty = tzPrettyName(tz);
                return `<button class="tz-add-result" onclick="tzAddZone('${tz}', '${pretty.replace(/'/g, "\\'")}')"><span>${pretty}</span><span class="off">${label}</span></button>`;
            }).join('') || `<div style="padding:8px; color:#999; font-size:0.85em;">No matches</div>`;
        }

        function tzAddZone(tz, prettyName) {
            tzZones.push({ tz, name: prettyName, id: 'z' + (tzNextId++) });
            document.getElementById('tz-add-popover').classList.remove('open');
            tzSaveZones();
            tzRebuildGrid();
        }

        function tzRemoveZone(id) {
            if (tzZones.length <= 1) return;
            tzZones = tzZones.filter(z => z.id !== id);
            tzSaveZones();
            tzRebuildGrid();
        }

        function tzInit() {
            tzGridEl = document.getElementById('tz-grid');
            try { tzAllZoneNames = Intl.supportedValuesOf('timeZone'); } catch (e) { tzAllZoneNames = ['UTC']; }
            tzZones = tzLoadZones();
            tzNextId = tzZones.length;
            tzRebuildGrid();
            setInterval(() => {
                if (!tzFrozen) {
                    tzSharedInstant = new Date();
                    tzRenderAll();
                }
            }, 1000);
            document.addEventListener('click', (e) => {
                const wrap = document.querySelector('.tz-add-wrap');
                if (wrap && !wrap.contains(e.target)) {
                    document.getElementById('tz-add-popover').classList.remove('open');
                }
            });
        }
```

- [ ] **Step 4: Manually verify in a browser**

Run: `python3 -m http.server 8765` (from repo root, in the background, if not already running)
Open: `http://localhost:8765/index.html`, go to "Time Zone Converter".

Check:
- Click "+ Add zone", type "Tokyo", click the result; confirm a new card appears with correct
  live time and tint.
- Click a card's ✕; confirm it's removed and the grid reflows. Keep removing down to one zone;
  confirm the last remaining card's ✕ does nothing (can't remove the last zone).
- Reload the page; confirm your custom zone list is still there (persisted), but every clock is
  showing the current live time, not whatever was previously frozen/dragged (only the zone *list*
  persists).
- Open devtools → Application/Storage → Local Storage; confirm a `paneContent:timezoneZones` key
  holds a JSON array of IANA zone IDs matching the visible cards.
- Click "+ Add zone" to open the popover, then click elsewhere on the page; confirm it closes.
- Console has no errors throughout.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Persist Time Zone Converter zone list and add add/remove-zone UI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Dark mode integration + final end-to-end verification

Wires the site's existing dark-mode toggle to re-tint the clock faces, then runs the full
correctness checklist from the spec (DST, cross-midnight, regression) as a final gate before
considering the feature done.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `tzRenderAll()` (Task 2), the site's existing `toggleDarkMode()`.

- [ ] **Step 1: Re-render clocks on dark-mode toggle**

Find `toggleDarkMode` (existing function, currently around line 917-922):

```js
        function toggleDarkMode() {
            const isDarkMode = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDarkMode);
            updateDarkModeButton(isDarkMode);
            updateCodeMirrorThemes(isDarkMode ? 'material' : 'default');
        }
```

Replace with:

```js
        function toggleDarkMode() {
            const isDarkMode = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDarkMode);
            updateDarkModeButton(isDarkMode);
            updateCodeMirrorThemes(isDarkMode ? 'material' : 'default');
            tzRenderAll();
        }
```

(`tzRenderAll()` already no-ops safely via its `if (!tzGridEl) return;` guard if called before
`tzInit()` — which in practice never happens, since both run synchronously inside the same
`DOMContentLoaded` handler before any click is possible.)

- [ ] **Step 2: Run the automated unit tests one more time**

Run: `node --test` (from repo root)
Expected: `# tests 6`, `# pass 6`, `# fail 0` (confirms Task 1's helpers are untouched by later
tasks).

- [ ] **Step 3: Full manual verification pass in a browser**

Run: `python3 -m http.server 8765` (from repo root, in the background, if not already running)
Open: `http://localhost:8765/index.html`

Check, in order:
1. Click through all six tabs top to bottom; each shows correct content (final regression check).
2. On "Time Zone Converter", toggle dark mode (top-right button); confirm every `.tz-*` element
   re-themes correctly — card borders, hand colors, tick marks, numerals, AM/PM pill, add-zone
   popover, and both the light-tint and dark-tint clock face colors are legible with good contrast
   in both modes. Toggle back to light.
3. DST spot-check: type `09:00` + AM into the Eastern card with its date set to a day in January
   of the current year; note the UTC card's time. Now change the Eastern card's date to a day in
   July of the current year (same `09:00 AM`); confirm the UTC card's time shifted by exactly one
   hour (EST is UTC-5, EDT is UTC-4) — this is the same fact Task 1's `node --test` DST test
   checks, now confirmed through the real UI.
4. Cross-midnight check: set IST to an early-morning time (e.g. `02:00 AM`); confirm Eastern/
   Pacific show the *previous* day's date with correct late-evening/afternoon times.
5. Resize the browser window narrower than 560px; confirm the zone grid collapses to a single
   column and the controls bar stays usable.
6. Click "Now"; confirm all clocks resume ticking live from the real current time.
7. Open the browser console one last time; confirm zero errors across the whole pass.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Refresh Time Zone Converter clock tints on dark-mode toggle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
