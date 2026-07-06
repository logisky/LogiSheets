#[macro_use]
extern crate lazy_static;

pub mod api;
mod async_func_manager;
mod block_manager;
mod calc_engine;
mod cell;
mod cell_attachments;
pub mod checkpoint_manager;
mod connectors;
mod container;
pub mod controller;
mod cube_manager;
pub mod edit_action;
mod errors;
pub mod exclusive;
mod ext_book_manager;
mod ext_ref_manager;
mod file_loader;
mod file_saver;
mod formula_manager;
mod id_manager;
mod lock;
mod navigator;
mod range_manager;
mod settings;
pub mod sid_assigner;
mod style_manager;
mod theme_manager;
mod utils;
mod version_manager;
mod workbook;

use logisheets_base::CellId;
use logisheets_base::SheetId;

pub use controller::{
    Controller,
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

// Has SKIPPED the '='
pub fn lex_success(f: &str) -> bool {
    let toks = logisheets_lexer::lex(f);
    match toks {
        Some(_) => true,
        None => false,
    }
}

pub fn lex_and_fmt(s: &str) -> Option<FormulaDisplayInfo> {
    logisheets_lexer4fmt::lex_and_fmt(s)
}

pub use api::*;
