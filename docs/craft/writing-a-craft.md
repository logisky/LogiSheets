---
description: "Build a LogiSheets craft with the craftsmith CLI — scaffold, write your logic once, give it a browser UI, AI tools (JSDoc), and a headless runtime, then check, build, and publish."
---

# Writing a craft

A [**craft**](./craft.md) is one piece of logic reachable from the browser, a
headless runtime, and AI. **`craftsmith`** is the CLI you use to create, check,
build, and publish one — it scaffolds the project, reads your code with the
TypeScript type checker, and emits a shippable package.

This guide goes end to end: scaffold with craftsmith, write your logic once in
`tools.ts`, then add whichever **faces** you need —
[AI tools](#face-ai-tools-jsdoc) (JSDoc), a [browser UI](#face-a-browser-ui)
(`index.html`), a [headless runtime](#face-a-headless-runtime) (`runtime.ts`) —
and finally [check, build, and publish](#check-build-publish).

## Install & scaffold

```bash
npm i -D logisheets-craftsmith     # the CLI
npx craftsmith new my-craft        # scaffold a project
cd my-craft && npm install
```

`craftsmith new` writes a ready-to-build project:

```
my-craft/
├── package.json     # identity: craftId, label, version (+ check/build scripts)
├── tools.ts         # YOUR LOGIC — pure functions (the core)
├── index.html       # a browser UI (optional)
└── tsconfig.json
```

The file that matters most is **`tools.ts`** — your logic. Everything else is a
thin face over it. `runtime.ts` isn't scaffolded; add it yourself when you want
the [runtime face](#face-a-headless-runtime), and `craftsmith build` picks it up
automatically.

## Identity: `package.json`

Three fields identify your craft:

```json
{
  "craftId": "my-craft",   // stable, kebab-case — the id the host installs under
  "label": "My Craft",     // human name shown in the craft picker
  "version": "0.1.0"
}
```

That's all the host needs. When you publish, it installs your package **by
`craftId`** and reads the generated `manifest.json` — you don't register the
craft anywhere by hand.

## The core: your logic in `tools.ts`

A craft's logic is a set of **plain, exported, pure functions**. "Pure" here
means: takes what it needs through parameters, returns a value, and touches no
`window`, `document`, or globals. That's the property that lets the *same*
function serve your UI, the AI, and a unit test.

Each function's **first parameter is `ctx`** — the host-injected context
(workbook client, etc.). Everything after `ctx` is the function's own input.

```ts
import type {SkillCtx} from 'logisheets-craftsmith/authoring'

export async function writeCell(
    ctx: SkillCtx,
    row: number,
    col: number,
    text: string
): Promise<{written: string}> {
    await ctx.workbook.handleTransaction({
        transaction: {
            payloads: [
                {type: 'cellInput', value: {sheetIdx: 0, row, col, content: text}},
            ],
            undoable: true,
            temp: false,
        },
    })
    return {written: text}
}
```

### The `ctx` object

| Field | What it is |
| --- | --- |
| `ctx.workbook` | The live LogiSheets client — the full read surface (`getCell`, `getCells`, `getAllSheetInfo`, `getCellInfos`, …) plus `handleTransaction`. |
| `ctx.workbook.getVersion()` | A number that bumps on every committed write. Use it for [read-then-write safety](#read-then-write-safely). |
| `ctx.craftState` | Optional `get()` / `set()` for *this craft's* own saved JSON. Only for state **not** already in the sheet. |
| `ctx.confirm(msg)` | Ask the user to approve; resolves `true` if they do. |
| `ctx.log(msg)` | Write a progress line into the chat transcript. |
| `ctx.signal` | An `AbortSignal` that fires if the user cancels the turn. |

::: warning `handleTransaction` never throws on rejection
It resolves with an `ActionEffect` whose `status.type === 'err'` when the engine
rejects the payload. Check it if failure matters. See [Gotchas](#gotchas).
:::

## Face: AI tools (JSDoc)

To expose your functions to **Watson** (the built-in AI assistant), annotate
them with JSDoc. `craftsmith` reads the annotations *and* the TypeScript
signature to generate the capability manifest — so it can never drift from your
code. There are no runtime decorators; it's all plain comments.

### The annotations

Two levels: one **skill** block at the top of the file (what the craft is for),
and one **`@tool`** block per exported function.

```ts
import type {SkillCtx} from 'logisheets-craftsmith/authoring'

/**
 * @logicianSkill Budget helper: fills and balances a monthly budget. Use when
 *   the user asks to set up, fill, or rebalance a budget.
 * @guidance Call count_sheets first if you need the sheet count.
 */

/**
 * @tool Write text into a cell on the first sheet.
 * @param row  Zero-based row index.
 * @param col  Zero-based column index.
 * @param text The text to write.
 * @mutates true
 * @confirm always
 */
export async function writeCell(
    ctx: SkillCtx,
    row: number,
    col: number,
    text: string
): Promise<{written: string}> {
    /* … */
    return {written: text}
}

/**
 * A read-only tool — keep the defaults (@mutates none, @confirm never).
 * @tool Report how many sheets the workbook has.
 */
export async function countSheets(ctx: SkillCtx): Promise<{sheets: number}> {
    const infos = (await ctx.workbook.getAllSheetInfo()) as unknown[]
    return {sheets: infos.length}
}
```

| Annotation | Where | Meaning |
| --- | --- | --- |
| `@logicianSkill <text>` | once, top of file | What the craft is for and **when** Watson should use it. This is the line Watson sees when browsing installed crafts. |
| `@guidance <text>` | once, optional | Extra how-to injected when Watson picks this craft (combining tools, gotchas). |
| `@tool <text>` | each exported fn | Makes the function a callable tool. The text tells the model *when* to call it. |
| `@param name <text>` | per argument | Describes an argument (shown to the model). |
| `@mutates none\|temp\|true` | per tool | Does it change the sheet? Default `none`. |
| `@confirm never\|once\|always\|destructive` | per tool | Ask the user before running? Default `never`. |

::: tip Descriptions are for the model
Write `@logicianSkill` and `@tool` text as **"what and when"**, not
implementation notes — that phrasing is exactly how Watson decides whether to
reach for your craft and which tool to call.
:::

### Signature rules

`craftsmith` infers the input schema from the real signature, so it enforces:

- **Named export only** — `export function foo` / `export const foo = …`. No
  anonymous `export default` (there'd be no stable name to dispatch to).
- **First parameter is `ctx`** — named `ctx` or typed `*Ctx` / `*Context`. It is
  excluded from the tool's input.
- **JSON-serializable parameter/return types** — `string`, `number`, `boolean`,
  **string-literal unions** (→ an `enum` the model must choose from), arrays, and
  plain object shapes of those. Anything the checker can't serialize is a
  `craftsmith check` error telling you to simplify it.
- **Pure / ambient-free** — no `window`, `document`, or top-level side effects.
  `craftsmith check` lints for this.

### How Watson uses your craft

Watson discovers crafts progressively, so its tool list stays small no matter how
many are installed:

1. **discover** — it lists installed crafts and each one's `@logicianSkill` line,
   and picks the one that fits the request.
2. **use** — it loads that craft's tools (and injects your `@guidance`).
3. **invoke** — it calls a tool; dispatch runs your function with a `ctx` whose
   `workbook` is permission-scoped to your craft.

### Read-then-write safely

If a tool reads state, computes, then writes, the user could change the sheet in
between — and your write would clobber their edit. Snapshot `getVersion()` before
the read, re-check before the write, and retry if it moved:

```ts
export async function solve(ctx: SkillCtx): Promise<{ok: boolean}> {
    for (let attempt = 0; attempt < 4; attempt++) {
        const v0 = await ctx.workbook.getVersion()
        const board = await readBoard(ctx.workbook)         // your read
        const result = compute(board)                        // pure
        if ((await ctx.workbook.getVersion()) !== v0) continue // changed → retry
        await write(ctx.workbook, result)
        return {ok: true}
    }
    return {ok: false}
}
```

(The engine has no compare-and-swap, so this optimistic check is the right tool.)

## Face: a browser UI

An `index.html` gives your craft a UI in the craft panel. It's loaded in a
same-origin `<iframe>`; **after** it loads, the host injects `window.workbook`
and friends onto it. Your page imports the built `./tools.js` and calls the
**same** functions Watson calls.

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>My Craft</title></head>
<body>
  <button id="go" type="button" disabled>Write into A1</button>
  <script type="module">
    import {writeCell} from './tools.js'

    // Host APIs arrive asynchronously — poll for window.workbook before use.
    function whenReady(cb) {
      let n = 0
      ;(function loop() {
        if (window.workbook) return cb()
        if (n++ > 600) return console.warn('host APIs never arrived')
        setTimeout(loop, 50)
      })()
    }

    // Build the same ctx shape Watson passes to your tools.
    const ctx = () => ({
      workbook: window.workbook,
      signal: new AbortController().signal,
      confirm: async () => true,
      log: (m) => console.log('[my-craft]', m),
    })

    const btn = document.getElementById('go')
    btn.addEventListener('click', () => {
      writeCell(ctx(), 0, 0, 'Hello from a craft 👋')
        .then(() => window.notifyCraft?.('success', 'Done'))
        .catch((e) => window.notifyCraft?.('error', String(e)))
    })
    whenReady(() => { btn.disabled = false })
  </script>
</body>
</html>
```

### Host API (injected on `window`)

Everything below appears **after** the iframe loads — guard with `whenReady`.

- **`window.workbook`** — the same `Client` your tools use: the full read surface
  plus `handleTransaction`. The `EditPayload`s you'll use most:

  | Payload | Shape |
  | --- | --- |
  | write a value/formula | `{type:'cellInput', value:{sheetIdx, row, col, content}}` |
  | style a cell | `{type:'cellStyleUpdate', value:{sheetIdx, row, col, ty}}` |
  | create a sheet | `{type:'createSheet', value:{idx, newName}}` |
  | delete a sheet | `{type:'deleteSheet', value:{idx}}` |
  | set column width | `{type:'setColWidth', value:{sheetIdx, col, width}}` |
  | set row height | `{type:'setRowHeight', value:{sheetIdx, row, height}}` |

- **Selection** — `window.selection` (a `{sheetIdx, data}` snapshot),
  `window.onSelectionChange(cb)` (returns a disposer), `window.setSelection(sheetIdx, row, col)`,
  and `window.setSelectionSuppressed(true)` to hide the highlight (painting/game crafts use this).
- **Canvas input** — `window.onCanvasInput(cb)` intercepts mouse/keyboard on the
  grid **before the engine sees it**. `cb` gets `{type, sheetIdx, row, col, …}`;
  **return `true` to consume** the event, `false`/`undefined` to pass it through.
- **Zoom** — the grid already zooms itself on **Ctrl/⌘ + wheel** and on a
  trackpad pinch, so a craft doesn't need to implement the gesture. Use
  `window.setCanvasZoom(factor)` / `window.getCanvasZoom()` only to drive a
  specific factor (e.g. a "fit the board" button).
- **Persistence** — `window.setCraftState(json)` / `getCraftState()` for
  per-document state the host folds into the saved workbook; `window.craftStorage`
  (async key/value) for device-scoped preferences that persist across documents.
- **Host UI** — `window.notifyCraft('success'|'info'|'warn'|'error', msg)` shows a
  toast; `window.setCellLayouts([...])` overlays markers on cells.

## Face: a headless runtime

A craft can also run **without any UI**. Add a `runtime.ts` that default-exports
a `CraftRuntime` — the host reconstructs it from the workbook's saved state and
calls lifecycle hooks around each JSON-RPC exchange. This is how a craft runs
server-side (the Node runtime, the collaboration server), e.g. as a **validation
gateway** that vets edits before they commit.

The hooks fire in order around one exchange:

| Hook | When | Return |
| --- | --- | --- |
| `onLoad(state, wb)` | once, when the workbook opens | rehydrate from state |
| `onRequest(req, state, wb)` | a request's inputs are about to be applied | reject to block the request |
| `onValidate(state, wb)` | inputs are in place, **before** the response is read | the cells that fail (empty = all good) — optional |
| `onResponse(resp, state, wb)` | the response is about to be returned | inspect / annotate |

Every hook returns a `Result<T>`: a plain value (or `undefined`) on success, or
an `ErrorMessage` (`{msg, ty}`) to reject. A non-empty `onValidate` result tells
the host to reject the request and roll the inputs back.

```ts
// runtime.ts
import type {
    CraftRuntime,
    Violation,
    JsonRpcRequest,
    JsonRpcResponse,
} from 'logisheets-craftsmith/authoring'

// Narrow the craft's persisted state to your own shape.
interface GatewayState {
    statusCol: number
    allowed: string[]
}

export default {
    // Rehydrate when the workbook opens. Nothing to precompute here.
    onLoad(_state: GatewayState, _wb) {
        return
    },

    // Let inputs be applied; we check them in onValidate below.
    onRequest(_req: JsonRpcRequest, _state: GatewayState, _wb) {
        return
    },

    // Inputs are now written — flag any status cell with a disallowed value.
    async onValidate(state: GatewayState, wb) {
        const violations: Violation[] = []
        for (let row = 1; row < 100; row++) {
            const cell: any = await wb.getCell({
                sheetIdx: 0,
                row,
                col: state.statusCol,
            })
            const value = cell?.value?.value
            if (value == null || value === 'empty') continue
            if (!state.allowed.includes(String(value))) {
                violations.push({
                    sheetIdx: 0,
                    row,
                    col: state.statusCol,
                    kind: 'membership',
                    message: `"${value}" is not an allowed status`,
                })
            }
        }
        return violations // empty = accept; non-empty = host rejects & rolls back
    },

    onResponse(_resp: JsonRpcResponse, _state: GatewayState, _wb) {
        return
    },
} satisfies CraftRuntime<GatewayState>
```

`onValidate` is optional — omit it for a runtime that only reacts to requests.
`craftsmith build` compiles `runtime.ts` to `runtime.js` and records it in the
manifest automatically; there's nothing else to wire.

## Check, build, publish

```bash
npx craftsmith check .   # validate the tool contract + purity — no writes
npx craftsmith build .   # compile tools.ts/runtime.ts → dist/ + manifest.json
npx craftsmith pack  .   # tar dist/ into a shippable <craftId>-<version>.tgz
```

`build` produces `dist/`:

```
dist/
├── manifest.json   # the generated contract (see below) — never hand-edit
├── tools.js        # your logic, bundled self-contained (deps included)
├── runtime.js      # present iff you added runtime.ts
└── index.html      # present iff you added a UI
```

The **manifest** is what the host reads to discover and drive your craft. It is a
**generated build artifact** — run `craftsmith check` in CI to guarantee it
matches your code:

```jsonc
{
  "schemaVersion": 1,
  "craftId": "my-craft",
  "version": "0.1.0",
  "label": "My Craft",
  "url": "index.html",           // present iff you have a UI
  "rtJs": "runtime.js",          // present iff you have a runtime
  "skill": { "description": "…", "guidance": "…" },
  "tools": [
    { "name": "write_cell", "description": "…",
      "inputSchema": { /* from your types */ },
      "paramOrder": ["row","col","text"],
      "entry": "tools.js", "export": "writeCell",
      "mutates": true, "confirmation": "always" }
  ]
}
```

**Publishing** is shipping that `dist/`: publish your package to the craft
registry your deployment uses. Once installed, the host lists your craft by
`craftId`, loads `tools.js` for Watson, `index.html` for the panel, and
`runtime.js` for the server — **no change to the host required**.

## Gotchas

These are the ones that actually bite.

### Two color formats — fills vs borders/fonts

- **Fills** (`setPatternFill.fgColor`) take a **`{red, green, blue}` object**,
  channels `0–255`.
- **Font & border colors** (`setFontColor`, `setLeftBorderColor`, …) take a
  **string in "standard ARGB": 8 hex digits, no `#`** — `"FF0B0F19"` is opaque
  near-black. A `#RRGGBB` value or 6-digit hex parses to *no color* and silently
  doesn't render (the core requires `AARRGGBB`, length ≥ 8).

```ts
setPatternFill: {patternType: 'solid', fgColor: {red: 255, green: 202, blue: 40}} // fill
setFontColor: 'FF1976D2'                                                          // font/border
```

### `handleTransaction` never throws on rejection

It resolves with an `ActionEffect`; a rejected payload sets
`status.type === 'err'`. Check it or failures pass silently:

```ts
const r = await workbook.handleTransaction({transaction: {payloads, undoable: false, temp: false}})
if (r?.status?.type === 'err') throw new Error('transaction rejected')
```

### No dynamic arrays / array formulas

The engine has a rich scalar function set (`COUNTIF`, `SUMPRODUCT`, `INDEX`/`MATCH`,
`VLOOKUP`, …) but **no spilling and no array criteria**: every formula must reduce
to one scalar per cell. Lay out helper columns instead of one array formula.

### Don't delete the sheet the user is looking at

Deleting the currently-displayed sheet crashes the canvas. Switch the view to
another sheet first (`setSelection(0, …)`, yield a frame) then delete/recreate —
or better, **reuse the sheet and clear its cells** between rounds.

### Host APIs arrive asynchronously

`window.workbook`, `window.onCanvasInput`, etc. are injected on iframe load. Poll
for them (the `whenReady` helper above) rather than touching them at module top
level.
