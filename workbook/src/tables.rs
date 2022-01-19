use crate::complex_types::*;
use crate::defaults::*;
use crate::simple_types::*;
use crate::xml_element::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "table")]
pub struct TablePart {
    pub auto_filter: Option<AutoFilter>,
    pub sort_state: Option<SortState>,
    pub table_columns: TableColumns,
    pub table_style_info: Option<TableStyleInfo>,
    pub ext_lst: Option<ExtLst>,
    pub id: u32,
    pub name: Option<String>,
    pub display_name: String,
    pub comment: Option<String>,
    #[serde(rename = "ref")]
    pub reference: Option<StRef>,
    #[serde(default = "StTableType::DefaultBuilder::Worksheet")]
    pub table_type: StTableType::Type,
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub header_row_count: u32,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub insert_row: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub insert_row_shift: bool,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub total_row_count: u32,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub total_row_shown: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub published: bool,
    pub header_row_dxf_id: Option<StDxfId>,
    pub data_dxf_id: Option<StDxfId>,
    pub totals_row_dxf_id: Option<StDxfId>,
    pub header_row_border_dxf_id: Option<StDxfId>,
    pub table_border_dxf_id: Option<StDxfId>,
    pub totals_row_border_dxf_id: Option<StDxfId>,
    pub header_row_cell_style: Option<String>,
    pub data_cell_style: Option<String>,
    pub totals_row_cell_style: Option<String>,
    pub connection_id: Option<u32>,
}

impl OpenXmlElementInfo for TablePart {
    fn tag_name() -> &'static str {
        "table"
    }
}

impl OpenXmlDeserializeDefault for TablePart {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableColumns")]
pub struct TableColumns {
    // At least 1 element
    pub table_column: Vec<TableColumn>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableStyleInfo")]
pub struct TableStyleInfo {
    pub name: Option<String>,
    pub show_first_column: Option<bool>,
    pub show_last_column: Option<bool>,
    pub show_row_stripes: Option<bool>,
    pub show_column_stripes: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableColumn")]
pub struct TableColumn {
    pub calculated_column_formula: Option<TableFormula>,
    pub total_row_formula: Option<TableFormula>,
    pub xml_column_pr: Option<XmlColumnPr>,
    pub ext_lst: Option<ExtLst>,
    pub id: u32,
    pub unique_name: Option<String>,
    pub name: String,
    #[serde(default = "StTotalsRowFunction::DefaultBuilder::None")]
    pub totals_row_function: StTotalsRowFunction::Type,
    pub totals_row_label: Option<String>,
    pub query_table_field_id: Option<u32>,
    pub header_row_dxf_id: Option<StDxfId>,
    pub data_dxf_id: Option<StDxfId>,
    pub totals_row_dxf_id: Option<StDxfId>,
    pub header_row_cell_style: Option<String>,
    pub data_cell_style: Option<String>,
    pub totals_row_cell_style: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "xmlColumnPr")]
pub struct XmlColumnPr {
    pub ext_lst: Option<ExtLst>,
    pub map_id: u32,
    pub xpath: String,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub denormalized: bool,
    pub xml_data_type: StXmlDataType,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableFormula")]
pub struct TableFormula {
    #[serde(rename = "$value")]
    pub body: String,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub array: bool,
}
