# memory-grid (记忆挑战)

A 24-level memory game played on an 8×8 LogiSheets grid. Cells flash a **color**
and/or a **number** one at a time; after the sequence you pick the cells that
match a question (e.g. "select the cells that showed red", "…that showed 7",
"…that were red **and** 7"). Progress is saved in craft-state, so you resume at
the level you reached.

## Difficulty ladder (4 tiers × 6 levels)

Four axes tighten together: shorter display time, longer sequences, richer
content (color → number → both), and harder questions (one cell → several →
combined color∧number, plus two cells flashing at once at the top).

| Lv | Content | Seq N | Show | Question | Pick |
|----|---------|-------|------|----------|------|
| 1–2 | color | 3 | 1000→900ms | which was [color] | 1 |
| 3–6 | color | 4→5 | 850→650ms | which / all [color] | 1–2 |
| 7–12 | number | 4→6 | 900→600ms | which / all [number] | 1–2 |
| 13–14 | color+number | 5 | 800→750ms | which [color] / [number] | 1 |
| 15–18 | color+number | 6→7 | 700→550ms | [color] ∧ [number] | 1→3 |
| 19–24 | color+number | 7→10 | 550→350ms | [color] ∧ [number] | 2→3 |

Levels 20–24 flash two cells simultaneously. Full per-level config in
`src/levels.ts`.

## How it works (reuses the fuse-beads patterns)

- Own worksheet `记忆挑战`, an 8×8 square-cell board created once via `ensureBoard`
  (created, never deleted — levels reuse it and clear it between rounds).
- **Flashing**: non-undoable `cellStyleUpdate` (fill) + `cellInput` (centered,
  bold, contrast-colored number), driven by a `setTimeout` chain; cleared after
  `showMs`.
- **Answering**: `window.onCanvasInput` — during the answer phase a click toggles
  a pick marker on the cell; `mousedown` is always consumed on the board (blocks
  the selection box and the double-click-to-edit). `window.setSelectionSuppressed(true)`
  hides the selection highlight.
- **Progress**: `window.getCraftState()` / `setCraftState()` store
  `{ level, best }` (JSON). Includes "重试本关" and "重置进度".

The round generator (`generateRound`) constrains the *questioned* attribute to
match exactly `answerCount` cells, so the answer set is always unambiguous; the
other flashed cells are distractors.

## Build

```bash
yarn build   # vite (UMD) → copies index.html + memory-grid.js to public/memory-grid/
```
