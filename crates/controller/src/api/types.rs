use crate::{Style, Value};

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "save_file_result.ts")
)]
pub struct SaveFileResult {
    pub data: Vec<u8>,
    pub code: u8,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_info.ts")
)]
pub struct CellInfo {
    pub value: Value,
    pub formula: String,
    pub style: Style,
}
