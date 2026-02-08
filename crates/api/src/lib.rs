//! # logisheets-rs
//!
//! The Rust API for LogiSheets spreadsheet engine.
//!
//! This crate provides a clean public API for Rust users to interact with LogiSheets.
//! It re-exports the essential types and functions from the internal crates.
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use logisheets_rs::Workbook;
//!
//! // Create a new workbook
//! let mut workbook = Workbook::new();
//!
//! // Or load from a file
//! let data = std::fs::read("example.xlsx").unwrap();
//! let workbook = Workbook::from_file(&data, "example.xlsx".to_string()).unwrap();
//! ```

// Re-export the main Workbook and Worksheet types from controller/api
pub use logisheets_controller::api::{
    CellInfo, ReproducibleCell, SaveFileResult, SheetCoordinate, SheetDimension, Workbook,
    Worksheet,
};

// Re-export display types
pub use logisheets_controller::controller::display::{
    BlockCellInfo, BlockDisplayInfo, BlockField, BlockInfo, BlockSchema, BlockSchemaRandomEntry,
    BlockSchemaType, CellCoordinate, CellCoordinateWithSheet, CellPosition, ColInfo, DisplayWindow,
    DisplayWindowRequest, DisplayWindowWithStartPoint, RowInfo, ShadowCellInfo, SheetInfo,
};

// Re-export edit actions
pub use logisheets_controller::edit_action::{
    ActionEffect, Alignment, AsyncFuncResult, BindFormSchema, BindRandomSchema, BlockInput,
    BlockLineNameFieldUpdate, BlockLineStyleUpdate, CellClear, CellFormatBrush, CellInput,
    CellStyleUpdate, CreateAppendix, CreateBlock, CreateDiyCell, CreateSheet, DeleteCols,
    DeleteColsInBlock, DeleteRows, DeleteRowsInBlock, DeleteSheet, EditAction, EditPayload,
    EphemeralCellInput, HorizontalAlignment, InsertCols, InsertColsInBlock, InsertRows,
    InsertRowsInBlock, LineFormatBrush, LineStyleUpdate, MergeCells, MoveBlock, PayloadsAction,
    RemoveBlock, ReproduceCells, ResizeBlock, SetColWidth, SetRowHeight, SetSheetColor,
    SetSheetVisible, SheetCellId, SheetRename, SplitMergedCells, StatusCode, StyleUpdateType,
    UpsertFieldRenderInfo, VerticalAlignment,
};

// Re-export style types
pub use logisheets_controller::controller::style::{from_hex_str, PatternFill};

// Re-export error types (via api module re-exports)
pub use logisheets_controller::{Error, ErrorMessage, Result};

// Re-export value and style types
pub use logisheets_controller::{Appendix, AppendixWithCell, Comment, MergeCell, Style, Value};

// Re-export FormulaDisplayInfo and lex functions
pub use logisheets_controller::{lex_and_fmt, lex_success, FormulaDisplayInfo};

// Re-export async calculation types
pub use logisheets_base::async_func::{AsyncCalcResult, AsyncErr, Task};

// Re-export ID types from base
pub use logisheets_base::{BlockCellId, BlockId, CellId, ColId, DiyCellId, RowId, SheetId, TextId};

// Re-export errors from base
pub use logisheets_base::errors::BasicError;

// Re-export workbook types
pub use logisheets_workbook::logisheets::AppData;
pub use logisheets_workbook::prelude::{StBorderStyle, StPatternType, StUnderlineValues};
