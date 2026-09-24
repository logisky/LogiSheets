//! # logisheets-rs
//!
//! The Rust API for the LogiSheets spreadsheet engine: open, edit, recalculate
//! and save `.xlsx` workbooks.
//!
//! This crate is a facade. The engine lives in `logisheets_controller`, file
//! I/O in `logisheets_workbook`, shared ids in `logisheets_base`; this crate
//! re-exports what callers need so they depend on it alone. The optional
//! `rpc` feature adds [`rpc`], the message protocol the browser WASM binding
//! (`logisheets_wasm_server`) and the desktop host drive the engine through.
//!
//! ## Quick start
//!
//! ```rust,no_run
//! use logisheets_rs::{CellInput, EditAction, PayloadsAction, StatusCode, Workbook};
//!
//! // A new workbook already holds one sheet, "Sheet1".
//! let mut wb = Workbook::new();
//!
//! // Writes are transactions of payloads. Content is parsed like typed
//! // input: "1" is a number, "=A1*2" a formula.
//! let action = PayloadsAction::new()
//!     .add_payload(CellInput { sheet_idx: 0, row: 0, col: 0, content: "1".into() })
//!     .add_payload(CellInput { sheet_idx: 0, row: 1, col: 0, content: "=A1*2".into() })
//!     .set_undoable(true);
//! let effect = wb.handle_action(EditAction::Payloads(action));
//! if let StatusCode::Err(_) = effect.status {
//!     panic!("rejected: {:?}", effect.error_message);
//! }
//!
//! // Formulas recalculate as part of the write.
//! let value = wb.get_sheet_by_idx(0).unwrap().get_value(1, 0).unwrap();
//!
//! // Round-trip through .xlsx bytes.
//! let bytes = wb.save().unwrap();
//! let reopened = Workbook::from_file(&bytes, "book.xlsx".to_string()).unwrap();
//! ```
//!
//! ## Contracts worth knowing
//!
//! - **Coordinates are 0-based**: `row: 0, col: 0` is `A1`. A `sheet_idx` is a
//!   sheet's current position and shifts when sheets are added or removed; a
//!   [`SheetId`] is stable. Cells, rows and columns likewise have stable ids
//!   ([`CellId`], [`RowId`], [`ColId`]) that survive inserts and deletes.
//! - **A rejected write is not an `Err`.** `handle_action` always returns an
//!   [`ActionEffect`]; check its `status`. A rejected transaction applies
//!   none of its payloads, and `error_message` names the one it stopped at.
//! - **Payloads run in order**, each seeing the previous ones' effects, so a
//!   write to B4 before an `InsertRows` lands on a different cell than after.
//! - **`undoable` defaults to `false`** on [`PayloadsAction::new`]; call
//!   `set_undoable(true)` for a write the user should be able to undo.
//! - **The temp branch is workbook-wide.** `handle_action_in_temp_status`
//!   opens one branch that later temp writes accumulate on until
//!   `commit_temp_status` or `clean_temp_status`; any non-temp write
//!   discards it. Check `is_in_temp_mode` before opening one of your own.
//! - **Reads return [`Result`]** with [`Error`]; the RPC layer flattens that
//!   to [`ErrorMessage`].

// Re-export the main Workbook and Worksheet types from controller/api
pub use logisheets_controller::api::{
    BlockOpForPayload, BlockOpPolicy, BlockSortOrder, CellInfo, CellRefRange, CfRuleInfo,
    DefinedNameInfo, DependentCell, DuplicateBlockKey, EnumSetInfo, EnumVariantInfo,
    FieldValidationVerdict, FillRange, PivotExcelNote, PivotPlan, PivotSpecParts, ReproducibleCell,
    SaveFileResult, SheetCoordinate, SheetDimension, Workbook, Worksheet,
};

// Re-export display types
pub use logisheets_controller::controller::display::{
    BlockCellInfo, BlockDataRow, BlockDisplayInfo, BlockField, BlockInfo, BlockSchema,
    BlockSchemaRandomEntry, BlockSchemaType, CellCoordinate, CellCoordinateWithSheet,
    CellImageInfo, CellPosition, ChartAxisScaleInfo, ChartDataLabelsInfo, ChartInfo,
    ChartOfPieSplitInfo, ChartSeriesInfo, ColInfo, DisplayWindow, DisplayWindowRequest,
    DisplayWindowWithStartPoint, LinkInfo, RowInfo, ShadowCellInfo, SheetInfo, TempCellChange,
    TempStatusDiff,
};

// Re-export edit actions
pub use logisheets_controller::edit_action::{
    ActionEffect, Alignment, AsyncFuncResult, AxisScaleUpdate, BindFormSchema, BindRandomSchema,
    BlockActor, BlockInput, BlockLineNameFieldUpdate, BlockLineStyleUpdate, BlockModifyInfo,
    BlockOp, BlockPermissions, CellClear, CellFormatBrush, CellInput, CellStyleUpdate,
    CreateAppendix, CreateBlock, CreateDiyCell, CreateSheet, DefineName, DeleteCellImage,
    DeleteCols, DeleteColsInBlock, DeleteRows, DeleteRowsInBlock, DeleteSheet, EditAction,
    EditPayload, EphemeralCellInput, HorizontalAlignment, InsertCols, InsertColsInBlock,
    InsertRows, InsertRowsInBlock, LineFormatBrush, LineStyleUpdate, MergeCells, ModifyPolicy,
    MoveBlock, OfPieSplitUpdate, PayloadsAction, RemoveBlock, RemoveName, RenameName,
    ReproduceCells, ResizeBlock, SetBlockDescription, SetBlockPermissions, SetCellImage,
    SetColWidth, SetRowHeight, SetSheetColor, SetSheetVisible, SheetCellId, SheetRename,
    SplitMergedCells, StatusCode, StyleUpdateType, UpsertFieldRenderInfo, VerticalAlignment,
};

// Re-export style types
pub use logisheets_controller::controller::style::{PatternFill, from_hex_str};

// Re-export error types (via api module re-exports)
pub use logisheets_controller::{Context, Error, ErrorMessage, Result, take_last_error};

// Re-export shadow-cell kind so RPC payloads and host code can tag
// which derived computation each shadow cell represents.
pub use logisheets_controller::sid_assigner::ShadowKind;

// Re-export checkpoint primitives so the WASM RPC layer can build
// response DTOs from them.
pub use logisheets_controller::checkpoint_manager::{CheckpointManager, CheckpointMeta};

// Re-export value and style types
pub use logisheets_controller::{Appendix, AppendixWithCell, Comment, MergeCell, Style, Value};

// Re-export FormulaDisplayInfo and lex functions
pub use logisheets_controller::{FormulaDisplayInfo, lex_and_fmt, lex_success};

// Re-export async calculation types
pub use logisheets_base::async_func::{AsyncCalcResult, AsyncErr, Task};

// Re-export ID types from base
pub use logisheets_base::{BlockCellId, BlockId, CellId, ColId, DiyCellId, RowId, SheetId, TextId};

// Re-export errors from base
pub use logisheets_base::errors::BasicError;

// Re-export workbook types
pub use logisheets_workbook::logisheets::AppData;
pub use logisheets_workbook::prelude::{StBorderStyle, StPatternType, StUnderlineValues};

// Transport-agnostic RPC layer (Manager + wire protocol + logic functions),
// consumed by the browser WASM binding and the native desktop host. Gated so
// the default public API stays a thin `Workbook` facade.
#[cfg(feature = "rpc")]
pub mod rpc;
