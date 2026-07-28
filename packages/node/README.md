# logisheets

Node.js bindings for **LogiSheets** — a spreadsheet engine written in Rust and
compiled to WebAssembly. It reads, manipulates, and writes real `.xlsx` files
(formulas, styles, and structure preserved) with no browser required.

Same workbook API as [`logisheets-web`](https://www.npmjs.com/package/logisheets-web),
targeting Node. For a higher-level headless runtime that manages many workbooks
and adds RPC / crafts / file-watching, see
[`logisheets-runtime`](https://www.npmjs.com/package/logisheets-runtime).

> **This package targets Node.** For the browser, use
> [`logisheets-web`](https://www.npmjs.com/package/logisheets-web).

## Installation

```bash
npm install logisheets
```

## Usage

```ts
import {readFileSync, writeFileSync} from 'node:fs'
import {Workbook, isErrorMessage} from 'logisheets'

// Load a workbook from an .xlsx file on disk.
const wb = new Workbook()
const buf = readFileSync('book.xlsx')
const code = wb.load(new Uint8Array(buf), 'book.xlsx') // 0 === success

// Read a cell.
const ws = wb.getWorksheet(0)
const cell = ws.getCellInfo(0, 0) // A1
if (!isErrorMessage(cell)) {
    console.log(cell.value, cell.formula)
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
writeFileSync('out.xlsx', saved.data)
```

`Workbook` also exposes blocks, comments, checkpoints, formula display units,
undo/redo, and more. `Worksheet` provides the read surface (cells, dimensions,
merged cells, charts, data validation, dependents, …).

## Documentation

Full guides and API reference: **[docs.logisheets.com](https://docs.logisheets.com/)**.

## License

MIT — part of the [LogiSheets](https://github.com/logisky/LogiSheets) project.
