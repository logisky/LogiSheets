---
description: "Tutorial: build a LogiSheets craft from scratch — the host API, common patterns, and gotchas for embedding a custom app inside a spreadsheet."
---

# Writing a craft

A **craft** is a small app that lives inside LogiSheets and drives the
spreadsheet. This guide walks from an empty folder to a working craft, then
documents the host API, the common patterns, and the gotchas that will
otherwise cost you an afternoon.

By the end you'll understand the crafts already in the repo — `fuse-beads` (a
canvas painter), `lights-out` / `memory-grid` / `minesweeper` (grid games),
`sudoku` (a formula-driven puzzle), and `markdown-table-extractor` /
`what-if-calculator` (selection-driven data tools). They're the best reference
once you know the shape.

## How a craft runs

A craft is a **standalone package** under `crafts/` that builds to a single
**UMD bundle** and is loaded inside a **same-origin `<iframe>`** in the craft
panel. Because the iframe is same-origin, the host injects a set of
capabilities directly onto the craft's `window` — no `postMessage`, just
function calls. Your craft is plain DOM + JS/TS; there is no required
framework.

Two things reach your craft:

- **`window.workbook`** and friends — the injected host APIs (read/write the
  sheet, listen to canvas input, persist state, …). See
  [Host API](#the-host-api).
- Your own exported module — the UMD `name` from `vite.config.ts` becomes a
  global, e.g. `window.MyCraft`, which your `index.html` calls.

## Anatomy of a craft

```
crafts/my-craft/
├── package.json      # build + copy-to-public scripts, deps
├── vite.config.ts    # UMD library build
├── tsconfig.json      # standalone TS config
├── index.html        # the UI + wiring (loaded in the iframe)
├── src/
│   └── index.ts      # exported helpers (pure logic + workbook calls)
└── README.md
```

Convention that pays off: put **pure logic and workbook transactions in
`src/index.ts`** (typed, testable) and keep **`index.html` for the DOM and the
event wiring**. Every craft in the repo follows this split.

## Quick start: a minimal craft

We'll build `hello-craft`: a button that writes into the currently selected
cell and paints it yellow. It demonstrates reading the selection, building a
transaction, and toasting the user.

### 1. `package.json`

```json
{
    "name": "hello-craft",
    "version": "0.1.0",
    "main": "dist/hello-craft.js",
    "scripts": {
        "build": "vite build && yarn copy-to-public",
        "copy-to-public": "rm -rf ../../public/hello-craft && mkdir -p ../../public/hello-craft && cp index.html ../../public/hello-craft/index.html && cp dist/hello-craft.js ../../public/hello-craft/hello-craft.js"
    },
    "license": "MIT",
    "dependencies": { "logisheets-web": "workspace:*" },
    "devDependencies": { "typescript": "^5.5.0", "vite": "^5.0.0" }
}
```

The `copy-to-public` step is what makes the craft loadable: the dev server and
production build both serve crafts from `public/<name>/`.

### 2. `vite.config.ts`

```ts
import {defineConfig} from 'vite'
import path from 'node:path'

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'HelloCraft', // → window.HelloCraft
            fileName: () => 'hello-craft.js',
            formats: ['umd'],
        },
        target: 'es2018',
        minify: false,
    },
})
```

Copy `tsconfig.json` from any existing craft (they're identical).

### 3. `src/index.ts` — the logic

```ts
import {getFirstCell} from 'logisheets-web'
import type {Selection, EditPayload} from 'logisheets-web'

// The subset of window.workbook we use here.
interface Workbook {
    handleTransaction(p: {
        transaction: {payloads: readonly EditPayload[]; undoable: boolean; temp: boolean}
    }): Promise<unknown>
}

export async function writeHello(workbook: Workbook, selection: Selection) {
    const first = getFirstCell(selection.data) // {x: col, y: row} or undefined
    if (!first) return
    const {sheetIdx} = selection
    const payloads: EditPayload[] = [
        {
            type: 'cellInput',
            value: {sheetIdx, row: first.y, col: first.x, content: 'Hello from a craft 👋'},
        } as EditPayload,
        {
            type: 'cellStyleUpdate',
            value: {
                sheetIdx,
                row: first.y,
                col: first.x,
                // fills use an {red,green,blue} OBJECT (0–255) — see Gotchas
                ty: {setPatternFill: {patternType: 'solid', fgColor: {red: 255, green: 224, blue: 130}}},
            },
        } as EditPayload,
    ]
    await workbook.handleTransaction({transaction: {payloads, undoable: true, temp: false}})
}
```

### 4. `index.html` — the UI

```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>Hello Craft</title></head>
<body>
  <button id="go" type="button">Write into the selected cell</button>
  <script src="./hello-craft.js"></script>
  <script>
    // Host APIs are injected asynchronously — wait for them.
    function whenReady(cb) {
      let n = 0
      ;(function loop() {
        if (window.workbook) return cb()
        if (n++ > 600) return console.warn('host APIs never arrived')
        setTimeout(loop, 50)
      })()
    }
    document.getElementById('go').addEventListener('click', function () {
      if (!window.workbook || !window.selection) return
      window.HelloCraft.writeHello(window.workbook, window.selection)
        .then(function () { window.notifyCraft && window.notifyCraft('success', 'Done!') })
        .catch(function (e) { window.notifyCraft && window.notifyCraft('error', String(e)) })
    })
    whenReady(function () { /* ready — enable UI, load state, etc. */ })
  </script>
</body></html>
```

### 5. Register it (one place: `crafts.config.json`)

Add your craft to the `registry` in `crafts.config.json` (repo root) — the
single source of truth the panel, the publish step, and the desktop build all
read:

```json
"registry": {
  …
  "hello-craft": {"label": "Hello Craft"}
}
```

That's it — it's now in the `default` distribution (`"crafts": "all"`), so the
panel offers it and `publish-crafts.sh` ships it. To include it in a *specific*
subset distribution, add its directory name to that distribution's `crafts`
array. You do **not** edit `craft-panel/index.tsx` or `publish-crafts.sh` — both
derive their lists from this file (see [Distributions](#distributions)).

### 6. Build & run

```bash
yarn install                      # first time only (links the workspace)
yarn workspace hello-craft build  # builds + copies to public/hello-craft/
```

Start the app (`yarn start:dev`), open the craft panel, pick **Hello Craft**,
select a cell, click the button. See [Dev workflow](#dev-workflow) for the
edit-reload loop.

## The host API

Everything below is injected onto the craft's `window` (see `inject()` in
`src/components/craft-panel/index.tsx`). They appear **after** the iframe loads,
so guard with a `whenReady` poll before first use.

### Read & write the spreadsheet — `window.workbook`

The primary object. It's the same `Client` the app uses, so it has the full
read surface (`getCell`, `getCells`, `getAllSheetInfo`, `getStyle`,
`getSheetDimension`, …) plus mutation via `handleTransaction`.

```ts
// WRITE: one transaction = one undo step. `temp: false`, `undoable` as you like.
const effect = await window.workbook.handleTransaction({
  transaction: {payloads, undoable: true, temp: false},
})

// READ a computed cell value:
const cell = await window.workbook.getCell({sheetIdx: 0, row: 0, col: 0})
const value = cell.value.value   // e.g. a number/string, or an error like "#NAME?"

// List sheets (array order == sheet order):
const sheets = await window.workbook.getAllSheetInfo() // [{name, id, hidden, tabColor}]
```

`handleTransaction` **does not throw when the engine rejects the payload** — it
resolves with an `ActionEffect` whose `status.type === 'err'`. Always check it
(see Gotchas). Payloads are `EditPayload` objects; the ones you'll use most:

| Payload | Shape |
| --- | --- |
| create a sheet | `{type:'createSheet', value:{idx, newName}}` |
| delete a sheet | `{type:'deleteSheet', value:{idx}}` |
| set column width | `{type:'setColWidth', value:{sheetIdx, col, width}}` |
| set row height | `{type:'setRowHeight', value:{sheetIdx, row, height}}` |
| write a value/formula | `{type:'cellInput', value:{sheetIdx, row, col, content}}` |
| style a cell | `{type:'cellStyleUpdate', value:{sheetIdx, row, col, ty}}` |

`cellStyleUpdate.ty` is a `StyleUpdateType`: `setPatternFill`, `setFontColor`,
`setFontBold`, `setFontSize`, `setAlignment:{horizontal, vertical}`,
`setTop/Bottom/Left/RightBorderStyle` (`'thin'|'medium'|'thick'|'none'`) and the
matching `…BorderColor`. You can also import builders from `logisheets-web`
(`CellInputBuilder`, `CellStyleUpdateBuilder`, `StyleUpdateTypeBuilder`, …) if
you prefer them to object literals.

### Selection — `window.selection`, `setSelection`, `onSelectionChange`

```ts
window.selection                       // {sheetIdx, data} snapshot
window.onSelectionChange((s) => {…})   // subscribe; returns a disposer
window.setSelection(sheetIdx, row, col)// move selection / jump to a sheet
window.setSelectionSuppressed(true)    // hide the selection highlight entirely
```

`setSelectionSuppressed(true)` is what painting/game crafts use so no selection
box gets in the way; it's reset automatically when the panel closes or another
craft is chosen. Use `getFirstCell(selection.data)` (from `logisheets-web`) to
get the `{x: col, y: row}` of the active cell.

### Canvas input — `window.onCanvasInput`, `setCanvasZoom`

Intercept mouse/keyboard on the spreadsheet canvas **before the engine sees
it** — the seam for custom click/drag/paint tools.

```ts
const dispose = window.onCanvasInput((e) => {
  // e: {type, sheetIdx, row, col, button, buttons, offsetX, offsetY,
  //     deltaX, deltaY, key, shiftKey, ctrlKey, altKey, metaKey, …}
  if (e.type === 'wheel' && e.shiftKey) {
    window.setCanvasZoom((window.getCanvasZoom() || 1) * (e.deltaY < 0 ? 1.1 : 0.9))
    return true          // consumed — the engine won't scroll
  }
  return false           // pass through to the engine
})
```

`e.type` is one of `mousedown | mousemove | mouseup | click | dblclick |
contextmenu | wheel | keydown | keyup`. **Return `true` to consume** the event
(the engine never sees it), `false`/`undefined` to let it through. `e.row` /
`e.col` are the already-hit-tested cell under the pointer (or `null`). The
handler only fires while the panel is open **and** this craft is the selected
one.

::: tip Blocking the built-in cell editor
Double-click-to-edit is triggered by the engine's own `mousedown` handler (a
rapid second mousedown), **not** a `dblclick` event. To stop the formula editor
opening while you paint, consume `mousedown` on your board (return `true`).
:::

### Display — `setShowCellValues`, `setCanvasZoom`

Worker-global engine render toggles the craft can drive (they affect **every**
view — the engine shares one worker/workbook):

- `setCanvasZoom(factor)` / `getCanvasZoom()` — zoom the grid (1 = 100%, clamped
  to `[0.5, 3]`).
- `setShowCellValues(show)` / `getShowCellValues()` — show or hide cell **values**
  (the text/number content). Fills, borders and grid lines keep rendering — only
  the cell text is toggled. Cell values are still stored; this is display-only.

```ts
// Fill cells AND write a label into each, then let the user toggle the labels.
// (fuse-beads does exactly this: it writes each bead's color code into the cell
// so the pattern doubles as a color-by-number chart, with a "show/hide" button.)
window.setShowCellValues(false) // hide the written labels; true to show again
```

Because these are worker-global and outlive an iframe reload, read the current
state on load (`getShowCellValues()`) so your toggle's label matches reality.

### Persistence — `setCraftState` / `getCraftState` vs `craftStorage`

- **`setCraftState(json)` / `getCraftState()`** — an opaque per-**document**
  string the host folds into the saved workbook. Use it for progress that
  belongs to *this* file (game level, current board). You own the schema
  (JSON-encode it yourself).
- **`window.craftStorage`** — a device-scoped async key/value store (localStorage
  on web, app-data dir on desktop) that persists **across documents** on this
  machine. Use it for machine-wide preferences.

```ts
window.setCraftState(JSON.stringify({level: 3, best: 42}))
const state = JSON.parse(window.getCraftState() || '{}')
```

### Host UI — `notifyCraft`, `uiSettings`, `setCellLayouts`

- `notifyCraft('success'|'info'|'warn'|'error', msg)` — a toast.
- `uiSettings` — toggle host modes (temp mode, block-info overlays).
- `setCellLayouts([...])` — overlay markers on cells (used by `what-if`).
- `blockManager` / `onBlockCellEdit` — the block-interface APIs (advanced).

## Common patterns

### Give the craft its own sheet with square cells

Games/canvas crafts usually create a dedicated sheet and square up its cells.
The engine renders `colWidth px = width × 7` and `rowHeight px = pt × 96/72`, so
for an `S`-px square use **`width = S / 7`** and **`height = S × 0.75`**:

```ts
// create the sheet (once), then size rows/cols
const infos = await workbook.getAllSheetInfo()
const idx = infos.length
await commit(workbook, [{type: 'createSheet', value: {idx, newName: '我的棋盘'}}])
const width = S / 7, height = (S * 72) / 96
const sizing = []
for (let c = 0; c < COLS; c++) sizing.push({type: 'setColWidth', value: {sheetIdx: idx, col: c, width}})
for (let r = 0; r < ROWS; r++) sizing.push({type: 'setRowHeight', value: {sheetIdx: idx, row: r, height}})
await commit(workbook, sizing)
window.setSelection(idx, 0, 0)  // jump to it
```

Frame the region with borders (thin gridlines + a thick outer/box boundary) so
the play area is obvious — see `lights-out`/`minesweeper` for the exact border
payloads.

### A click-to-paint / game loop

Register an `onCanvasInput` handler, consume the events you handle, and repaint
only the cells that changed with `cellStyleUpdate` (+ `cellInput` for text). The
`fuse-beads`, `lights-out` and `minesweeper` crafts are the templates.

### Live validation with formulas (no JS math)

Write `=…` formulas via `cellInput` and let the engine recompute as the user
types — `sudoku` checks row/column/box conflicts entirely with spreadsheet
formulas. Note the **no-array-formula** limit below.

## Gotchas

These are the ones that actually bite. Most were paid for in real debugging.

### Two color formats — fills vs borders/fonts

- **Fills** (`setPatternFill.fgColor`) take a **`{red, green, blue}` object**,
  channels `0–255`.
- **Font & border colors** (`setFontColor`, `setLeftBorderColor`, …) take a
  **string in "standard ARGB": 8 hex digits, no `#`** — `"FF0B0F19"` =
  opaque near-black. A `#RRGGBB` value (7 chars) or a 6-digit hex parses to *no
  color* and the text/border silently doesn't render. (`from_hex_str` in the
  core requires length ≥ 8, `AARRGGBB`.)

```ts
setPatternFill: {patternType: 'solid', fgColor: {red: 255, green: 202, blue: 40}} // fill
setFontColor: 'FF1976D2'                                                          // font/border
```

### `handleTransaction` never throws on rejection

It resolves with an `ActionEffect`; a rejected payload sets
`status.type === 'err'` (and `version` stays `0`). Check it or failures pass
silently:

```ts
const r = await workbook.handleTransaction({transaction: {payloads, undoable: false, temp: false}})
if (r?.status?.type === 'err') throw new Error('transaction rejected')
```

### No dynamic arrays / array formulas

The engine has a rich scalar function set (`COUNTIF`, `SUMPRODUCT`, `LARGE`,
`RANK`, `INDEX`/`MATCH`, `VLOOKUP`, `MOD`, `IF`, `RAND`, …) but **no spilling and
no array criteria**: `COUNTIF(range, range)` returns `#UNKNOWN!`. Every formula
must reduce to one scalar per cell — lay out helper columns and reduce them
(e.g. sum nine scalar `COUNTIF(range, d)` terms instead of one array formula).

### Don't delete the sheet the user is looking at

Deleting the currently-displayed sheet crashes the canvas (it tries to render a
gone sheet). If you rebuild a board, either **switch the view to another sheet
first** (`setSelection(0, …)`, yield a frame) then delete/recreate, or better —
**reuse the sheet and just clear its cells** between rounds.

### Register in `crafts.config.json`, nowhere else

A craft ships iff it's in the `registry` in `crafts.config.json` (and in the
chosen distribution's craft set — `"all"` includes every registry entry). The
panel list (webpack `DefinePlugin`) and the published `dist/` set
(`publish-crafts.sh` via `scripts/craft-dist.mjs`) both derive from it, so they
can't drift. Forgetting to register means the craft simply won't appear —
there's no longer a two-list-out-of-sync 404 trap.

### Host APIs arrive asynchronously

`window.workbook`, `window.onCanvasInput`, etc. are injected on iframe load and
re-injected on selection changes. Poll for them before first use (the
`whenReady` helper above) rather than touching them at module top level.

## Dev workflow

```bash
yarn workspace <name> build   # rebuild the craft → copies to public/<name>/
```

- After a **craft** change: rebuild, then reload the iframe (re-select the craft
  in the panel, or reload the page).
- After editing **`craft-panel/index.tsx`** (e.g. adding to `tools`): the dev
  server recompiles; reload the page. A fresh dev-server start guarantees a
  clean compile if HMR gets confused.
- If your craft needs a change in the Rust core or the engine, that's a bigger
  chain (`yarn wasm` → rebuild `logisheets-web` → rebuild the engine) — out of
  scope here.

## Distributions (shipping a subset of crafts)

`crafts.config.json` also defines **distributions** — named build targets that
select which crafts ship, plus the desktop product name / bundle id / window
title:

```json
"distributions": {
  "default": { "productName": "LogiSheets", "identifier": "com.logisheets.desktop",
               "defaultCraft": "factory-simulator-en", "crafts": "all" },
  "games":   { "productName": "LogiSheets 小游戏", "identifier": "com.logisheets.games",
               "windowTitle": "LogiSheets 小游戏", "defaultCraft": "sudoku",
               "crafts": ["factory-simulator-zh", "fuse-beads", "sudoku", "minesweeper"] }
}
```

Pick one at build time with the `CRAFT_DIST` env var (default: `default`):

```bash
CRAFT_DIST=games yarn build     # or: yarn build:games
```

Everything downstream honors it:

- **webpack** injects that distribution's craft list into the panel
  (`resolveCraftTools` → `DefinePlugin` → `__CRAFT_TOOLS__` / `__DEFAULT_CRAFT__`).
- **`publish-crafts.sh`** ships only that set to `dist/` (via
  `scripts/craft-dist.mjs crafts`), pruning others.
- **The desktop build** (`.github/workflows/desktop.yaml`, `workflow_dispatch`
  input `distribution`) builds `dist/` with `CRAFT_DIST` set, then
  `tauri build -c "$(node scripts/craft-dist.mjs tauri)"` applies the product
  name / id / title. Artifacts are named `logisheets-desktop-<distribution>-<os>`.

Add a distribution = add an entry here. Nothing else to touch.

## Learn from the built-in crafts

| Craft | What to copy from it |
| --- | --- |
| `fuse-beads` | canvas painting via `onCanvasInput`, fills, palette UI |
| `lights-out` | smallest full game: own sheet, borders, `craftState` |
| `memory-grid` / `minesweeper` | game loop, timers, per-cell repaint, difficulty |
| `sudoku` | formula-driven validation (`cellInput` of `=…`), no interception |
| `markdown-table-extractor` | selection-driven writes with builders |
| `what-if-calculator` | temp transactions + `setCellLayouts` overlays |
```
