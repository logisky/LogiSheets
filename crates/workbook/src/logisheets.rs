use gents_derives::TS;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

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
    #[xmlserde(name = b"rowInfos", ty = "child")]
    pub row_infos: Vec<BlockLineInfo>,
    #[xmlserde(name = b"colInfos", ty = "child")]
    pub col_infos: Vec<BlockLineInfo>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct BlockLineInfo {
    #[xmlserde(name = b"style", ty = "attr")]
    pub style: Option<u32>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"fieldId", ty = "attr")]
    pub field_id: String,
    #[xmlserde(name = b"diyRender", ty = "attr")]
    pub diy_render: Option<bool>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CellAppendix {
    #[xmlserde(name = b"rowIdx", ty = "attr")]
    pub row_idx: u32,
    #[xmlserde(name = b"colIdx", ty = "attr")]
    pub col_idx: u32,
    #[xmlserde(name = b"craftId", ty = "attr")]
    pub craft_id: String,
    #[xmlserde(name = b"content", ty = "text")]
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
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct LinkRangeXml {
    #[xmlserde(name = b"blockId", ty = "attr")]
    pub block_id: usize,
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
    #[xmlserde(name = b"data", ty = "text")]
    pub data: String,
}
