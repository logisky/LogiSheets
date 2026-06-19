# Read & write spreadsheets (SDK)

LogiSheets ships its spreadsheet engine through several packages that share the
same concepts and almost the same surface API. This guide explains the common
model once and shows the code for both **Rust** and **TypeScript**.

| Package | Language | Where it runs | Install |
| --- | --- | --- | --- |
| `logisheets-rs` | Rust | Native | `cargo add logisheets-rs` |
| `logisheets-web` | TypeScript (WASM) | Browser | `yarn add logisheets-web` |
| `logisheets` | TypeScript (WASM) | Node.js | `yarn add logisheets` |

::: tip Node vs. Web
The Node package (`logisheets`) and the browser package (`logisheets-web`) are
built from the same source — only the bundled WASM target differs. The
TypeScript examples below apply to both; just change the import specifier
(`logisheets-web` ↔ `logisheets`).

If you only need a ready-made spreadsheet UI component instead of the raw
engine, use [`logisheets-engine`](#the-ui-component-logisheets-engine).
:::

## Core concepts

These hold across every package:

- **`Workbook`** — the top-level handle. It owns the sheets, the undo/redo
  history, and the file I/O. You create it empty or load it from `.xlsx` bytes.
- **`Worksheet`** — a read-only view onto one sheet. You get cell values,
  styles, dimensions, merged ranges, blocks, etc. through it. A `Worksheet` is
  cheap to obtain and reflects the current workbook state.
- **Edits go through a transaction, not through setters.** You never mutate a
  cell directly. Instead you build a list of [*payloads*](#payload-reference)
  (e.g. "input `=A1+B1` into C1") and hand the whole batch to the workbook. The
  engine applies them atomically, recalculates dependent formulas, and reports
  what changed. This is what makes undo/redo and dependency tracking reliable.
- **Cells are addressed by `(row, col)`** with **0-based** indices (so `A1` is
  `row: 0, col: 0`). Internally cells also carry stable IDs that survive
  insertions/deletions, but you rarely need those for basic use.

A typical flow: create/load a workbook → read with a worksheet → apply a
transaction → read again → save to bytes.

## Creating or loading a workbook

::: code-group

```rust [Rust]
use logisheets_rs::Workbook;

// Empty workbook (starts with one sheet)
let mut wb = Workbook::new();

// Or load from .xlsx bytes
let bytes = std::fs::read("example.xlsx")?;
let mut wb = Workbook::from_file(&bytes, "example.xlsx".to_string())?;
```

```ts [TypeScript]
import {Workbook} from 'logisheets-web' // or 'logisheets' in Node

// Empty workbook — WASM is bundled, so construction is synchronous
const wb = new Workbook()

// Or load from .xlsx bytes (Uint8Array)
const bytes = await fetch('/example.xlsx').then(r => r.arrayBuffer())
wb.load(new Uint8Array(bytes), 'example.xlsx')
```

:::

## Inspecting sheets

::: code-group

```rust [Rust]
let count = wb.get_sheet_count();
let info = wb.get_all_sheet_info();            // Vec<SheetInfo> { id, idx, name, ... }
let name = wb.get_sheet_name_by_idx(0)?;

let ws = wb.get_sheet_by_idx(0)?;              // by index
let ws = wb.get_sheet_by_name("Sheet1")?;      // by name
```

```ts [TypeScript]
const count = wb.getSheetCount()
const info = wb.getAllSheetInfo()              // SheetInfo[] { id, idx, name, ... }
const name = wb.getSheetNameByIdx(0)

const ws = wb.getWorksheet(0)                  // by index
const ws = wb.getWorksheetById(sheetId)        // by stable id
```

:::

## Reading cell data

A `Worksheet` exposes both fine-grained getters (`getValue`, `getStyle`,
`getFormula`) and a combined `getCellInfo` (value + formula + style in one
call). For rendering a region efficiently, prefer the range/window getters.

::: code-group

```rust [Rust]
let ws = wb.get_sheet_by_idx(0)?;

let v = ws.get_value(0, 0)?;          // Value::Number / Str / Bool / Error / Empty
let f = ws.get_formula(0, 2)?;        // "=A1+B1"
let info = ws.get_cell_info(0, 0)?;   // CellInfo { value, formula, style, .. }

match v {
    logisheets_rs::Value::Number(n) => println!("{n}"),
    logisheets_rs::Value::Str(s) => println!("{s}"),
    _ => {}
}

// Dimensions and a whole region
let dim = ws.get_sheet_dimension()?;  // { max_row, max_col, height, width }
let cells = ws.get_cell_infos(0, 0, 9, 9)?;          // 10x10 block
let merges = ws.get_all_merged_cells();              // Vec<MergeCell>
```

```ts [TypeScript]
import {isErrorMessage} from 'logisheets-web'

const ws = wb.getWorksheet(0)

const v = ws.getValue(0, 0)           // Value (tagged union) or ErrorMessage
const f = ws.getFormula(0, 2)         // "=A1+B1"
const info = ws.getCellInfo(0, 0)     // CellInfo { value, formula, style, .. }

if (!isErrorMessage(v) && v !== 'empty' && v.type === 'number') {
    console.log(v.value)
}

// Dimensions and a whole region
const dim = ws.getSheetDimension()                   // { maxRow, maxCol, height, width }
const cells = ws.getCellInfos(0, 0, 9, 9)            // 10x10 block
const merges = ws.getMergedCells(0, 0, 9, 9)         // MergeCell[]
```

:::

::: warning Error handling differs by language
Rust methods return `Result<T>` — use `?`. The TS getters return
`T | ErrorMessage`; call `isErrorMessage(x)` to discriminate before using the
value. `Value` in TS is a tagged union:
`'empty' | {type: 'number', value} | {type: 'str', value} | {type: 'bool', value} | {type: 'error', value}`.
:::

## Editing: transactions and payloads

All mutations are batched into a transaction. Build the payloads, submit the
transaction, and read the resulting effect (which lists changed cells, async
tasks, etc.).

::: code-group

```rust [Rust]
use logisheets_rs::{EditAction, PayloadsAction, CellInput};

let effect = wb.handle_action(EditAction::Payloads(
    PayloadsAction::new()
        .set_undoable(true)
        .add_payload(CellInput { sheet_idx: 0, row: 0, col: 0, content: "10".into() })
        .add_payload(CellInput { sheet_idx: 0, row: 0, col: 1, content: "20".into() })
        .add_payload(CellInput { sheet_idx: 0, row: 0, col: 2, content: "=A1+B1".into() }),
));

// C1 now evaluates to 30
let ws = wb.get_sheet_by_idx(0)?;
assert!(matches!(ws.get_value(0, 2)?, logisheets_rs::Value::Number(n) if n == 30.0));
```

```ts [TypeScript]
const effect = wb.execTransaction({
    payloads: [
        {type: 'cellInput', value: {sheetIdx: 0, row: 0, col: 0, content: '10'}},
        {type: 'cellInput', value: {sheetIdx: 0, row: 0, col: 1, content: '20'}},
        {type: 'cellInput', value: {sheetIdx: 0, row: 0, col: 2, content: '=A1+B1'}},
    ],
    undoable: true,
    temp: false,
})

if (effect.status.type === 'ok') {
    const v = wb.getWorksheet(0).getValue(0, 2) // -> {type: 'number', value: 30}
}
```

:::

The result (`ActionEffect`) lists exactly what changed — `valueChanged`,
`styleChanged`, `rowInserted`, `headerUpdated`, etc. — plus `asyncTasks` (see
[Async / custom functions](#async-custom-functions-typescript)) and a `status`
that is `ok` or `err`. Use it to drive incremental re-rendering.

## Payload reference

A **payload** is the atomic unit of change. A transaction is just a list of
payloads applied in order. The full set is identical across languages — in Rust
each payload is a struct (snake_case fields), in TypeScript it's a tagged union
member `{type, value}` with a matching `*Builder` (camelCase fields).

::: tip
TypeScript ships a fluent builder for every payload if you prefer it over object
literals:

```ts
import {CellInputBuilder} from 'logisheets-web'

const payload = new CellInputBuilder()
    .sheetIdx(0).row(0).col(0).content('=A1+B1')
    .build() // -> { sheetIdx: 0, row: 0, col: 0, content: '=A1+B1' }
```
:::

### Cell content

| TS `type` | Rust struct | Fields | What it does |
| --- | --- | --- | --- |
| `cellInput` | `CellInput` | `sheetIdx, row, col, content` | Write to a cell. `content` is a string; a leading `=` makes it a formula, otherwise it's coerced to number / bool / text. |
| `cellClear` | `CellClear` | `sheetIdx, row, col` | Clear a cell's content. |

::: code-group

```rust [Rust]
use logisheets_rs::{CellInput, CellClear};

PayloadsAction::new()
    .add_payload(CellInput { sheet_idx: 0, row: 0, col: 0, content: "=SUM(B1:B9)".into() })
    .add_payload(CellClear { sheet_idx: 0, row: 5, col: 0 });
```

```ts [TypeScript]
const tx = {
    payloads: [
        {type: 'cellInput', value: {sheetIdx: 0, row: 0, col: 0, content: '=SUM(B1:B9)'}},
        {type: 'cellClear', value: {sheetIdx: 0, row: 5, col: 0}},
    ],
    undoable: true,
    temp: false,
}
```

:::

::: warning
`content` is **always a string**, even for numbers — pass `"10"`, not `10`.
:::

### Styling

| TS `type` | Rust struct | Fields | What it does |
| --- | --- | --- | --- |
| `cellStyleUpdate` | `CellStyleUpdate` | `sheetIdx, row, col, ty: StyleUpdateType` | Update one cell's style. |
| `lineStyleUpdate` | `LineStyleUpdate` | `sheetIdx, from, to, row: bool, ty: StyleUpdateType` | Style a range of whole rows (`row: true`) or columns. |
| `cellFormatBrush` | `CellFormatBrush` | `srcSheetIdx, srcRow, srcCol, dstSheetIdx, dstRowStart, dstColStart, dstRowEnd, dstColEnd` | Copy a cell's style onto a destination range (format painter). |
| `lineFormatBrush` | `LineFormatBrush` | `srcSheetIdx, srcRow, srcCol, dstSheetIdx, row: bool, from, to` | Format-painter for whole rows/columns. |

Style changes are expressed via a single `StyleUpdateType` object where every
field is optional — set only what you want to change:

```ts
// StyleUpdateType — all fields optional
{
    setFontBold?: boolean
    setFontItalic?: boolean
    setFontUnderline?: StUnderlineValues
    setFontColor?: string          // ARGB hex, e.g. "FFFF0000"
    setFontSize?: number
    setFontName?: string
    setFontOutline?: boolean
    setFontShadow?: boolean
    setFontStrike?: boolean
    setFontCondense?: boolean
    setLeftBorderColor?: string
    setRightBorderColor?: string
    setTopBorderColor?: string
    setBottomBorderColor?: string
    setLeftBorderStyle?: StBorderStyle
    setRightBorderStyle?: StBorderStyle
    setTopBorderStyle?: StBorderStyle
    setBottomBorderStyle?: StBorderStyle
    setBorderGiagonalUp?: boolean
    setBorderGiagonalDown?: boolean
    setBorderOutline?: boolean
    setPatternFill?: PatternFill
    setAlignment?: Alignment
    setNumFmt?: string             // number format code, e.g. "0.00%"
}
```

::: code-group

```rust [Rust]
use logisheets_rs::{CellStyleUpdate};
// StyleUpdateType has the same optional fields as the TS shape above.
let mut ty = logisheets_rs::StyleUpdateType::default();
ty.set_font_bold = Some(true);
ty.set_font_color = Some("FFFF0000".to_string());

PayloadsAction::new()
    .add_payload(CellStyleUpdate { sheet_idx: 0, row: 0, col: 0, ty });
```

```ts [TypeScript]
import {CellStyleUpdateBuilder, StyleUpdateTypeBuilder} from 'logisheets-web'

const ty = new StyleUpdateTypeBuilder()
    .setFontBold(true)
    .setFontColor('FFFF0000')
    .build()

const payload = new CellStyleUpdateBuilder()
    .sheetIdx(0).row(0).col(0).ty(ty)
    .build()
// -> { type: 'cellStyleUpdate', value: ... } when placed in a transaction
```

:::

### Rows & columns

| TS `type` | Rust struct | Fields | What it does |
| --- | --- | --- | --- |
| `insertRows` | `InsertRows` | `sheetIdx, start, count` | Insert `count` rows before row `start`. |
| `deleteRows` | `DeleteRows` | `sheetIdx, start, count` | Delete `count` rows from `start`. |
| `insertCols` | `InsertCols` | `sheetIdx, start, count` | Insert `count` columns before `start`. |
| `deleteCols` | `DeleteCols` | `sheetIdx, start, count` | Delete `count` columns from `start`. |
| `setRowHeight` | `SetRowHeight` | `sheetIdx, row, height` | Set a row's height (px). |
| `setColWidth` | `SetColWidth` | `sheetIdx, col, width` | Set a column's width (px). |
| `setVisible` | `SetVisible` | `isRow, sheetIdx, start, visible` | Show/hide a row (`isRow: true`) or column at `start`. |

::: code-group

```rust [Rust]
use logisheets_rs::{InsertRows, SetColWidth};

PayloadsAction::new()
    .add_payload(InsertRows { sheet_idx: 0, start: 2, count: 3 })
    .add_payload(SetColWidth { sheet_idx: 0, col: 0, width: 120.0 });
```

```ts [TypeScript]
const tx = {
    payloads: [
        {type: 'insertRows', value: {sheetIdx: 0, start: 2, count: 3}},
        {type: 'setColWidth', value: {sheetIdx: 0, col: 0, width: 120}},
    ],
    undoable: true,
    temp: false,
}
```

:::

### Merging

| TS `type` | Rust struct | Fields | What it does |
| --- | --- | --- | --- |
| `mergeCells` | `MergeCells` | `sheetIdx, startRow, startCol, endRow, endCol` | Merge a rectangular range. |
| `splitMergedCells` | `SplitMergedCells` | `sheetIdx, row, col` | Split the merge that covers `(row, col)`. |

### Sheets

| TS `type` | Rust struct | Fields | What it does |
| --- | --- | --- | --- |
| `createSheet` | `CreateSheet` | `idx, newName` | Insert a new sheet at index `idx`. |
| `deleteSheet` | `DeleteSheet` | `idx` | Delete the sheet at `idx`. |
| `sheetRename` | `SheetRename` | `idx?, oldName?, newName` | Rename a sheet (by `idx` or `oldName`). |
| `setSheetColor` | `SetSheetColor` | `idx, color` | Set the tab color (ARGB hex). |
| `setSheetVisible` | `SetSheetVisible` | `idx, visible` | Show/hide a sheet tab. |

### Copy / reproduce & checkpoints

| TS `type` | Rust struct | Fields | What it does |
| --- | --- | --- | --- |
| `reproduceCells` | `ReproduceCells` | `sheetIdx, startRow, startCol, cells` | Paste reproducible cells (value + style + appendix) anchored at `(startRow, startCol)`. Get the cells via `getReproducibleCell(s)`. |
| `restoreCheckpoint` | `RestoreCheckpoint` | `label` | Restore a previously saved named snapshot. |

### Blocks, DIY cells & appendices (advanced)

For structured/templated regions (used by crafts/plugins), there is a larger
family of payloads. They behave like the cell/row/col payloads above but operate
within a block's coordinate space:

- **Block lifecycle:** `createBlock`, `removeBlock`, `resizeBlock`, `moveBlock`,
  `convertBlock`
- **Block content & layout:** `blockInput`, `insertRowsInBlock`,
  `deleteRowsInBlock`, `insertColsInBlock`, `deleteColsInBlock`,
  `moveBlockLine`, `reorderBlockLines`
- **Block styling:** `blockStyleUpdate`, `blockLineStyleUpdate`,
  `blockLineNameFieldUpdate`
- **Schemas:** `bindFormSchema`, `bindRandomSchema`, `upsertFieldFormulas`,
  `upsertFieldRenderInfo`
- **DIY cells:** `createDiyCell`, `createDiyCellById`, `removeDiyCell`,
  `removeDiyCellById`
- **Appendices (block metadata):** `createAppendix`, `removeAppendix`
- **Ephemeral cells** (off-grid scratch cells for internal dependencies):
  `ephemeralCellInput`, `ephemeralCellRemove`, `ephemeralCellStyleUpdate`

These are an advanced feature; reach for them only when building structured data
regions. Consult the generated bindings (`packages/web/src/bindings/`) or the
Rust `edit_action` module for exact field shapes.

## Undo / redo

::: code-group

```rust [Rust]
let changed = wb.undo(); // false if nothing to undo
wb.redo();
```

```ts [TypeScript]
const changed = wb.undo() // false if nothing to undo
wb.redo()
```

:::

Only transactions submitted with `undoable: true` (Rust: `.set_undoable(true)`)
participate in the history.

## Saving to .xlsx

::: code-group

```rust [Rust]
let bytes: Vec<u8> = wb.save()?;
std::fs::write("out.xlsx", bytes)?;
```

```ts [TypeScript]
const result = wb.save(JSON.stringify({})) // -> { data: Uint8Array, code: number }
// write result.data to a file / trigger a download
```

:::

## Formulas

LogiSheets evaluates formulas automatically as part of each transaction. You can
also validate or evaluate a formula without committing it.

::: code-group

```rust [Rust]
let ok = wb.check_formula("=SUM(A1:A10)".to_string());      // syntax check
let cond = wb.calc_condition(0, "=A1>10".to_string())?;     // evaluate a predicate
```

```ts [TypeScript]
const ok = wb.checkFormula('=SUM(A1:A10)')
const cond = wb.calcCondition(0, '=A1>10')
```

:::

### Async / custom functions (TypeScript)

The TS SDK lets you register custom functions whose evaluation is asynchronous
(e.g. a network fetch). When a transaction needs them, the engine surfaces async
tasks; the SDK runs your executor and feeds results back, then fires update
callbacks.

```ts
import {CustomFunc} from 'logisheets-web'

wb.registryCustomFunc(
    new CustomFunc('MY_FETCH', async (args) => {
        const v = await fetch(`/api/${args[0]}`).then(r => r.text())
        return v
    }),
)
```

To react to recalculations, register callbacks:

```ts
wb.registerCellUpdatedCallback(() => rerender())
wb.onCellValueChanged(0, 0, 2, () => console.log('C1 changed'))
```

## The UI component (`logisheets-engine`)

`logisheets-engine` is a canvas-based spreadsheet UI built on top of the SDK,
with a web-worker backend. Use it when you want a drop-in spreadsheet view in a
web app rather than driving the engine yourself. It re-exposes the same
`Workbook`/`Worksheet` concepts internally; see the package for component-level
documentation.

## API reference quick map

| Concept | Rust (`logisheets-rs`) | TS (`logisheets-web` / `logisheets`) |
| --- | --- | --- |
| Create empty | `Workbook::new()` | `new Workbook()` |
| Load xlsx | `Workbook::from_file(&bytes, name)` | `wb.load(bytes, name)` |
| Save xlsx | `wb.save() -> Vec<u8>` | `wb.save(meta) -> {data, code}` |
| Sheet count | `wb.get_sheet_count()` | `wb.getSheetCount()` |
| Get worksheet | `wb.get_sheet_by_idx(i)` / `_by_name` | `wb.getWorksheet(i)` / `getWorksheetById` |
| Apply edits | `wb.handle_action(EditAction::Payloads(..))` | `wb.execTransaction(tx)` |
| Undo / redo | `wb.undo()` / `wb.redo()` | `wb.undo()` / `wb.redo()` |
| Cell value | `ws.get_value(r, c)` | `ws.getValue(r, c)` |
| Cell info | `ws.get_cell_info(r, c)` | `ws.getCellInfo(r, c)` |
| Formula | `ws.get_formula(r, c)` | `ws.getFormula(r, c)` |
| Style | `ws.get_style(r, c)` | `ws.getStyle(r, c)` |
| Dimensions | `ws.get_sheet_dimension()` | `ws.getSheetDimension()` |
| Region | `ws.get_cell_infos(r0,c0,r1,c1)` | `ws.getCellInfos(r0,c0,r1,c1)` |
| Merged cells | `ws.get_all_merged_cells()` | `ws.getMergedCells(..)` |
