//! LogiScript: a line-oriented DSL for driving `logisheets_controller` in
//! tests. The `.script` files under the repo's `tests/` directory are run
//! through [`execute_script`] by the root test harness (`tests/test.rs`).
//!
//! One statement per line; blank lines and lines starting with `#` are
//! skipped. The grammar is `grammar.pest`; `README.md` lists the commands
//! (`SWITCH`, `INPUT`, `CHECKNUM`, `CHECKSTR`, `CHECKERR`, `CHECKFORMULA`,
//! `CHECKEMPTY`, `INSERTROW`/`COL`, `DELETEROW`/`COL`, and the `BLOCK*` family).
//!
//! Things the README does not say:
//!
//! - Cells are A1 references and sheet rows are 1-based (`INSERTROW 1 3`
//!   inserts at the first row), but `BLOCK{INSERT,DELETE}{ROW,COL}` take a
//!   0-based index relative to the block.
//! - A script starts on `Sheet1`. `SWITCH` to a missing sheet creates it at
//!   index 0, so sheet indices shift; statements address sheets by name.
//! - Only `CHECK*` statements (and a sheet that cannot be found) fail a
//!   script. A write the engine rejects is ignored, so a later check fails
//!   instead, away from the cause.
//! - `CHECKNUM` passes within an absolute tolerance of `1e-3`.
//! - Nothing is undoable: every write is sent with `undoable: false`.

mod executor;
mod operator;
mod parser;

/// Run a script against a fresh workbook. `None` when every statement ran and
/// every check passed; otherwise the first failure, with its 1-based line.
pub use executor::execute_script;
/// Run a script and return the resulting workbook, for tests that go on to
/// inspect it in Rust. Fails like [`execute_script`].
pub use executor::load_from_script;
