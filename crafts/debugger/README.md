# debugger

A dev-only craft: build realistic blocks in one click instead of clicking
through the composer every time you want something to test against.

**Not shipped.** Its registry entry in `crafts.config.json` is marked
`devOnly`, so the craft picker offers it under `vite` (dev) and no production
build has it — see [Dev-only, how](#dev-only-how) below.

## What it does

| Button | What lands |
| --- | --- |
| **Big block** | An *n*-row table (default 200) with a header row and nine fields: `id` (required, unique key) · `region` · `quarter` · `units` · `price` · **`revenue`** (engine-computed, `units × price`) · `active` (boolean) · `updated` (datetime) · `note`. Seeded with deterministic synthetic data. |
| **One column per type** | Eight rows, one column per declarable field type — string, number, boolean, datetime, enum, multiSelect, image — plus the enum set they draw from. The widget-layer fixture. |
| **Add totals row** | An analysis block under the last big block: `SUM` over units, price and revenue. |
| **Seed violations** | Re-binds the schema with `unique_together (region, quarter)` and `unique` on `note`, then breaks both — plus one blank `required`. Three different markers, so you can tell them apart. |
| **List blocks** | Every block on the sheet: id, name, position, size, field names. |
| **Jump to last** | Select the last big block's master cell and pin the viewport to it. |
| **Remove my blocks** | Removes the blocks *this session* created. Blocks you made by hand are left alone. |

Everything lands as one undoable transaction, so ⌘Z reverses a whole fixture.

The generated data is deterministic (a fixed-seed LCG): two runs with the same
row count produce the same table, which is what makes "did my change do that?"
answerable.

## Using it

Crafts are served out of `public/`, which the dev server does not build. So,
once:

```bash
yarn workspace debugger build
```

Then open the craft panel and pick **Debugger (dev)**, or deep-link straight
to it:

```
http://localhost:4200/?craft=/debugger/index.html
```

Editing `src/index.ts` or `index.html` needs that build re-run — there is no
HMR path from `crafts/*/src` into the dev server. Editing
`crafts.config.json` needs the dev server restarted, since Vite reads it once
at config load.

## Dev-only, how

Three files, one flag:

1. `crafts.config.json` — the registry entry carries `"devOnly": true`.
2. `vite.config.ts` — `resolveCraftTools(dev)` admits `devOnly` entries only
   when `command === 'serve'`, so a production bundle's `__CRAFT_TOOLS__` has
   no entry for it. Nothing to hide in the UI, because there is nothing there.
3. `scripts/craft-dist.mjs` — filters `devOnly` out of every distribution's
   craft list while leaving it in `registry`. That combination is what keeps
   the files out of `dist/`: `publish-crafts.sh` prunes every *registry* entry
   from `dist/` and then copies back only the *selected* ones, so the debugger
   is deleted and never restored.

## Notes

- `getSheetDimension` on the injected `window.workbook` takes a **bare** sheet
  index, unlike its neighbours (`getAvailableBlockId`, `getAllBlocks`) which
  take `{sheetIdx}`. Passing the wrong shape fails the request rather than
  being coerced.
- `handleTransaction` **resolves** on failure rather than throwing — it
  returns an `ActionEffect` whose `status.type` is `'err'`. Every call here
  checks it; one that did not would make a rejected fixture look identical to
  a successful one.
- New blocks are placed below the sheet's used range so repeated clicks stack
  instead of overlapping.
- 200 rows is ~1600 payloads and takes a few seconds. Drop the row count if
  you are iterating on something that does not need the depth.
- A duplicate **key** is not among the seeded violations, because it is not a
  violation: the row-key guard refuses that write outright rather than letting
  it land and flagging it, so attempting it just fails the transaction. The
  `unique` marker is what a unique NON-key field raises.
- `fieldRef` / `multiSelectRef` are deliberately absent from the typed block:
  they need a target block to point at, and a ref to a block that does not
  exist is a different bug from the one you would be looking for.
