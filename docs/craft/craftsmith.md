---
description: "Give a craft AI tools with craftsmith — annotate your craft's functions and let the built-in Watson assistant discover and call them. One implementation powers both your UI and the AI."
---

# Give a craft AI tools (craftsmith)

A [craft](./writing-a-craft.md) already drives the spreadsheet from its own UI.
**craftsmith** lets that same craft expose **tools** to **Watson**, the built-in
AI assistant — so a user can just ask ("solve this", "start a hard game", "fill
the budget") and Watson calls your craft's functions.

The core idea: **you write the function once.** The exact function your button
calls is the function Watson calls. No second "tool layer", no duplicated logic.

`craftsmith` is a small CLI (`npm i -D logisheets-craftsmith`). It reads your
craft's `tools.ts` with the TypeScript type checker and generates a
**capability manifest** — the contract Watson reads to discover your craft and
invoke it. The manifest is generated from your code, so it can never drift.

## Quick start

```bash
npx craftsmith new my-craft
cd my-craft
npm install
npx craftsmith check .     # validate the tool contract (no writes)
npx craftsmith build .     # compile → dist/ (tools.js, manifest.json, index.html)
```

The scaffold is self-documenting — open `tools.ts`, it walks you through every
annotation. Layout:

```
my-craft/
├── package.json     # identity: craftId, label, version (+ check/build scripts)
├── tools.ts         # the functions you expose (pure) — annotated
├── index.html       # your craft UI (optional — omit for a tools-only craft)
└── tsconfig.json
```

## Writing a tool

A tool is a plain **exported function** whose **first parameter is `ctx`** (the
host-injected context — never seen by the model). Everything after `ctx` becomes
the tool's input, inferred from the TypeScript types.

```ts
import type {SkillCtx} from 'logisheets-craftsmith/authoring'

/**
 * @logicianSkill What-if analysis: preview how changing a cell ripples through
 *   the sheet. Use when the user asks "what happens if this cell were X?".
 * @guidance Preview is temporary; only apply once the user confirms.
 */

/**
 * @tool Preview how changing one cell would ripple through dependent cells.
 * @param sheetIdx Zero-based sheet index.
 * @param row Zero-based row.
 * @param col Zero-based column.
 * @param newValue The value or formula to try.
 * @mutates temp
 * @confirm never
 */
export async function previewWhatIf(
    ctx: SkillCtx,
    sheetIdx: number,
    row: number,
    col: number,
    newValue: string
): Promise<{changed: number}> {
    // ...use ctx.workbook to compute the deltas...
    return {changed: 0}
}
```

### The annotations

| Annotation | Where | Meaning |
| --- | --- | --- |
| `@logicianSkill <text>` | once, top of file | What this craft is for and **when** Watson should use it. This is the line Watson sees when browsing installed crafts. |
| `@guidance <text>` | once, optional | Extra how-to injected when Watson picks this craft (combining tools, gotchas). |
| `@tool <text>` | each exported fn | Makes the function a callable tool. The text tells the model when to call it. |
| `@param name <text>` | per argument | Describes an argument (shown to the model). |
| `@mutates none\|temp\|true` | per tool | Does it change the sheet? Default `none`. |
| `@confirm never\|once\|always\|destructive` | per tool | Ask the user before running? Default `never` (writes default to asking). |

### Signature rules

`craftsmith` infers the input schema from the real signature, so:

- **Named export only** — `export function foo` / `export const foo = …`. No
  anonymous `export default` (there'd be no stable name to dispatch to).
- **First parameter is `ctx`** — named `ctx` or typed `*Ctx` / `*Context`. It is
  excluded from the tool's input.
- **JSON-serializable parameter/return types** — `string`, `number`, `boolean`,
  **string-literal unions** (→ an `enum` the model must choose from), arrays, and
  plain object shapes of those. Anything the checker can't serialize is a
  `craftsmith check` error telling you to simplify it.
- **Pure / ambient-free** — no `window`, `document`, or top-level side effects.
  That's what lets the same function serve your UI, Watson, and tests.
  `craftsmith check` lints for this.

## The context (`ctx`)

Every tool receives a `SkillCtx` as its first argument:

```ts
interface SkillCtx {
    workbook: /* the live LogiSheets client — read + write */
    signal: AbortSignal                 // fires if the user cancels the turn
    confirm(msg, detail?): Promise<boolean>
    log(msg): void                      // write a line into the chat transcript
    craftState?: {get(): string | undefined; set(json: string): void}
}
```

- **`ctx.workbook`** — the same client the app uses: `getCell`, `getCells`,
  `getAllSheetInfo`, `getCellInfos`, … and `handleTransaction`. See the
  [host API](./writing-a-craft.md#the-host-api).
- **`ctx.craftState`** — scoped read/write of *this craft's* saved JSON. Use it
  **only for state that isn't already in the sheet** (a preference, a hidden
  config). If your state is rendered into cells, read it back from
  `ctx.workbook` instead — the sheet is the source of truth.

## Read-then-write safely

If a tool reads state, computes, then writes, a user could change the sheet in
between — and your write would clobber their edit. Use the workbook's
**version** to detect it. `ctx.workbook.getVersion()` returns a number that bumps
on every committed write (a user click, an AI edit, undo/redo — but never on a
read):

```ts
export async function solve(ctx: SkillCtx): Promise<{ok: boolean}> {
    for (let attempt = 0; attempt < 4; attempt++) {
        const v0 = await ctx.workbook.getVersion()
        const board = await readBoard(ctx.workbook)   // your read
        const result = compute(board)                  // pure
        if ((await ctx.workbook.getVersion()) !== v0) continue // changed → retry
        await write(ctx.workbook, result)
        return {ok: true}
    }
    return {ok: false}
}
```

Snapshot before the read, re-check before the write, retry if it moved. (The
engine has no compare-and-swap, so this optimistic check is the right tool.)

## How Watson uses your craft

Watson discovers crafts progressively, so its tool list stays small no matter how
many are installed:

1. **discover** — Watson lists installed crafts and each one's `@logicianSkill`
   line, and picks the one that fits the request.
2. **use** — it loads that craft's tools (and injects your `@guidance`).
3. **invoke** — it calls a tool; `craftsmith` dispatch runs your function with a
   `ctx` whose `workbook` is permission-scoped to your craft.

A **UI-only craft** (no `tools.ts`) still works as before — it just contributes
no tools. A **tools-only craft** (no `index.html`) is fine too.

## The manifest

`craftsmith build` writes `dist/manifest.json` — the contract Watson reads:

```jsonc
{
  "craftId": "what-if",
  "label": "What-if Calculator",
  "url": "index.html",           // present if you have a UI
  "skill": { "description": "…", "guidance": "…" },
  "tools": [
    { "name": "preview_what_if", "description": "…",
      "inputSchema": { /* from your types */ },
      "paramOrder": ["sheetIdx","row","col","newValue"],
      "entry": "tools.js", "export": "previewWhatIf",
      "mutates": "temp", "confirmation": "never" }
  ]
}
```

It is a **generated build artifact** — never hand-edit it. Run `craftsmith check`
in CI to guarantee it matches your code. The built `tools.js` is
**self-contained** (its dependencies are bundled in) so the host can load it with
a plain dynamic `import()`.

## Commands

```bash
craftsmith new <name>   # scaffold a new craft
craftsmith check [dir]  # validate the tool contract + purity (no writes)
craftsmith build [dir]  # compile tools.ts/runtime.ts → dist/ + manifest.json
craftsmith pack  [dir]  # tar the built dist/ into a shippable package
```

`[dir]` defaults to the current directory.

## Publishing

The built `dist/` (manifest + `tools.js` + optional `index.html`) is the
shippable unit. Watson finds installed crafts the way an editor finds
extensions: from a per-device installed set, reading each craft's
`manifest.json`. Publish your package, and once it's installed the host lists it
and Watson can use it — **no change to the host required**.

## Gotchas

- **`handleTransaction` never throws on rejection.** It resolves with an
  `ActionEffect` whose `status.type === 'err'`. Check it if failure matters.
- **Read state from the sheet when it lives there.** Don't cache the board in
  `craftState` if it's already rendered as cell values or fills — read it from
  `ctx.workbook` so you never go stale.
- **Descriptions are for the model.** Write `@logicianSkill` and `@tool` text as
  "what and when", not implementation notes — that's how Watson decides to call
  you.

## See also

- [Writing a craft](./writing-a-craft.md) — the host API and craft basics.
- [Extend with crafts](./craft.md) — what crafts are and how they load.
