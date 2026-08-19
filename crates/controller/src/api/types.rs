use gents_derives::TS;
use logisheets_base::{BlockId, DiyCellId};

use crate::{Appendix, Style, Value, controller::style::Color, style_manager::RawStyle};

#[derive(Debug, Clone, TS)]
#[ts(file_name = "save_file_result.ts", rename_all = "camelCase")]
pub struct SaveFileResult {
    pub data: Vec<u8>,
    pub code: u8,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_info.ts", rename_all = "camelCase")]
pub struct CellInfo {
    pub value: Value,
    pub formula: String,
    pub style: Style,
    pub block_id: Option<BlockId>,
    pub diy_cell_id: Option<DiyCellId>,
    /// The value of this cell's data-validation shadow, if one exists. It is
    /// the boolean result of the validation rule (`false` ⇒ the cell's value
    /// violates the rule). `None` when the cell has no data-validation shadow.
    pub validation_shadow: Option<Value>,
    /// The conditional formatting currently in effect for this cell, or `None`
    /// when no rule matches it. See [`ConditionalFormat`].
    pub conditional_format: Option<ConditionalFormat>,
}

/// What conditional formatting does to one cell, already resolved: the caller
/// renders `style` and needs no knowledge of rules, priorities or dxfs.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "conditional_format.ts", rename_all = "camelCase")]
pub struct ConditionalFormat {
    /// The cell's own style with every matching rule's differential format
    /// merged on top, in `priority` order and stopping at a matching
    /// `stopIfTrue` rule. Replaces `CellInfo::style` for rendering.
    pub style: Style,
    /// Where the cell sits between its visual rule's first and last `cfvo`, on a
    /// 0..=1 scale. `None` when no colour scale / data bar / icon set applies.
    /// A colour scale needs nothing more from the caller — its interpolated
    /// colour is already merged into `style`.
    pub scale: Option<f64>,
    /// A data bar to draw inside the cell, behind its text.
    pub data_bar: Option<CfDataBar>,
    /// An icon to draw at the cell's leading edge.
    pub icon: Option<CfIcon>,
}

/// A data bar, resolved: the caller fills `fraction` of the cell's inner width
/// with `color` and needs no knowledge of cfvos.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "cf_data_bar.ts", rename_all = "camelCase")]
pub struct CfDataBar {
    pub color: Color,
    /// How much of the available width the bar occupies, 0..=1, already scaled
    /// into the rule's `minLength`..`maxLength` band.
    pub fraction: f64,
    /// When false the cell's own text is hidden and only the bar shows.
    pub show_value: bool,
}

/// Which icon of an icon set applies to the cell.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "cf_icon.ts", rename_all = "camelCase")]
pub struct CfIcon {
    /// The OOXML icon set name, e.g. `3TrafficLights1`, `5Arrows`.
    pub set: String,
    /// 0-based index into the set, counting from the *lowest* band upward after
    /// `reverse` has been applied.
    pub index: usize,
    /// How many icons the set has (3, 4 or 5).
    pub count: usize,
    /// When false the cell's own text is hidden and only the icon shows.
    pub show_value: bool,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_dimension.ts", rename_all = "camelCase")]
pub struct SheetDimension {
    pub max_row: usize,
    pub max_col: usize,
    pub height: f64,
    pub width: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "reproducible_cell.ts", rename_all = "camelCase")]
// It is used to reproduce cells.
// Note that `value` or `style` is not friendly to the frontend, and reproducing cells
// don't have formula.
pub struct ReproducibleCell {
    pub coordinate: SheetCoordinate,
    pub value: Value,
    pub style: RawStyle,
    pub appendix: Vec<Appendix>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_coordinate.ts", rename_all = "camelCase")]
pub struct SheetCoordinate {
    pub row: usize,
    pub col: usize,
}

/// A reference (a cell or range) resolved to a concrete rectangle, as used by
/// the dependency-tracking API. `start == end` with neither `all_rows` nor
/// `all_cols` set ⇒ a single-cell reference.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_ref_range.ts", rename_all = "camelCase")]
pub struct CellRefRange {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
    /// A whole-column reference (e.g. `A:A`) — spans every row. `start_row`/
    /// `end_row` are 0 placeholders; the reference grows with the sheet.
    pub all_rows: bool,
    /// A whole-row reference (e.g. `3:3`) — spans every column.
    pub all_cols: bool,
}

/// One formula cell that depends on a queried range (Excel "trace dependents"),
/// with the reference it used to reach that range.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "dependent_cell.ts", rename_all = "camelCase")]
pub struct DependentCell {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    /// The reference this formula used that intersects the queried range.
    pub via: CellRefRange,
}

/// One conditional-formatting rule as a UI would show it: an id to act on, a
/// human-readable range, a preview of the format, and the spec to load into an
/// editor and send back via `UpdateConditionalFormattingRule`.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "cf_rule_info.ts", rename_all = "camelCase")]
pub struct CfRuleInfo {
    /// Session-scoped; re-minted on load, so never persist it.
    pub rule_id: u32,
    /// The `sqref` the rule covers, rendered from its current anchors
    /// (`"A1:A10 C1:C5"`).
    pub range: String,
    pub priority: i32,
    /// The rule's condition and format, in the shape the write payloads accept.
    pub spec: crate::conditional_formatting_manager::spec::CfRuleSpec,
    /// The differential format resolved against the workbook theme, for drawing
    /// a preview swatch without the caller parsing a dxf.
    pub preview: Option<Style>,
}
