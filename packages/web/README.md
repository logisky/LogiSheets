# logisheets-web

Browser SDK for **LogiSheets** — a web-based spreadsheet powered by a Rust
engine compiled to WebAssembly. It reads, manipulates, and writes real `.xlsx`
files (formulas, styles, and structure preserved) entirely in the browser.

This is the low-level workbook API. For a ready-made spreadsheet UI, use
[`logisheets-engine`](https://www.npmjs.com/package/logisheets-engine); for the
headless Node engine, use [`logisheets`](https://www.npmjs.com/package/logisheets).

## Installation

```bash
npm install logisheets-web
```

The WASM module is bundled with the package; use a bundler that can serve
`.wasm` assets (webpack, Vite, etc.).

## Usage

```ts
import {Workbook, isErrorMessage} from 'logisheets-web'

// Create an empty workbook, or load one from .xlsx bytes.
const wb = new Workbook()
const code = wb.load(new Uint8Array(buffer), 'book.xlsx') // 0 === success

// Read a cell.
const ws = wb.getWorksheet(0)
const cell = ws.getCellInfo(0, 0) // A1
if (!isErrorMessage(cell)) {
    console.log(cell.value, cell.formula, cell.style)
}

// Edit via an (undoable) transaction.
wb.execTransaction({
    payloads: [
        {
            type: 'cellInput',
            value: {sheetIdx: 0, row: 0, col: 0, content: '=1+1'},
        },
    ],
    undoable: true,
    temp: false,
})

// Save back to .xlsx.
const saved = wb.save('') // { data: Uint8Array, code }
```

`Workbook` also exposes blocks, comments, checkpoints, fill-handle prediction,
formula display units, undo/redo, and more. `Worksheet` provides the read
surface (cells, dimensions, merged cells, charts, data validation, dependents,
…).

### WASM-free subpath

```ts
import {isErrorMessage} from 'logisheets-web/pure'
```

`logisheets-web/pure` exposes everything that does **not** touch the WASM —
generated bindings (payload builders + types), pure helpers, and the `Client`
type. Import from here to construct payloads or share logic without loading the
engine (e.g. code that also runs on Node).

## Documentation

Full guides and API reference: **[docs.logisheets.com](https://docs.logisheets.com/)**.

## License

MIT — part of the [LogiSheets](https://github.com/logisky/LogiSheets) project.
