use gents_derives::TS;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

/// Default for required `ty = "text"` fields.
///
/// An element written with an empty text payload (`<app name="x"></app>`)
/// produces no `Event::Text` at all when read back, so a text field without a
/// default is left unset and the derived deserializer unwraps `None` — i.e.
/// every file we saved with empty app data was unreadable. Defaulting to the
/// empty string makes the round-trip total. It also stops xmlserde from
/// serializing the empty payload, which is what we meant to write anyway.
fn empty_text() -> String {
    String::new()
}

/// Stores the LogiSheets-specific data.
///
/// LogiSheetsData is the root element of the logisheets.xml file.
/// This is exclusive to LogiSheets and is not part of the OpenXML standard.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(root = b"logisheets")]
pub struct LogiSheetsData {
    /// LogiSheets builting sheet data.
    #[xmlserde(name = b"sheet", ty = "child")]
    pub sheets: Vec<Sheet>,
    /// LogiSheets app data.
    ///
    /// When calling the save function, the application will provide
    /// their app-specific data and they are stored in this element.
    ///
    /// When calling the load function, these data will be given to
    /// the application and it is up to the application to parse them.
    #[xmlserde(name = b"app", ty = "child")]
    pub apps: Vec<AppData>,
    /// Per-render-id formatting / DIY-render flags. Stored at the workbook
    /// level (not per-sheet) because the worker's `FieldRenderManager` is
    /// keyed by `RenderId` alone, which is sheet-agnostic.
    #[xmlserde(name = b"fieldRender", ty = "child")]
    pub field_renders: Vec<FieldRenderXml>,
    /// The workbook's enum sets: the option lists that `enum` / `multiSelect`
    /// fields draw from. Workbook-level because a set is named by id and shared
    /// across blocks and sheets.
    ///
    /// Ids and labels only. A variant's COLOUR is presentation and stays in the
    /// host — the engine needs the options to decide whether a value is one of
    /// them, and needs nothing else.
    #[xmlserde(name = b"enumSet", ty = "child")]
    pub enum_sets: Vec<EnumSetXml>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct EnumSetXml {
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: String,
    /// Human-readable name for the set. Optional: a set minted by inference
    /// (from a column's distinct values) has no name worth writing down.
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"variant", ty = "child")]
    pub variants: Vec<EnumVariantXml>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct EnumVariantXml {
    /// What the cell stores.
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: String,
    /// What a reader sees. Absent when it is the same as the id.
    #[xmlserde(name = b"label", ty = "attr")]
    pub label: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct FieldRenderXml {
    #[xmlserde(name = b"renderId", ty = "attr")]
    pub render_id: String,
    /// Number-format string (e.g. `"0.00%"`) — the only style attribute
    /// crafts currently set via `upsertFieldRenderInfo`. Persisted as
    /// the raw string rather than a `StyleId` because the workbook's
    /// xlsx-side style table renumbers entries on load (and may trim
    /// styles not referenced by any cell), so a saved `StyleId` is not
    /// stable. On load we re-execute a `SetNumFmt` style update to mint
    /// a fresh, valid id.
    #[xmlserde(name = b"numFmt", ty = "attr")]
    pub num_fmt: Option<String>,
    #[xmlserde(name = b"diyRender", ty = "attr")]
    pub diy_render: Option<bool>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct BlockRange {
    #[xmlserde(name = b"blockId", ty = "attr")]
    pub block_id: usize,
    #[xmlserde(name = b"startRow", ty = "attr")]
    pub start_row: usize,
    #[xmlserde(name = b"startCol", ty = "attr")]
    pub start_col: usize,
    #[xmlserde(name = b"rowCnt", ty = "attr")]
    pub row_cnt: usize,
    #[xmlserde(name = b"colCnt", ty = "attr")]
    pub col_cnt: usize,
    /// The craft id that created this block. None means no specific owner.
    #[xmlserde(name = b"owner", ty = "attr")]
    pub owner: Option<String>,
    /// Frontend-runtime write policy. Stored as a string for forward
    /// compatibility: known values are "all", "ownerOnly", "ownerAndUser".
    /// Unknown or missing values are treated as "all" by the controller.
    #[xmlserde(name = b"modifyPolicy", ty = "attr")]
    pub modify_policy: Option<String>,
    /// What the block is for, in prose. Absent on blocks that never got one.
    #[xmlserde(name = b"description", ty = "attr")]
    pub description: Option<String>,
    /// Per-operation write policies, each `all|ownerOnly|ownerAndUser`. An
    /// absent attribute means the operation defers to `modify_policy`, which
    /// is what every block written before these existed does.
    #[xmlserde(name = b"permInsertDeleteLines", ty = "attr")]
    pub perm_insert_delete_lines: Option<String>,
    #[xmlserde(name = b"permRemoveBlock", ty = "attr")]
    pub perm_remove_block: Option<String>,
    #[xmlserde(name = b"permModifySchema", ty = "attr")]
    pub perm_modify_schema: Option<String>,
    #[xmlserde(name = b"permCellInput", ty = "attr")]
    pub perm_cell_input: Option<String>,
    #[xmlserde(name = b"permSortByField", ty = "attr")]
    pub perm_sort_by_field: Option<String>,
    #[xmlserde(name = b"permModifyDescription", ty = "attr")]
    pub perm_modify_description: Option<String>,
    #[xmlserde(name = b"permOverrideValidation", ty = "attr")]
    pub perm_override_validation: Option<String>,
    /// Which block this one analyses, when it is an analysis block. Absent for
    /// an ordinary block, which is every block written before this existed.
    /// Same sheet, so the id alone identifies it.
    #[xmlserde(name = b"analyzes", ty = "attr")]
    pub analyzes: Option<usize>,
    /// When the analysis block is a PIVOT, the recipe its cells and its shape
    /// derive from: the source fields whose distinct values become this
    /// block's rows and columns, and what is aggregated over them. Absent for
    /// a plain analysis block (a total row).
    ///
    /// Flat attributes rather than a child element, to match how the pivot
    /// crosses the wasm boundary — one shape to reason about, not two. Any of
    /// them missing, or a `pivotFunc` this build does not know, drops the
    /// pivot: the block opens as a plain analysis block rather than inventing
    /// an aggregate. See `design/block-pivot.md`.
    #[xmlserde(name = b"pivotRowDim", ty = "attr")]
    pub pivot_row_dim: Option<String>,
    #[xmlserde(name = b"pivotColDim", ty = "attr")]
    pub pivot_col_dim: Option<String>,
    #[xmlserde(name = b"pivotMeasure", ty = "attr")]
    pub pivot_measure: Option<String>,
    /// `SUM` | `COUNT` | `AVERAGE` | `MIN` | `MAX`.
    #[xmlserde(name = b"pivotFunc", ty = "attr")]
    pub pivot_func: Option<String>,
    /// `ascending` (default) | `firstSeen` | `custom`.
    #[xmlserde(name = b"pivotOrder", ty = "attr")]
    pub pivot_order: Option<String>,
    /// The sequence for `custom` order. A child element rather than a joined
    /// attribute because a dimension value can contain any character,
    /// including whatever separator a joined form would pick.
    #[xmlserde(name = b"pivotOrderValue", ty = "child")]
    pub pivot_order_values: Vec<PivotOrderValueXml>,
    /// Which source records the pivot counts. Same reasoning: the criteria is
    /// free text.
    #[xmlserde(name = b"pivotFilter", ty = "child")]
    pub pivot_filters: Vec<PivotFilterXml>,
    #[xmlserde(name = b"rowInfos", ty = "child")]
    pub row_infos: Vec<BlockLineInfo>,
    #[xmlserde(name = b"colInfos", ty = "child")]
    pub col_infos: Vec<BlockLineInfo>,
}

/// One value of a pivot's custom dimension order.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct PivotOrderValueXml {
    #[xmlserde(name = b"v", ty = "attr")]
    pub value: String,
}

/// One condition a source record must meet to be counted by a pivot.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct PivotFilterXml {
    #[xmlserde(name = b"field", ty = "attr")]
    pub field: String,
    /// Spreadsheet condition syntax, e.g. `>100` or `East`.
    #[xmlserde(name = b"criteria", ty = "attr")]
    pub criteria: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct BlockLineInfo {
    /// This line's own position within its block, along the block's axis
    /// (`<rowInfos>` count rows, `<colInfos>` count columns).
    ///
    /// Only the ANNOTATED lines are written, so without a position the
    /// restore is a positional zip against the block's full axis — correct
    /// only when every line happened to carry info, and silently wrong
    /// otherwise (metadata set on column 2 alone came back on column 0).
    /// Files written before this attribute existed have `None` and keep the
    /// old behaviour; see `file_loader`.
    #[xmlserde(name = b"line", ty = "attr")]
    pub line: Option<u32>,
    #[xmlserde(name = b"style", ty = "attr")]
    pub style: Option<u32>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"fieldId", ty = "attr")]
    pub field_id: String,
    #[xmlserde(name = b"diyRender", ty = "attr")]
    pub diy_render: Option<bool>,
}

/// Craft-authored metadata attached to one cell of a block.
///
/// Addressed by block id plus a BLOCK-RELATIVE offset, never by a sheet
/// coordinate: a block moves, and rows are inserted above it, so a saved
/// sheet coordinate would point somewhere else the next time the file opens.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CellAppendix {
    #[xmlserde(name = b"blockId", ty = "attr")]
    pub block_id: usize,
    #[xmlserde(name = b"rowIdx", ty = "attr")]
    pub row_idx: u32,
    #[xmlserde(name = b"colIdx", ty = "attr")]
    pub col_idx: u32,
    #[xmlserde(name = b"craftId", ty = "attr")]
    pub craft_id: String,
    #[xmlserde(name = b"content", ty = "text", default = "empty_text")]
    pub content: String,
    #[xmlserde(name = b"craftTag", ty = "attr")]
    pub craft_tag: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct Sheet {
    #[xmlserde(name = b"blockRange", ty = "child")]
    pub block_ranges: Vec<BlockRange>,
    #[xmlserde(name = b"cellAppendix", ty = "child")]
    pub cell_appendices: Vec<CellAppendix>,
    #[xmlserde(name = b"rowSchema", ty = "child")]
    pub row_schemas: Vec<RowSchemaXml>,
    #[xmlserde(name = b"colSchema", ty = "child")]
    pub col_schemas: Vec<ColSchemaXml>,
    #[xmlserde(name = b"randomSchema", ty = "child")]
    pub random_schemas: Vec<RandomSchemaXml>,
    /// Range links: a source range (facade the user references, e.g. `A1:D10`)
    /// redirected to a backing block. The block itself is a `blockRange` above;
    /// this records the source rectangle + target block id so the link is
    /// restored on load. See the controller's `range_manager::link`.
    #[xmlserde(name = b"linkRange", ty = "child")]
    pub link_ranges: Vec<LinkRangeXml>,
    /// Charts bound to a block rather than to fixed ranges. The chart part in
    /// the xlsx always holds real A1 ranges so Excel can draw it; this records
    /// what those ranges were derived *from*, so reopening in LogiSheets keeps
    /// the chart following the block instead of freezing it at the last save.
    #[xmlserde(name = b"chartSource", ty = "child")]
    pub chart_sources: Vec<ChartSourceXml>,
}

/// A chart's block binding: which block, which field labels the categories,
/// and which fields are plotted. Fields are named because that is the identity
/// the schema exposes and the one `#FIELD("qty")` formulas already use.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct ChartSourceXml {
    #[xmlserde(name = b"chartId", ty = "attr")]
    pub chart_id: String,
    #[xmlserde(name = b"blockId", ty = "attr")]
    pub block_id: usize,
    #[xmlserde(name = b"categoryField", ty = "attr")]
    pub category_field: Option<String>,
    /// Child elements rather than one delimited attribute: a field name is
    /// user-supplied text and may contain whatever separator we picked.
    #[xmlserde(name = b"valueField", ty = "child")]
    pub value_fields: Vec<ChartSourceFieldXml>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct ChartSourceFieldXml {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
}

fn default_zero_usize() -> usize {
    0
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct LinkRangeXml {
    #[xmlserde(name = b"blockId", ty = "attr")]
    pub block_id: usize,
    /// Sheet index holding the backing block (may differ from the source sheet —
    /// a cross-sheet link). Defaults to 0 for legacy files (same-sheet).
    #[xmlserde(name = b"blockSheetIdx", ty = "attr", default = "default_zero_usize")]
    pub block_sheet_idx: usize,
    #[xmlserde(name = b"startRow", ty = "attr")]
    pub start_row: usize,
    #[xmlserde(name = b"startCol", ty = "attr")]
    pub start_col: usize,
    #[xmlserde(name = b"endRow", ty = "attr")]
    pub end_row: usize,
    #[xmlserde(name = b"endCol", ty = "attr")]
    pub end_col: usize,
}

/// A form schema where data records run along rows. `key` is the column id
/// holding the record-identifying field; `fields` lists the per-column
/// field definitions in declared order.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct RowSchemaXml {
    #[xmlserde(name = b"blockId", ty = "attr")]
    pub block_id: usize,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    /// Stored as raw `u32` (a `RowId`/`ColId` typedef on the Rust side —
    /// both alias `u32`, so the serialized value is the same regardless
    /// of which alias is in the in-memory type).
    #[xmlserde(name = b"key", ty = "attr")]
    pub key: u32,
    /// The record-axis line holding field NAMES rather than a record, by its
    /// stable id. Absent for a schema that declares no header line, which is
    /// every schema written before this attribute existed — so an older file
    /// keeps meaning exactly what it meant.
    #[xmlserde(name = b"header", ty = "attr")]
    pub header: Option<u32>,
    #[xmlserde(name = b"field", ty = "child")]
    pub fields: Vec<SchemaFieldXml>,
}

/// Mirror of `RowSchemaXml` for column-oriented schemas. Identical wire
/// shape — distinct element name keeps Rust enum variant ↔ XML element
/// one-to-one so xmlserde maps cleanly without a discriminator attribute.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct ColSchemaXml {
    #[xmlserde(name = b"blockId", ty = "attr")]
    pub block_id: usize,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"key", ty = "attr")]
    pub key: u32,
    /// The record-axis line holding field NAMES rather than a record, by its
    /// stable id. Absent for a schema that declares no header line, which is
    /// every schema written before this attribute existed — so an older file
    /// keeps meaning exactly what it meant.
    #[xmlserde(name = b"header", ty = "attr")]
    pub header: Option<u32>,
    #[xmlserde(name = b"field", ty = "child")]
    pub fields: Vec<SchemaFieldXml>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct SchemaFieldXml {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    /// Per-field axis id. For RowSchema this is a `ColId`; for ColSchema
    /// a `RowId`. Both are `u32` typedefs.
    #[xmlserde(name = b"axisId", ty = "attr")]
    pub axis_id: u32,
    #[xmlserde(name = b"renderId", ty = "attr")]
    pub render_id: String,
    /// Formulas are stored as attributes (rather than child elements) so
    /// the existing `Option<String>` xmlserde attr support handles them
    /// uniformly. They may contain `"`, `<`, `>` etc. — xmlserde escapes
    /// these on save and unescapes on load.
    #[xmlserde(name = b"valueFormula", ty = "attr")]
    pub value_formula: Option<String>,
    #[xmlserde(name = b"validationFormula", ty = "attr")]
    pub validation_formula: Option<String>,
    #[xmlserde(name = b"editabilityFormula", ty = "attr")]
    pub editability_formula: Option<String>,
    /// The field's *declaration* — what it is and what it is for — as opposed
    /// to the templates above, which are what currently guards it.
    ///
    /// Every one of these is optional, and absent means "nobody said". A file
    /// written before the declaration existed loads with an unspecified type
    /// and both constraints off, which is exactly what it meant. `kind` is a
    /// free string rather than a closed set on purpose: a kind a newer build
    /// introduced must not stop this one from opening the file — the reader
    /// degrades it to unspecified.
    #[xmlserde(name = b"kind", ty = "attr")]
    pub kind: Option<String>,
    /// Enum set backing a `kind` of `enum` / `multiSelect`.
    #[xmlserde(name = b"enumSetId", ty = "attr")]
    pub enum_set_id: Option<String>,
    /// Target of a `kind` of `fieldRef` / `multiSelectRef`.
    #[xmlserde(name = b"refSheetId", ty = "attr")]
    pub ref_sheet_id: Option<u32>,
    #[xmlserde(name = b"refBlockId", ty = "attr")]
    pub ref_block_id: Option<u32>,
    #[xmlserde(name = b"refFieldName", ty = "attr")]
    pub ref_field_name: Option<String>,
    #[xmlserde(name = b"description", ty = "attr")]
    pub description: Option<String>,
    /// Written only when true, so an ordinary field costs no attribute.
    #[xmlserde(name = b"required", ty = "attr")]
    pub required: Option<bool>,
    #[xmlserde(name = b"unique", ty = "attr")]
    pub unique: Option<bool>,
    #[xmlserde(name = b"defaultValue", ty = "attr")]
    pub default_value: Option<String>,
    /// Who may write to this field's cells: `inherit` (absent) | `ownerOnly` |
    /// `anyone`. A free string for the same reason `kind` is — a policy a newer
    /// build introduces must not stop this one from opening the file.
    #[xmlserde(name = b"writePolicy", ty = "attr")]
    pub write_policy: Option<String>,
    /// When the block analyses another one: how this field aggregates it.
    /// `aggFunc` is `SUM|COUNT|AVERAGE|MIN|MAX`, `aggField` the field of the
    /// analysed block. Both absent for an ordinary field.
    ///
    /// A free string for the same reason `kind` is: a function a newer build
    /// introduces must not stop this one from opening the file.
    #[xmlserde(name = b"aggFunc", ty = "attr")]
    pub agg_func: Option<String>,
    #[xmlserde(name = b"aggField", ty = "attr")]
    pub agg_field: Option<String>,
    /// When the block is a PIVOT and this column is hand-declared rather than
    /// derived: which column-dimension value it filters on (`*` = every value,
    /// i.e. a row total), and optionally its own measure and function.
    ///
    /// All absent for an ordinary derived column, which is every column of a
    /// plain cross-tab.
    #[xmlserde(name = b"pivotColValue", ty = "attr")]
    pub pivot_col_value: Option<String>,
    #[xmlserde(name = b"pivotMeasure", ty = "attr")]
    pub pivot_measure: Option<String>,
    #[xmlserde(name = b"pivotFunc", ty = "attr")]
    pub pivot_func: Option<String>,
}

/// A free-form schema: explicit `(key, row, col, renderId)` tuples with no
/// axis alignment. `block_id` plus `name` are the identifying attributes
/// matching `RandomSchema`'s in-memory shape.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct RandomSchemaXml {
    #[xmlserde(name = b"blockId", ty = "attr")]
    pub block_id: usize,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"keyField", ty = "child")]
    pub key_fields: Vec<RandomKeyFieldXml>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct RandomKeyFieldXml {
    #[xmlserde(name = b"key", ty = "attr")]
    pub key: String,
    #[xmlserde(name = b"row", ty = "attr")]
    pub row: u32,
    #[xmlserde(name = b"col", ty = "attr")]
    pub col: u32,
    #[xmlserde(name = b"renderId", ty = "attr")]
    pub render_id: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Clone, TS)]
#[ts(file_name = "app_data.ts")]
pub struct AppData {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"data", ty = "text", default = "empty_text")]
    pub data: String,
}
