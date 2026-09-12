---
description: logisheets-runtime keeps workbooks open on a server — the real LogiSheets engine headless on Node, many live documents per process, a JSON-RPC server you define the methods of, and crafts running server-side.
---

# Run workbooks on a server

Most spreadsheet libraries treat a file as something you pick up, change, and
put down. `logisheets-runtime` treats a workbook as something that **stays
open**.

A runtime is a process that holds live workbooks in memory. Your backend code, a
scheduled job, or an HTTP caller operates on them by handle; formulas
recalculate as they go; and the document is written back to `.xlsx` only when
you decide to save. One process can hold many workbooks at once.

```bash
npm install logisheets-runtime
```

```ts
import {SpreadsheetRuntime, RpcServer} from 'logisheets-runtime'
```

## Is this the thing you want?

| You want to… | Use |
| --- | --- |
| Read a file, change it, write it back | the **[SDK](/usage)** (`logisheets` on Node) |
| Show a grid to a user | the **[engine](/engine)** in a browser |
| Keep documents open and let things operate on them | **this** |

The dividing line is whether the workbook has a lifetime longer than one
function call. If it does — because several requests build it up, because you
want to answer questions against it without re-parsing the file each time, or
because a person and a job are both touching it — you want a runtime.

## What it gives you

- **The real engine, headless.** The same Rust → WASM core and the same
  operation layer (`WorkbookOps`: `inputCell`, number formats, validations,
  fills, …) the browser app drives, running on Node with no browser, canvas or
  Web Worker. Identical behaviour, no UI.
- **Many workbooks, one process.** A single `SpreadsheetRuntime` owns any number
  of open workbooks (`wb1`, `wb2`, …) and every call targets a handle, so one
  server can serve many documents.
- **A workbook as a service.** The built-in `RpcServer` (JSON-RPC 2.0 over HTTP,
  dependency-free) lets you expose *your own* methods whose bodies read and
  write the hosted workbooks — with a per-request **save / roll-back**, so a
  caller can ask a throwaway "what-if" question and leave the document
  untouched.
- **Workbooks that carry their own rules.** A [craft](/craft/craft) can travel
  inside a workbook and be reconstructed here, so the document guards its own
  edits even with no UI in sight. See [Crafts in a runtime](#crafts-in-a-runtime).

Typical uses: server-side recalculation, `.xlsx` batch processing, validation
services, scheduled jobs, tests, and serverless functions.

## Quick start

```ts
import {SpreadsheetRuntime} from 'logisheets-runtime'

const runtime = new SpreadsheetRuntime()
const wb = runtime.createWorkbook()

await wb.ops.inputCell(0, 0, 0, '10') // A1 = 10     (value)
await wb.ops.inputCell(0, 0, 1, '=A1*2') // B1 = =A1*2  (formula)

wb.getValue(0, 0, 1) // → { type: 'number', value: 20 }

await wb.ops.inputCell(0, 0, 0, '21') // change A1
wb.getValue(0, 0, 1) // → { type: 'number', value: 42 }  (recalculated)

runtime.closeAll()
```

Cells are 0-indexed `(sheetIdx, row, col)`: `A1 = (0, 0, 0)`, `B1 = (0, 0, 1)`.

## `SpreadsheetRuntime`

The container for every open workbook in a Node process. Create one per process.

| Method | Signature | Description |
| --- | --- | --- |
| constructor | `new SpreadsheetRuntime()` | Create the runtime. The Node WASM engine loads lazily on first use. |
| `createWorkbook` | `(): Workbook` | Create a new, empty workbook. |
| `loadWorkbook` | `(path: string): Promise<Workbook>` | Load a `.xlsx` from disk. Loading the same path twice returns the already-open workbook (until you `close` it). |
| `loadWorkbookFromBytes` | `(content: Uint8Array, name: string, path?: string): Workbook` | Load a workbook from `.xlsx` bytes already in memory. |
| `workbooks` | `readonly Workbook[]` | Every workbook currently open in this runtime. |
| `close` | `(wb: Workbook): void` | Close one workbook, releasing its engine resources. |
| `closeAll` | `(): void` | Close every open workbook. |

## `Workbook`

A single live workbook in the engine. Obtain one from the runtime — never
construct it directly.

| Member | Signature | Description |
| --- | --- | --- |
| `id` | `number` | The workbook's engine id (unique across the process). |
| `ops` | `WorkbookOps` | The shared, engine-neutral operation layer, bound to this workbook — the **same** API the browser app uses (see [the SDK guide](/usage#editing-transactions-and-payloads)). |
| `client` | `Client` | Escape hatch: the raw async engine client (every `WorkbookMethods` call), for operations `ops` doesn't cover yet. |
| `path` | `string \| undefined` | Absolute path this workbook was loaded from, if any. |
| `getValue` | `(sheetIdx, row, col): Value` | Read a cell's **evaluated** value (a formula cell returns its computed result). |
| `undo` / `redo` | `(): Promise<boolean>` | Undo / redo the last transaction; resolves whether anything happened. |
| `cleanHistory` | `(): Promise<void>` | Drop the undo/redo history, keeping current state as the baseline. |
| `discardChanges` | `(): Promise<void>` | Revert every change still on the undo stack back to the baseline. |

`Value` is the engine's tagged value:

```ts
type Value =
    | {type: 'str'; value: string}
    | {type: 'bool'; value: boolean}
    | {type: 'number'; value: number}
    | {type: 'error'; value: string}
    | 'empty'
```

::: tip Same operations as the browser
`wb.ops` is `logisheets-core`'s `WorkbookOps` — the identical, UI-free logic the
web app drives the engine with (`inputCell`, `setNumFmt`, `setValidationRule`,
`checkValidations`, `checkFieldConstraints`, fills, block ops, …). Anything the
browser can do to a workbook, the runtime can do the same way.
:::

## Hosting workbooks — `RpcServer`

`RpcServer` is a dependency-free JSON-RPC 2.0 server over HTTP. It owns the wire
protocol; **you** define the methods, whose bodies read/write workbooks through
the injected runtime.

| Member | Signature | Description |
| --- | --- | --- |
| constructor | `new RpcServer(runtime)` | Bind a server to a runtime; all methods share its open workbooks. |
| `register` | `(method, handler): this` | Register a plain method `(params, ctx) => result`. Chainable. |
| `registerMutation` | `(method, target, run, options?): this` | Register a *mutating* method with a save lifecycle (below). |
| `has` | `(method): boolean` | Whether a method name is registered. |
| `listen` | `(port, host?): Promise<AddressInfo>` | Start listening (defaults to `127.0.0.1`; use port `0` for an ephemeral port). |
| `close` | `(): Promise<void>` | Stop listening (does not close the runtime's workbooks). |

Each handler receives an `RpcContext` — `{runtime, request}` — and may throw
`RpcError(code, message, data?)` to return a structured JSON-RPC error.

```ts
const runtime = new SpreadsheetRuntime()
const server = new RpcServer(runtime)

server
    .register('newWorkbook', (_p, {runtime}) => ({id: runtime.createWorkbook().id}))
    .register('getCell', (p, {runtime}) => {
        const wb = runtime.workbooks.find((w) => w.id === p.id)
        if (!wb) throw new RpcError(RPC_INVALID_PARAMS, `no workbook ${p.id}`)
        return wb.getValue(0, p.row, p.col)
    })

const addr = await server.listen(0)
// POST JSON-RPC 2.0 to http://127.0.0.1:${addr.port}
```

### Mutations and the save lifecycle

`registerMutation` wraps a method body so each request is safe and stateless
about history. For every call it:

1. resolves the target workbook (the `target` resolver),
2. cleans its history (clean baseline),
3. runs the body,
4. reads the reserved boolean `save` param — if `false`, **rolls back** every
   change the body made,
5. cleans history again.

So callers choose per request whether the change persists (`save: true`,
the default) or is a throwaway **what-if** (`save: false`), and the workbook
never accumulates history across requests either way.

```ts
server.registerMutation(
    'evalWith',
    (p, {runtime}) => runtime.workbooks.find((w) => w.id === p.id)!,
    async (wb, p) => {
        await wb.ops.inputCell(0, p.inputRow, p.inputCol, p.content)
        return wb.getValue(0, p.formulaRow, p.formulaCol) // formula result
    }
)
// { ...params, save: false } → computes the result, then reverts the input.
```

Standard JSON-RPC error codes are exported (`RPC_PARSE_ERROR`,
`RPC_INVALID_REQUEST`, `RPC_METHOD_NOT_FOUND`, `RPC_INVALID_PARAMS`,
`RPC_INTERNAL_ERROR`); application errors can use their own positive codes.

## Crafts in a runtime

This one is easy to misread, so start with what it is **not**.

Crafts do not add methods to the runtime. What the runtime offers is whatever
you registered on `RpcServer` — that and nothing else. A craft has no method
name and cannot be called.

What a craft can do is **sit in the path of an exchange you already defined**.
A workbook carries its crafts in its own saved state; the runtime reconstructs
them headlessly and runs their hooks around a JSON-RPC request. So the document
brings its rules with it: open the same `.xlsx` on a server with no UI, and the
guards that were protecting it in the browser are still protecting it.

**Crafts govern exchanges. They do not define them.**

### The four hooks

A headless craft is a `runtime.ts` whose default export implements
`CraftRuntime`:

```ts
import type {CraftRuntime} from 'logisheets-craftsmith/authoring'

export default {
    onLoad: (state, wb) => { /* install shadows, cache what you need */ },
    onRequest: (req, state, wb) => { /* inspect, and object to reject */ },
    onValidate: (state, wb) => { /* return Violation[] */ },   // optional
    onResponse: (resp, state, wb) => { /* observe the result */ },
} satisfies CraftRuntime
```

Each hook gets its own deserialized state and the live `Workbook` — so
`wb.ops` and `wb.client` are both in reach. `onValidate` is the only optional
one.

`runCraftExchange` composes them in order, and each failure maps to a JSON-RPC
error:

| Stage | On failure |
| --- | --- |
| `onRequest` objects | `-32602` (invalid params) |
| `onValidate` returns violations | `1001` (`RPC_VALIDATION_FAILED`), violations in `error.data` |
| `onResponse` errors | `-32603` (internal error) |

### Loading them

Craft ids come from the workbook, not from your configuration:

```ts
import {loadCrafts, MemoryCraftRegistry, runCraftExchange} from 'logisheets-runtime'

const registry = new MemoryCraftRegistry()
registry.add('my-guard', await import('./my-guard/runtime.js'))

const crafts = await loadCrafts(wb, registry)     // reads the workbook's own state
const reply = await runCraftExchange(crafts, wb, request)
```

`loadCrafts` reads the workbook's AppData for the craft ids it was saved with,
asks the registry for each manifest, and skips any craft whose manifest has no
`rtJs` — that field is what marks a craft as having a headless face. A workbook
saved without crafts loads none, which is the common case.

Loading is fault-isolated: a craft that fails to import or fails `onLoad` is
skipped rather than taking the others down. It is also silent, so if a craft
you expected is not running, check the manifest's `rtJs` first.

### Status

Worth knowing before you build on this:

- **Nothing loads crafts for you.** `SpreadsheetRuntime`, `RpcServer` and
  `WorkbookWatcher` have no craft awareness — you call `loadCrafts` and
  `runCraftExchange` yourself, as above. The one exception is
  `EnterpriseRuntimeServer`, which wires them into a single `compute` task.
- **No craft in this repo ships a runtime face yet.** The mechanism is
  implemented and tested against the real engine, but you will be writing the
  first `runtime.ts` rather than copying one.
- **`craftsmith check` does not validate `runtime.ts`.** It is bundled
  unexamined, so a default export that does not satisfy `CraftRuntime` fails
  silently at load time instead of at build time.
- **`HttpCraftRegistry` is best-effort.** It imports a craft over HTTP via a
  `data:` URL, which works for self-contained ESM bundles and not for ones with
  external dependencies.

## Hot-reloading workbooks — `WorkbookWatcher`

`WorkbookWatcher` polls a directory for **descriptor files** named `wb_*.json`
and keeps the runtime's workbooks in sync with them. Each descriptor names a
workbook by a stable *string* id (the watcher's own namespace, distinct from the
engine's numeric `Workbook.id`), a version, and where to fetch its `.xlsx` — a
local `path`, a `url`, or both:

```json
{"id": "sales-2026", "version": 7, "path": "books/sales.xlsx"}
{"id": "sales-2026", "version": 7, "url": "https://host/books/sales.xlsx"}
```

At least one of `path`/`url` must be present; when both are, `path` wins (local
reads are cheaper). Relative `path`s resolve against the watched directory; a
`url` is fetched with `fetch`. A url-sourced workbook records no local `path` on
its handle.

On each pass (every 10s by default) the watcher (re)loads any descriptor whose
version differs from what it last loaded and swaps the new workbook in under that
id — so an external system can publish a new revision by writing the file with a
bumped version, and the running runtime picks it up automatically. A reload
always reads the source fresh (bypassing `loadWorkbook`'s path dedup) so a
same-source, new-version write is honoured; the previous workbook is released
only after the new one loads, so a failed load (bad json, missing file, non-200
url) leaves the old one in place and is reported via `onError`.

| Member | Signature | Description |
| --- | --- | --- |
| constructor | `new WorkbookWatcher(runtime, dir, options?)` | Watch `dir` for `wb_*.json` descriptors, loading into `runtime`. |
| `start` | `(): void` | Scan once now, then every `intervalMs`. The interval is `unref`'d so it never keeps the process alive alone. |
| `stop` | `(): void` | Stop polling (loaded workbooks stay open). |
| `scanOnce` | `(): Promise<void>` | Run a single scan pass now (also called by the interval). Overlapping calls are skipped. |
| `get` | `(id: string): Workbook \| undefined` | The live workbook currently loaded under `id`. |
| `ids` | `readonly string[]` | Every string id currently loaded. |

`options` is `{intervalMs?: number; onLoad?; onError?}` — `onLoad(id, wb,
descriptor)` fires after each swap, `onError(file, err)` reports a descriptor
that couldn't be read, parsed, or loaded.

```ts
const runtime = new SpreadsheetRuntime()
const watcher = new WorkbookWatcher(runtime, './watch', {
    intervalMs: 10_000,
    onLoad: (id) => console.log('loaded', id),
})
watcher.start()
// ... elsewhere, serve the current revision:
const wb = watcher.get('sales-2026')
```

## Relationship to the other packages

| Package | Where it runs | What it is |
| --- | --- | --- |
| [`logisheets-web`](/usage) | Browser | The async SDK over the WASM engine (Web Worker). |
| `logisheets` | Node | The Node WASM engine build (synchronous `handle()`). |
| `logisheets-core` | Anywhere | UI-free logic (`WorkbookOps`) — the engine-neutral operations. |
| [`logisheets-engine`](/engine) | Browser | The rendered, interactive grid UI. |
| **`logisheets-runtime`** | **Node** | **`logisheets-core` wired to the Node engine + a JSON-RPC host.** |

`logisheets-runtime` re-exports everything from `logisheets-core`, so payload
types, builders and the operation layer come from one import.
