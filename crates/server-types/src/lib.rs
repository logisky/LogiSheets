use gents_derives::TS;
use logisheets_controller::{ReproducibleCell, Value};

/// Represents a comprehensive blueprint for a craft, capturing its structure, visual characteristics,
/// and operational logic. This descriptor enables others to faithfully reconstruct or reproduce the
/// original craft by providing all necessary details about its design and functionality.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "craft_descriptor.ts", rename_all = "camelCase")]
pub struct CraftDescriptor {
    /// The user id of the author
    /// The author has the permission to fetch the data from all users,
    /// while other users can only fetch their own data.
    pub author_id: String,
    pub data_area: DataArea,
    pub data_port: Option<DataPort>,

    pub workbook_part: Option<WorkbookPart>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "data_area.ts", rename_all = "camelCase")]
pub struct DataArea {
    pub direction: Direction,
    pub start_row: usize,
    pub start_col: usize,
    // Optional end row and column, if not specified,
    // the data area extends to the end of the craft
    pub end_row: Option<usize>,
    pub end_col: Option<usize>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "direction.ts", rename_all = "camelCase")]
pub enum Direction {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "data_port.ts", rename_all = "camelCase")]
pub struct DataPort {
    pub base_url: String,
    pub identifier: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "workbook_part.ts", rename_all = "camelCase")]
pub struct WorkbookPart {
    pub cells: Vec<ReproducibleCell>,
    pub row_count: usize,
    pub col_count: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "craft_data.ts", rename_all = "camelCase")]
pub struct CraftData {
    pub values: Vec<CraftValue>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "craft_value.ts", rename_all = "camelCase")]
pub struct CraftValue {
    pub key: String,
    pub field: String,
    pub value: Value,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "resp.ts", rename_all = "camelCase")]
pub struct Resp<T> {
    pub data: Option<T>,
    // Http status code
    pub status_code: u16,
    pub message: Option<String>,
}

#[test]
fn serde_test() {
    let data_area = DataArea {
        direction: Direction::Horizontal,
        start_row: 0,
        start_col: 0,
        end_row: None,
        end_col: None,
    };
    let json = serde_json::to_string(&data_area).unwrap();
    assert_eq!(
        json,
        r#"{"direction":"horizontal","startRow":0,"startCol":0}"#
    );
}
