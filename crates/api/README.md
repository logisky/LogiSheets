# logisheets-rs

The Rust API for [LogiSheets](https://github.com/logisky/LogiSheets) — a
spreadsheet engine written in Rust that reads, edits, and writes `.xlsx`
files, with full formula evaluation, dependency tracking, and undo/redo.

This crate is the public, ergonomic entry point over the internal engine
crates (`logisheets_controller`, `logisheets_workbook`, …). Add just this one:

```toml
[dependencies]
logisheets-rs = "1.2"
```

## Quick start

```rust
use logisheets_rs::{CellInput, EditAction, PayloadsAction, StatusCode, Value, Workbook};

fn main() {
    // A new workbook already contains one sheet, "Sheet1".
    let mut wb = Workbook::default();

    // Edits are payloads applied through a transaction. Cell content is
    // interpreted automatically: "1" is a number, "=SUM(A1:B2)" a formula.
    // (row/col are 0-based: A1 = row 0 col 0.)
    let action = PayloadsAction::new()
        .add_payload(CellInput { sheet_idx: 0, row: 0, col: 0, content: "1".into() })
        .add_payload(CellInput { sheet_idx: 0, row: 1, col: 0, content: "2".into() })
        .add_payload(CellInput { sheet_idx: 0, row: 0, col: 1, content: "3".into() })
        .add_payload(CellInput { sheet_idx: 0, row: 1, col: 1, content: "4".into() })
        .add_payload(CellInput { sheet_idx: 0, row: 3, col: 0, content: "=SUM(A1:B2)".into() })
        .set_undoable(true);

    if let StatusCode::Err(e) = wb.handle_action(EditAction::Payloads(action)).status {
        panic!("edit failed: {:?}", e);
    }

    // Formulas recalculate automatically; read the result back.
    let ws = wb.get_sheet_by_idx(0).unwrap();
    if let Value::Number(n) = ws.get_cell_info(3, 0).unwrap().value {
        assert_eq!(n, 10.0); // SUM(A1:B2)
    }

    // Save to .xlsx bytes.
    let bytes = wb.save().unwrap();
    std::fs::write("output.xlsx", &bytes).unwrap();
}
```

## Concepts

- **`Workbook`** — the top-level handle. `Workbook::default()` starts a fresh
  book; `Workbook::from_file(&bytes, name)` opens an existing `.xlsx`.
- **Edits are transactions.** Build a `PayloadsAction` from one or more
  `EditPayload`s (e.g. `CellInput`, `SetColWidth`, `MergeCells`, `InsertRows`)
  and apply it with `handle_action(EditAction::Payloads(..))`. Payloads grouped
  into one action are one undoable step.
- **Undo/redo** — `wb.undo()` / `wb.redo()`.
- **Reading** — get a `Worksheet` via `get_sheet_by_idx`, then
  `get_cell_info(row, col)` for value/formula/style, or a display window for
  viewport rendering.
- **Saving** — `wb.save()` returns the `.xlsx` file as `Vec<u8>`.

## Example project

A runnable, minimal example lives in the examples repo under
[`sdks/rust`](https://github.com/logisky/logisheets-examples/tree/main/sdks/rust).

## License

MIT
