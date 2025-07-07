use logisheets_controller::{Appendix, Style, Value};

/// Represents a comprehensive blueprint for a craft, capturing its structure, visual characteristics,
/// and operational logic. This descriptor enables others to faithfully reconstruct or reproduce the
/// original craft by providing all necessary details about its design and functionality.
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "craft_descriptor.ts")
)]
#[derive(Debug, Clone)]
pub struct CraftDescriptor {
    pub data_area: DataArea,
    pub data_port: Option<DataPort>,

    pub workbook_part: Option<WorkbookPart>,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "data_area.ts")
)]
#[derive(Debug, Clone)]
pub struct DataArea {
    pub direction: Direction,
    pub start_row: usize,
    pub start_col: usize,
    // Optional end row and column, if not specified,
    // the data area extends to the end of the craft
    pub end_row: Option<usize>,
    pub end_col: Option<usize>,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "direction.ts")
)]
#[derive(Debug, Clone)]
pub enum Direction {
    Horizontal,
    Vertical,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "data_port.ts")
)]
#[derive(Debug, Clone)]
pub struct DataPort {
    pub base_url: String,
    pub identifier: String,
}

#[cfg_attr(feature = "gents", gents_derives::gents_header(file_name = "cell.ts"))]
#[derive(Debug, Clone)]
pub struct Cell {
    pub row: usize,
    pub col: usize,
    pub formula: Option<String>,
    pub value: Option<Value>,
    pub style: Option<Style>,
    pub appendix: Option<Appendix>,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "workbook_part.ts")
)]
#[derive(Debug, Clone)]
pub struct WorkbookPart {
    pub cells: Vec<Cell>,
    pub row_count: usize,
    pub col_count: usize,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "craft_data.ts")
)]
#[derive(Debug, Clone)]
pub struct CraftData {
    pub keys: Vec<String>,
    pub fields: Vec<String>,
    pub values: Vec<String>,
}
