# data-gateway

A craft that gates external RPC access to a workbook. It ships **two faces**
around one shared state schema:

- an **authoring UI** (browser iframe) where a user declares the gateway, and
- a **headless runtime** the Node `logisheets-runtime` loads to enforce it.

The declaration rides the workbook's AppData side channel (opaque JSON keyed by
craft id — see `logisheets-core`'s `craft/state.ts`), so it round-trips with the
`.xlsx` and needs no code shipped inside the file.

## State schema (`src/state.ts`)

The single source of truth both faces share:

```ts
type DataGatewayState = {
  version: 1
  inputBlocks: string[]   // blocks (by refName) an RPC request may WRITE
  outputBlocks: string[]  // blocks (by refName) an RPC request may READ
  validations: {          // per-cell rules, keyed by stable (sheetId, cellId)
    sheetId: number
    cellId: CellId
    formula: string       // Excel boolean expr, no leading '='; use #PLACEHOLDER
  }[]                      // to self-reference the cell, e.g. "#PLACEHOLDER>0"
}
```

Blocks are referenced by their stable `refName`; validation targets by the
engine's stable `(sheetId, CellId)`. The formula self-references the cell with
`#PLACEHOLDER` (engine-native), **not** a literal `A1` — so both the binding
(cellId) and the reference (#PLACEHOLDER) track the cell after rows/cols are
inserted or deleted. `parseState` is tolerant — malformed input degrades to
"no gateway".

## Authoring UI (`src/ui.ts`, `index.ts`, `index.html`)

Runs in the craft iframe using the host-injected globals (`window.selection`,
`window.workbook`, `window.getCraftState` / `window.setCraftState`). `mount()`
renders:

- a block list (from `workbook.getAllBlocks()`) with **input** / **output**
  toggles per block, and
- a validation editor — the app's CodeMirror formula editor
  (`logisheets-formula-editor/core`: autocomplete, signature help, cell-ref
  highlighting) — that turns the current cell selection into a rule.

Every edit is serialized straight back via `setCraftState`. Bundled to UMD
(global `DataGateway`, CodeMirror included) by `vite.config.ts`.

## Runtime (`src/runtime.ts`)

Implements `logisheets-core`'s `CraftRuntime` (default export). The host drives
it around each JSON-RPC exchange:

| hook         | when                                   | does |
|--------------|----------------------------------------|------|
| `onLoad`     | workbook opened                        | resolves each rule's cellId → coord once, installs its validation shadow, and **caches the shadow id** `setValidationRule` returns; records the allowed block sets |
| `onRequest`  | a request's inputs are about to apply  | rejects the request if it declares a block outside the allowed sets (`params.dataGateway.{readBlocks,writeBlocks}`) |
| `onValidate` | inputs are in place, before response   | reads the verdicts straight back by the cached shadow ids in one batch (`ops.checkValidationShadows`, `#PLACEHOLDER`-aware) — no re-parse, no re-resolve — and returns the violating cells |
| `onResponse` | response about to be returned          | hook for future output reads |

Bundled to ESM (`data-gateway.runtime.js`, core/web left external) by
`vite.runtime.config.ts`. `manifest.json` points the registry at it.

## Wiring into the RPC boundary

`onValidate` is the new checkpoint on `CraftRuntime`. The runtime exposes
helpers (`packages/runtime/src/craft.ts`) a host calls around a mutation:

```ts
const loaded = await loadCrafts(wb, registry)          // once, on load
// per request, inside your RpcServer.registerMutation body:
const reject = await applyCraftRequest(loaded, req, wb) // apply inputs
if (reject.length) throw new RpcError(...)              // block declaration violated
/* ...write the request's inputs into the workbook... */
const bad = await validateLoadedCrafts(loaded, wb)      // THE validation gate
if (bad.length) throw new RpcError(...)                 // roll back, don't read a response
/* ...read the response... */
await applyCraftResponse(loaded, resp, wb)
```

## Build

```bash
yarn build   # web UMD + runtime ESM, then copy both + manifest to public/
```
