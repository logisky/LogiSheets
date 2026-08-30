# fuse-beads (电子拼豆)

A LogiSheets craft for making **fuse-bead / pixel-bead art** (拼豆 — known abroad
as *fuse beads* / *melty beads*, brand names *Hama*, *Perler*, *Nabbi*) directly
on a worksheet.

## What it does

- **开始拼豆** creates (or resets) a worksheet named `拼豆板` and shapes its first
  `rows × cols` cells into squares, then jumps to it.
- **选豆区** holds the full official MARD (咪呀) chart — all **291 colors**
  ([source](https://www.pixel-beads.com/mard-bead-color-chart)), grouped exactly
  like the printed chart: **one tab per series letter** (A, B, … ZG — 15 in all).
  Only the active series' grid shows, in a height-capped box, so the panel stays
  compact. Each swatch shows its in-series number; the full code (e.g. `A7`) is
  on hover. Click a swatch to add/remove it from your workspace.
- **我的工作区** holds the colors you picked (plus an always-present eraser).
  **Left-click** a chip to set it as the *left* brush; **right-click** to set the
  *right* brush.
- On the canvas: **left-click** paints the left color, **right-click** paints the
  right color, and dragging with a button held paints a continuous stroke.
  **Ctrl/⌘ + wheel** (or a trackpad pinch) zooms — that one is the engine's
  own gesture, not this craft's.
- Every painted bead also gets its **color code written into the cell** (e.g.
  `A7`, `H1`), centered, sized to fit the square, in a contrasting color (white
  on dark beads, near-black on light) — so the pattern doubles as a
  **color-by-number chart**. **色号显示** toggles whether those codes are shown on
  the canvas (the codes are always stored; this only affects display).

Each painted bead is its own undoable step (`Ctrl+Z` lifts one bead).

## How it works

Pure helpers live in `src/index.ts` (palette, hex→color, square-cell math, and
the board-setup / paint transactions). The UI and the canvas wiring live in
`index.html`. It uses the host capabilities injected onto the craft iframe:

- `window.workbook.handleTransaction(...)` — `createSheet` / `deleteSheet`,
  `setColWidth` / `setRowHeight`, `cellInput` (the color code) and one combined
  `cellStyleUpdate` (`setPatternFill` + `setFontSize` + `setFontColor` +
  `setAlignment`). The core applies every field of a `StyleUpdateType` in one
  update, so a bead's fill and its label styling ride in a single payload.
- `window.onCanvasInput(handler)` — intercept mouse/wheel events on the canvas
  (added in commit `4c20df3`).
- `window.setShowCellValues` / `window.getShowCellValues` — show/hide the written
  color codes (a worker-global engine render toggle; drives the **色号显示**
  button, which adopts the engine's current state on load).
- `window.setSelection(sheetIdx, row, col)` — jump to the new sheet.

## Palette

`src/palette.ts` holds the official 291-color MARD chart as `[code, hex]` pairs.
`PALETTE` groups them by series letter (parsed from the code) into one tab each,
sorted by number within the series — so adding or editing a color only means
touching the `RAW` list.

## Build

```bash
yarn build   # vite build (UMD) → copies index.html + fuse-beads.js to public/fuse-beads/
```
