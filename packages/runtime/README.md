# logisheets-runtime

A **headless LogiSheets spreadsheet runtime for Node** — the Node counterpart of
the browser app. It wires the engine-neutral logic in
[`logisheets-core`](https://www.npmjs.com/package/logisheets-core) to the Node
WASM engine, so you can read, manipulate, and write real `.xlsx` files on the
server with no browser and no UI.

A single `SpreadsheetRuntime` owns many open workbooks at once; every operation
runs against a specific `Workbook` handle. All workbook logic comes from
`logisheets-core`'s `WorkbookOps` — the runtime only adapts the synchronous Node
`handle()` entry point into the async `Client` that layer expects.

## Installation

```bash
npm install logisheets-runtime
```

It pulls in `logisheets` (the Node WASM engine) and `logisheets-core`. ESM-only;
requires a recent Node with WASM support.

## Quick start

```ts
import {SpreadsheetRuntime} from 'logisheets-runtime'

const rt = new SpreadsheetRuntime()

// Open workbooks from disk, from bytes, or create empty ones.
const wb1 = await rt.loadWorkbook('a.xlsx')
const wb2 = rt.createWorkbook()

// Drive edits through the shared core operation layer.
await wb1.ops.inputCell(0, 0, 0, 'Hello')   // sheet 0, cell A1
await wb1.ops.createSheet(1, 'Summary')

// Read evaluated values straight off the handle.
const v = wb1.getValue(0, 0, 0)

// Undo / redo history is per workbook.
await wb1.undo()
await wb1.redo()

// Release engine resources when done.
rt.close(wb1)
rt.closeAll()
```

## `SpreadsheetRuntime`

| Member | Description |
|--------|-------------|
| `createWorkbook()` | Create a new empty workbook |
| `loadWorkbook(path)` | Load a `.xlsx` from disk (dedups by absolute path) |
| `loadWorkbookFromBytes(bytes, name, path?)` | Load a `.xlsx` from raw bytes in memory |
| `workbooks` | All currently open workbooks |
| `close(wb)` / `closeAll()` | Release engine resources |

## `Workbook`

Obtain one from the runtime, then run every operation against it so the target
workbook is always explicit.

| Member | Description |
|--------|-------------|
| `id` | The workbook's engine id |
| `ops` | The shared `WorkbookOps` (cell input, sheets, blocks, styles, …) bound to this workbook |
| `client` | Raw async `Client` — escape hatch for engine calls not yet on `ops` |
| `getValue(sheetIdx, row, col)` | Read a single evaluated cell value |
| `undo()` / `redo()` | Step the history; returns whether anything changed |
| `cleanHistory()` | Drop history, keeping current state as baseline |
| `discardChanges()` | Revert every change back to the current baseline |

## Beyond a single process

Everything below is exported from the top-level `logisheets-runtime` entry
(alongside the full re-exported `logisheets-core` surface), so you import it all
from one place:

- **RPC** — a JSON-RPC server for issuing operations against the runtime.
- **Crafts** — headlessly reconstruct the crafts a workbook depends on.
- **Watcher** — hot-(re)load workbooks from `wb_*.json` descriptors.
- **Enterprise** — register with the control panel and pull crafts from the enterprise registry.

## License

MIT — part of the [LogiSheets](https://github.com/logisky/LogiSheets) project.
