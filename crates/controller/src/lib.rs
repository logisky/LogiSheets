#[macro_use]
extern crate lazy_static;

pub mod api;
mod async_func_manager;
mod calc_engine;
mod cell;
mod cell_attachments;
mod connectors;
mod container;
pub mod controller;
mod cube_manager;
mod data_executor;
mod errors;
mod ext_book_manager;
mod ext_ref_manager;
mod file_loader2;
mod file_saver;
mod formula_manager;
mod id_manager;
mod navigator;
mod payloads;
mod range_manager;
mod settings;
mod style_manager;
mod theme_manager;
mod version_manager;
mod workbook;

use logisheets_base::CellId;
use logisheets_base::SheetId;

pub use controller::{
    display::{Comment, MergeCell, Value},
    style::{Border, BorderPr, Fill, Font, Style},
    Controller,
};
pub use logisheets_workbook::prelude::SerdeErr;

pub use logisheets_base::async_func::AsyncCalcResult;
pub use logisheets_base::async_func::AsyncErr;
pub use logisheets_base::async_func::Task;
pub use logisheets_base::BlockId;

// Has SKIPPED the '='
pub fn lex_success(f: &str) -> bool {
    let toks = logisheets_lexer::lex(f);
    match toks {
        Some(_) => true,
        None => false,
    }
}

pub use api::*;
