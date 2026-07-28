# logisheets-core

UI-free LogiSheets logic — the portable core shared by every host. It holds all
the high-level workbook operations (styling, blocks, fields, validation, crafts,
transactions, permissions) with **no rendering and no runtime of its own**, so
the exact same code runs in the browser app and in a headless Node runtime.

It depends on [`logisheets-web`](https://www.npmjs.com/package/logisheets-web)
for **types only** — the concrete engine `Client` is injected by the host:

- the **browser app** injects the worker-backed client from `logisheets-engine`;
- [`logisheets-runtime`](https://www.npmjs.com/package/logisheets-runtime)
  injects a synchronous client built on the Node WASM engine.

## Installation

```bash
npm install logisheets-core logisheets-web
```

`logisheets-web` is a peer dependency (used for types). This package is
ESM-only.

## Usage

You rarely construct the engine `Client` yourself — a host normally provides it.
Given a `Client`, `WorkbookOps` is the high-level operation layer:

```ts
import {WorkbookOps} from 'logisheets-core'
import type {Client} from 'logisheets-web'

declare const client: Client // supplied by the host (browser worker or Node)

const ops = new WorkbookOps(client)

await ops.inputCell(0, 0, 0, 'Hello')          // sheet 0, cell A1
await ops.createSheet(1, 'Summary')
await ops.setSheetColor(0, '#4472C4')
```

`WorkbookOps` covers cell input (including block cells and cell images), sheet
management (create / delete / rename / color), block operations (move, remove,
insert rows), and style payload generation (borders, fills, alignment, wrap).

## Subpath exports

Focused utilities are available without pulling in the whole surface:

| Import | Contents |
|--------|----------|
| `logisheets-core` | Full surface: ops, format, crafts, validation, fields, values, transactions, permissions |
| `logisheets-core/strings` | String helpers |
| `logisheets-core/type-guard` | Runtime type guards for engine types |
| `logisheets-core/selection` | Selection helpers |
| `logisheets-core/utils` | General utilities |
| `logisheets-core/value` | Cell-value helpers |

## Where it fits

```
logisheets-web / logisheets  (WASM engine, per host)
                │  Client (types only)
                ▼
        logisheets-core        ← you are here (UI-free logic)
        ┌───────┴────────┐
   Browser App     logisheets-runtime (Node)
```

## License

MIT — part of the [LogiSheets](https://github.com/logisky/LogiSheets) project.
