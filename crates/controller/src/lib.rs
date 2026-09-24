//! The LogiSheets spreadsheet engine: workbook state, formula evaluation,
//! dependency tracking, undo/redo, and .xlsx load/save.
//!
//! Entry points:
//! - [`Workbook`] (in [`api`]) is the facade every host uses: build one with
//!   [`Workbook::new`] or [`Workbook::from_file`], change it with
//!   [`Workbook::handle_action`], read it through [`Worksheet`]s, persist it
//!   with [`Workbook::save`].
//! - [`edit_action`] holds the write vocabulary. An [`EditAction::Payloads`]
//!   wraps a [`edit_action::PayloadsAction`]: an ordered list of
//!   [`edit_action::EditPayload`]s applied all-or-nothing as one transaction
//!   (and one undo step when `undoable`).
//! - [`Controller`] is the layer under `Workbook`; embedders rarely need it.
//!
//! Conventions shared by the whole API:
//! - Rows, columns and `sheet_idx` are 0-based. `sheet_idx` is the sheet's
//!   current position in the tab order, so it shifts when sheets are
//!   created, deleted or moved; `SheetId`, `CellId`, `RowId` and `ColId` are
//!   stable ids that survive inserts and deletes.
//! - A write never panics or returns `Err`: a rejected transaction leaves the
//!   workbook untouched and reports itself in
//!   [`edit_action::ActionEffect::status`] / `error_message`.
//!
//! Sibling crates: `logisheets_base` (shared ids and value types),
//! `logisheets_lexer` / `logisheets_parser` (formula text to AST),
//! `logisheets_lexer4fmt` (formula tokenizing for editor highlighting) and
//! `logisheets_workbook` (the OOXML model). `logisheets-rs` (`crates/api`)
//! re-exports this crate, and `crates/wasms/server` exposes it to JavaScript.

#[macro_use]
extern crate lazy_static;

pub mod api;
mod async_func_manager;
mod block_manager;
mod calc_engine;
mod cell;
mod cell_attachments;
pub mod chart_manager;
pub mod checkpoint_manager;
pub mod conditional_formatting_manager;
mod connectors;
mod container;
pub mod controller;
mod cube_manager;
pub mod data_validation_manager;
pub mod edit_action;
mod errors;
pub mod exclusive;
mod ext_book_manager;
mod ext_ref_manager;
mod file_loader;
mod file_saver;
mod formula_manager;
mod id_manager;
pub mod image_manager;
mod lock;
mod navigator;
mod range_manager;
mod settings;
pub mod sid_assigner;
mod sqref;
mod style_manager;
mod theme_manager;
mod utils;
mod version_manager;
mod workbook;

use logisheets_base::CellId;
use logisheets_base::SheetId;

pub use controller::{
    Controller, FormulaFormat,
    display::{Comment, CommentMentionInfo, CommentNote, CommentPerson, MergeCell, Value},
    style::{Border, BorderPr, Fill, Font, Style},
    take_last_error,
};
pub use exclusive::{Appendix, AppendixWithCell};
pub use logisheets_workbook::prelude::SerdeErr;

pub use logisheets_base::BlockId;
pub use logisheets_base::async_func::AsyncCalcResult;
pub use logisheets_base::async_func::AsyncErr;
pub use logisheets_base::async_func::Task;

pub use logisheets_lexer4fmt::{CellRef, FormulaDisplayInfo, TokenType, TokenUnit};

/// Whether a formula body lexes. `f` must NOT carry the leading `=`. Lexing
/// only: unknown functions, sheets and names still pass.
pub fn lex_success(f: &str) -> bool {
    let toks = logisheets_lexer::lex(f);
    match toks {
        Some(_) => true,
        None => false,
    }
}

/// Tokenize a formula for display (syntax highlighting and reference
/// colouring). `s` is the body without the leading `=`. `None` when it does
/// not lex; a trailing incomplete token is tolerated (see
/// `logisheets_lexer4fmt`).
pub fn lex_and_fmt(s: &str) -> Option<FormulaDisplayInfo> {
    logisheets_lexer4fmt::lex_and_fmt(s)
}

pub use api::*;
