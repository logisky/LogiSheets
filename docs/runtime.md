# Headless on Node (`logisheets-runtime`)

`logisheets-runtime` is the **server-side counterpart of the browser app**: the
full LogiSheets engine and the exact same operation layer the UI runs, but
headless on Node — no browser, no canvas, no Web Worker. It also ships a tiny
JSON-RPC server so a process can *host* live workbooks and let clients drive
them.

```bash
npm install logisheets-runtime
```

```ts
import {SpreadsheetRuntime, RpcServer} from 'logisheets-runtime'
```

## The problem it solves

LogiSheets has always had two halves that the browser app glues together:

- the **engine** (Rust → WASM) that owns the workbook and recalculates formulas, and
- **`logisheets-core`** — the UI-free operation layer (`WorkbookOps`: `inputCell`,
  number formats, validations, fills, …) that the browser drives the engine with.

In the browser those are wired through an **async** client: every call hops to a
Web Worker over `postMessage`. That wiring is browser-shaped, so taking the same
spreadsheet logic to the server used to mean re-implementing the glue: loading
the Node WASM build, adapting its **synchronous** `handle()` entry point into the
async client `WorkbookOps` expects, juggling per-workbook engine handles, and
hand-rolling a request layer if you wanted to expose any of it.

`logisheets-runtime` is that glue, done once:

- **Run the real engine headlessly.** Create or load workbooks on Node and drive
  them with the *same* `WorkbookOps` the browser uses — identical behavior,
  zero UI. Ideal for server-side recalculation, `.xlsx` batch processing,
  validation, scheduled jobs, tests, and serverless functions.
- **One runtime, many workbooks.** A single `SpreadsheetRuntime` owns any number
  of open workbooks (`wb1`, `wb2`, …); every call targets a specific handle, so
  a process can serve many documents at once.
- **Host workbooks as a service.** The built-in `RpcServer` (JSON-RPC 2.0 over
  HTTP, dependency-free) lets you expose your *own* methods whose bodies
  read/write workbooks — with a per-request **save / roll-back** lifecycle, so a
  call can either persist or compute a throwaway "what-if" and leave the
  document untouched.

In short: the browser embeds LogiSheets for a *user*; the runtime embeds it for
a *server*.

::: tip Runnable example
A complete, runnable example — build a workbook, host it over JSON-RPC, change a
value remotely and read a formula's recalculated number — lives in
[**logisheets-examples / logisheets-runtime**](https://github.com/logisky/logisheets-examples/tree/main/logisheets-runtime).
:::

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
