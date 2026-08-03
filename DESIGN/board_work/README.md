# Handoff: Nástěnka mozaiky (Trencadís Kanban Board)

## Overview
A weekly planning board for a mosaic (trencadís) workshop. Tasks are "shards" (*střepy*) that the user drags from an unassigned tray into one of five weekday columns (Monday–Friday). Three weeks are selectable via a week navigator at the top. The whole board fits one screen with no horizontal scrolling.

Visual language: Gaudí / trencadís — broken-ceramic mosaic. Every card, chip, tab marker and column-title letter is an irregular ceramic shard: asymmetric border-radius on all four corners, a small random rotation, a diagonal glaze highlight, and a hairline inner light edge. The shard geometry is **deterministic** (hashed from a stable id), so it never reshuffles between renders.

UI language is Czech. All copy in this document is final and should be used verbatim.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look and behavior, not production code to copy directly.

- `Kanban Trencadis.dc.html` — the design. It is a single-file component: markup at the top, a JavaScript logic class in the `<script data-dc-script>` block at the bottom. All styling is inline.
- `support.js` — the small runtime that makes that file open standalone in a browser. **Do not port it.** It only exists so you can open the prototype; it is not part of the design.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, Svelte, SwiftUI, native — whatever the app uses), following that codebase's established patterns, styling approach and component library. If no environment exists yet, pick the framework that best fits the project and implement it there. Read the prototype's logic class as a specification of behavior, not as code to lift.

Template syntax notes for reading the file: `{{ value }}` is a data hole, `<sc-for list as>` is a list loop, `<sc-if value>` is a conditional, `style-hover="{...}"` is a hover style. These are prototype-only constructs — express them with your framework's normal idioms.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows and copy are final. Recreate the UI pixel-accurately with the codebase's own libraries and patterns. The one intentionally loose element is shard rotation/radius randomness — reproduce the *rules* (ranges below), not the exact per-element values.

---

## Screen: Nástěnka mozaiky

One screen, four stacked regions in a vertical flex column. Page background `#EFE7D6`, base text `#2A241C`, `min-height: 100vh`, `overflow-x: hidden`.

Horizontal page inset is **40px** on every region. Region vertical rhythm: header `30px` top / `16px` bottom, week navigator `14px` bottom, tray `14px` bottom, board `4px` top / `36px` bottom.

### 1. Header (top bar)
Flex row, `align-items: flex-end`, `justify-content: space-between`, `gap: 24px`, wraps.

Left block:
- Eyebrow — "Dílna trencadís · Kanban" — Barlow Semi Condensed 600, 12px, uppercase, `letter-spacing: 0.42em`, `#C1553A`, `margin-bottom: 10px`.
- Title — "Nástěnka *mozaiky*" — Cormorant Garamond 600, 46px, `line-height: 1.1`, `#17403f`, `white-space: nowrap`. The word "mozaiky" is italic and `#C1553A`.
- Subtitle — "Týdenní plán dílny — pondělí až pátek" — Barlow 400, 14px, `#5c5344`, `margin-top: 6px`.

Right block: a back link "← Zpět na paletu" — Barlow Semi Condensed 600, 12px, uppercase, `letter-spacing: 0.16em`, `#5c5344`, padding `10px 16px`, `1px solid rgba(42,36,28,0.22)`, `border-radius: 4px`. In the prototype it points at the project's palette page; in the app, wire it to whatever the parent view is (or drop it if there is none).

### 2. Week navigator
Flex row, `align-items: stretch`, `gap: 8px`: prev arrow button, a flex-1 row of three week tabs (`gap: 8px`, each `flex: 1`), next arrow button.

Arrow buttons — 42px wide, full height of the row, `1px solid rgba(42,36,28,0.18)`, background `rgba(255,252,244,0.5)`, Barlow 600 16px, `#6b6153`. Glyphs are `‹` and `›`. Shard radii: prev `10px 6px 9px 7px`, next `7px 9px 6px 10px`. Hover: background `#FFFCF4`, color `#C1553A`.

Week tab (button) — flex row, `align-items: center`, `gap: 13px`, padding `11px 15px 10px`, `text-align: left`.
- Mosaic marker: a 7px-wide, full-height vertical column of **4 shards** (`flex-direction: column; gap: 1.5px`), each `flex: <grow> 1 0`, glaze gradient, small radius and rotation. Active tab draws from `['#C1553A', '#E9B23C', '#17789E', '#2F8049']`; inactive from muted stone `['#B8AC96', '#C4B49A', '#ADA48F', '#BFB39B']`. Shard values: `grow` 0.70–1.80, radius per-corner 1–4px / 1–3px, rotation ±5°.
- Label — e.g. "Týden 31" — Barlow Semi Condensed 600, 14px, uppercase, `letter-spacing: 0.14em`.
- Date range — e.g. "27.–31. července" — Barlow 400, 13px, `margin-top: 3px`, `white-space: nowrap`.
- Summary, right-aligned — Barlow 600, 12px, `white-space: nowrap`. Format: `"{n} úkolů"`, plus `" · {m} volných"` when the week has tray items.

Tab states:

| | active | inactive |
|---|---|---|
| background | `#FFFCF4` | `rgba(255,252,244,0.35)` |
| border | `1px solid rgba(23,64,63,0.55)` | `1px solid rgba(42,36,28,0.16)` |
| radius | `11px 7px 12px 8px` | `9px 6px 10px 7px` |
| shadow | `0 4px 14px -10px rgba(42,36,28,0.6)` | none |
| label color | `#17403f` | `#7d7365` |
| meta color | `#6b6153` | `#948a79` |

**Czech pluralization** for the summary counts — `n === 1` → singular, `2–4` → few, else many: `úkol / úkoly / úkolů`, `volný / volné / volných`.

### 3. Tray — "Volné střepy" (unassigned tasks)
A drop zone: margin `0 40px 14px`, padding `12px 14px`, `1.5px dashed rgba(74,58,36,0.35)`, `border-radius: 12px`, flex row, `align-items: center`, `gap: 16px`, wraps. Background `rgba(216,198,160,0.45)`, becoming `#E3D2AC` while a shard is dragged over it.

Left label block (`max-width: 200px`): "Volné střepy" — Barlow Semi Condensed 600, 12px, uppercase, `letter-spacing: 0.16em`, `#17403f`; under it "Přetáhni je do dne v týdnu" — Barlow 400, 12px, `#6b6153`, `margin-top: 3px`.

Chips fill the rest: flex row, wrap, `gap: 10px`. Chip = flex row, `align-items: center`, `gap: 9px`, padding `7px 12px`, background `rgba(255,252,244,0.72)`, `box-shadow: inset 0 0 0 1px rgba(74,58,36,0.14)`, shard radius + rotation, `cursor: grab`, `draggable`. Contents:
- 9×9px color swatch, `border-radius: 2px 1px 3px 1px`, filled with the task's softened color.
- Title — Barlow 600, 13.5px, `#3A3226`.
- Meta — `"{tag} · {initials}"` — Barlow Semi Condensed 600, 10px, uppercase, `letter-spacing: 0.1em`, `#948a79`.

Empty state (all shards assigned): "Všechny střepy jsou rozdělené — sem můžeš vrátit úkol zpátky." — Barlow 400, 13px, `rgba(74,58,36,0.55)`, padding `8px 2px`.

### 4. Board — five weekday columns
`display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; align-items: start`. Equal fractional columns — **never a horizontal scroller**; the board must always fit the viewport width.

Column panel — `min-width: 0`, `border-radius: 14px`, `overflow: hidden`, background `#D8C6A0`, shadow `inset 0 2px 8px rgba(74,58,36,0.22), 0 1px 0 rgba(255,255,255,0.4)`. While dragging over it: background `#E3D2AC` and an added `0 0 0 2px <dayAccent>` ring.

**Column header — the day name laid as trencadís.** This is the signature element. Padding `12px 11px 11px`, background `linear-gradient(180deg, rgba(74,58,36,0.09), rgba(74,58,36,0) 92%)`, flex row, `gap: 8px`, `align-items: center`.
- The day name is split **per character**, each character on its own ceramic tile: `display: block`, padding `7px {3–5}px 6px`, Barlow Semi Condensed 600, **14px**, `line-height: 1.2`, uppercase; per-corner radius 3–7px / 2–6px / 3–8px / 2–6px; `transform: rotate(±4°) translateY(±1.5px)`; glaze `linear-gradient(155deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 55%, rgba(0,0,0,0.07))`; `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14), 0 2px 5px -5px rgba(42,36,28,0.5)`. Tiles sit in a flex row, `align-items: flex-end`, `gap: 1px`, `overflow: hidden`, each `flex: 0 1 auto`. **Must fit the narrow column** — "Čtvrtek" and "Pondělí" are the stress cases; keep diacritics intact (Č, Ú, ě, í).
- Tile color: start from `mix(dayAccent, #EFE7D6, 0.30)` = *base*, then per tile pick one of four variations by hash bucket — 40% `mix(base, #17403f, 0.06–0.16)`, 32% plain *base*, 16% `mix(base, #E9B23C, 0.12–0.26)`, 12% `mix(base, #FFF6E2, 0.10–0.22)`. Text color is auto-contrast (below).
- Right side: task count — Barlow 600, 11.5px, `rgba(58,50,38,0.62)`.

**Cards** — column body is `flex-direction: column; gap: 9px; padding: 11px 11px 13px`.

Card = a ceramic shard, `draggable`, `cursor: grab`:
- background = task color softened by `mix(hex, #EFE7D6, 0.26)`, over glaze `linear-gradient(158deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 45%, rgba(0,0,0,0.06))`
- per-corner radius 9–16px / 6–11px / 10–17px / 6–11px; rotation ±0.8°
- padding `13px 14px 12px`; `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), 0 5px 12px -10px rgba(42,36,28,0.45)`
- opacity drops to `0.45` while this card is the one being dragged
- Tag row: flex, `flex-wrap: wrap`, `gap: 5px 6px`, `margin-bottom: 9px`. Tag pill — Barlow Semi Condensed 600, 10.5px, uppercase, `letter-spacing: 0.08em`, `#2A241C` on `rgba(255,252,244,0.92)`, `border-radius: 4px`, padding `2px 8px`. Optional "urgentní" pill — same font at 10px, `letter-spacing: 0.06em`, white on `#A8412C`, padding `2px 6px`.
- Title — Barlow 600, 15px, `line-height: 1.28`, auto-contrast color.
- Footer row (`margin-top: 12px`, space-between): due text — Barlow 400, 11.5px, auto-contrast muted; avatar — 24×24 circle, `#2A241C` fill, `#F1EAD8` initials at Barlow 600 10.5px, `box-shadow: inset 0 0 0 1.5px rgba(255,252,244,0.5)`.

**Drop placeholder** at the bottom of every column: `1.5px dashed rgba(74,58,36,0.4)`, `border-radius: 10px 7px 11px 8px`, padding `10px`, centered Barlow Semi Condensed 600, 11.5px, uppercase, `letter-spacing: 0.1em`, `rgba(74,58,36,0.6)`. Label is "+ přetáhni střep", switching to "↓ pusť střep sem" while that column is the active drop target.

---

## Interactions & Behavior

**Week switching.** Clicking a week tab activates that week. `‹` / `›` step to the previous/next week and **wrap around** (modulo the week count). Switching weeks clears the drop-target highlight. Default week on load is index 1 ("Týden 31").

**Drag and drop.** HTML5 drag-and-drop in the prototype; use whatever the target platform prefers, but keep the semantics:
- Draggable sources: tray chips and column cards. On drag start, record `{ from, id }` where `from` is `'pool'` or a day index `0–4`; set move effect.
- Drop targets: each of the five columns, and the tray. Drag-over is only accepted when a drag is in progress; it sets the hovered target, which drives the column/tray highlight and the placeholder label.
- On drop: remove the task from its source list, append it to the destination list, clear drag state. Dropping onto the source is a harmless no-op. Cards can move day→day, tray→day, and day→tray.
- Drag end (including cancel) clears drag and hover state.
- Feedback while dragging: source item at `opacity: 0.45`; target panel lightened `#D8C6A0` → `#E3D2AC` (tray: `rgba(216,198,160,0.45)` → `#E3D2AC`) plus the accent ring on columns.
- Reordering *within* a column is not supported — dropped cards append to the end. Counts, tab summaries and the tray empty-state all recompute from state.

**Hover.** Only the two arrow buttons have an explicit hover treatment (see above). Week tabs, cards and chips rely on the cursor (`grab` / `pointer`).

No animations, transitions, loading states, error states or form validation. No responsive breakpoints in the prototype: the layout survives narrowing because the board is a 5×`1fr` grid and the header/tray rows wrap. If the app must support narrow viewports, the intended fallback is to let the five columns become a 2- or 1-column grid rather than to introduce horizontal scroll.

## State Management

```
weeks: Week[]                     // seed data, mutated by drops
wi: number                        // active week index, default 1
drag: { from: 'pool' | 0..4, id } | null
over: 'pool' | 0..4 | null        // current drop target highlight
```

```
Week = { label, range, days: Day[5], pool: Task[] }
Day  = { name, accent, cards: Task[] }
Task = { id, title, tag, hex, due, who, urgent }
```

Derived per render (not stored): per-day card counts, per-week totals and tab summary strings, tray empty flag, softened card colors, auto-contrast text colors, shard geometry, day-name letter tiles.

All state is local and in-memory; no persistence and no data fetching in the prototype. In a real app, `weeks` is the server-owned model — a drop is a task-reassignment mutation (`taskId` → `{ week, day | unassigned }`); apply it optimistically and reconcile.

## Derived-value rules (port these exactly)

**Deterministic hash** — FNV-1a over a string, normalized to `[0,1)`:
```
h = 2166136261
for each char: h ^= charCode; h = imul(h, 16777619)
return ((h >>> 0) % 100000) / 100000
```
Every shard's radius, rotation and color bucket is drawn from this hash, seeded by the task id (or day name + character index) plus a per-property key letter. This is what keeps the mosaic stable across re-renders — do not substitute `Math.random()`.

**Color mix** — per-channel linear interpolation between two hex colors: `mix(a, b, t)`.

**Auto-contrast text** — relative luminance `L = (0.299R + 0.587G + 0.114B) / 255`:
- body text: `L > 0.6` → `rgba(42,36,28,0.86)`, else `rgba(255,252,244,0.97)`
- muted/meta text: `L > 0.6` → `rgba(42,36,28,0.6)`, else `rgba(255,252,244,0.75)`

**Shard chaos multiplier** — a single scalar (default `0.55`) scales card rotation (base ±3°), letter-tile rotation (base ±8°) and letter-tile vertical offset (base ±3px). `0` gives a perfectly aligned grid; `1` is full trencadís irregularity. Expose it as a config constant if you want a calmer or wilder board.

## Design Tokens

**Surfaces & ink**

| Token | Value | Use |
|---|---|---|
| Page background | `#EFE7D6` | canvas; also the softening target for all shard colors |
| Column panel | `#D8C6A0` | column body |
| Column panel (drop) | `#E3D2AC` | active drop target |
| Card / tab surface | `#FFFCF4` | active week tab; chip background at 72% |
| Ink | `#2A241C` | base text, avatar fill |
| Ink soft | `#3A3226` | chip title |
| Deep green | `#17403f` | headings, section labels |
| Terracotta | `#C1553A` | accent, eyebrow, hover |
| Urgent red | `#A8412C` | "urgentní" pill |
| Muted text | `#5c5344`, `#6b6153`, `#7d7365`, `#948a79` | subtitles, meta, inactive |
| Glaze gold | `#E9B23C` | shard color variation |
| Glaze cream | `#FFF6E2` | shard color variation |
| Avatar ink | `#F1EAD8` | initials on `#2A241C` |
| Link | `#17789E`, hover `#C1553A` | anchors |

**Day accents** (column index 0→4): `#7C6AA6` Mon, `#E0692A` Tue, `#2B5EA7` Wed, `#B4823A` Thu, `#2F8049` Fri.

**Task shard colors** (raw; always rendered through `mix(hex, #EFE7D6, 0.26)`): `#37B0AC`, `#1FA5A0`, `#C1553A`, `#DE6A45`, `#CE9A34`, `#E9B23C`, `#B4823A`, `#2B5EA7`, `#4C8C3F`, `#8FA36B`, `#7B8E3C`, `#7C6AA6`, `#2F8049`.

**Typography** — three Google families:
- **Cormorant Garamond** 500/600 + italic 500 — display only (page title).
- **Barlow** 400/500/600 — body, card titles, meta, counts.
- **Barlow Semi Condensed** 500/600 — all uppercase labels, tags, day-name tiles, buttons.

Scale in use: 46px title / 15px card title / 14px subtitle & tab label & day tile / 13.5px chip title / 13px tab range / 12px eyebrow & section label & summary / 11.5px due & count & placeholder / 10.5px tag & avatar / 10px chip meta & urgent pill. Tracking: `0.42em` eyebrow, `0.16em` section labels & back link, `0.14em` tab label, `0.1em` placeholder & chip meta, `0.08em` tag, `0.06em` urgent pill.

**Spacing** — 40px page inset; 14px board gap; 8px navigator gap; 16px / 14px / 13px / 12px / 11px / 10px / 9px / 8px / 6px / 5px / 3px / 1.5px / 1px steps as specified per component.

**Radii** — 14px column panel; 12px tray; 4px pills and back link; 50% avatar; everything else is an irregular 4-corner shard radius (ranges given per component).

**Shadows**
- column panel: `inset 0 2px 8px rgba(74,58,36,0.22), 0 1px 0 rgba(255,255,255,0.4)`
- card: `inset 0 0 0 1px rgba(255,255,255,0.12), 0 5px 12px -10px rgba(42,36,28,0.45)`
- day tile: `inset 0 0 0 1px rgba(255,255,255,0.14), 0 2px 5px -5px rgba(42,36,28,0.5)`
- chip: `inset 0 0 0 1px rgba(74,58,36,0.14)`
- active week tab: `0 4px 14px -10px rgba(42,36,28,0.6)`
- avatar: `inset 0 0 0 1.5px rgba(255,252,244,0.5)`

**Glaze gradients** (the ceramic sheen; the angle differs by element)
- cards / chips: `linear-gradient(158deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 45%, rgba(0,0,0,0.06))`
- day tiles: `linear-gradient(155deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 55%, rgba(0,0,0,0.07))`
- tab markers: `linear-gradient(150deg, rgba(255,255,255,0.2), rgba(255,255,255,0) 60%, rgba(0,0,0,0.07))`
- column header: `linear-gradient(180deg, rgba(74,58,36,0.09), rgba(74,58,36,0) 92%)`

## Assets
None. No images, no icon set, no SVG. Every visual is CSS: irregular border-radius, rotation, gradients and shadows. Arrows and glyphs are text characters — `‹`, `›`, `←`, `↓`, `+`, `·`, `—`, `–`. Fonts come from Google Fonts; self-host them if the codebase does that for its other faces.

## Seed content
The prototype ships three weeks of realistic Czech workshop content — see `buildWeeks()` in the logic class for the full list (week labels "Týden 30/31/32", ranges "20.–24. července", "27.–31. července", "3.–7. srpna"; tags `návrh`, `materiál`, `mozaika`, `foto`, `kvalita`, `příprava`, `rozpočet`, `rešerše`, `dílna`; assignee initials MB, JG, AM, PK, LS). Treat it as sample data — the shape matters, the specific tasks do not.

## Screenshots
- `screenshots/01-board.png` — default state, week 31 active (tray with 4 loose shards, all five day columns filled).
- `screenshots/02-board.png` — week 30 selected: every task assigned, so the tray shows its empty state and each column shows the drop placeholder.
- `screenshots/03-board.png` — week 32 selected: sparse week with two empty days (count 0, placeholder only) and 3 loose shards in the tray.

## Files
- `Kanban Trencadis.dc.html` — the design (markup + logic + all inline styles).
- `support.js` — prototype runtime only, so the HTML opens in a browser. Not part of the design; do not port.

Open `Kanban Trencadis.dc.html` directly in a browser to interact with the prototype: switch weeks, drag chips into days, drag cards between days and back to the tray.
