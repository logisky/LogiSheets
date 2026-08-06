//! Table part (`CT_Table`, §18.5.1.2) — an Excel structured table / `ListObject`.
//! Stored at `xl/tables/tableN.xml` and referenced from a worksheet's rels (with
//! the matching `r:id` listed in the worksheet's `<tableParts>`).
//!
//! `xmlColumnPr` (XML-mapping metadata, rare) is preserved verbatim as
//! `Option<Unparsed>` rather than structurally modeled.

use xmlserde::Unparsed;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

use super::complex_types::{CtAutoFilter, CtSortState};
use super::defaults::{default_false, default_one_u32, default_true, default_zero_u32};
use super::simple_types::{StTableType, StTotalsRowFunction};

#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
#[xmlserde(root = b"table")]
pub struct Table {
    #[xmlserde(name = b"autoFilter", ty = "child")]
    pub auto_filter: Option<CtAutoFilter>,
    #[xmlserde(name = b"sortState", ty = "child")]
    pub sort_state: Option<CtSortState>,
    #[xmlserde(name = b"tableColumns", ty = "child")]
    pub table_columns: CtTableColumns,
    #[xmlserde(name = b"tableStyleInfo", ty = "child")]
    pub table_style_info: Option<CtTableStyleInfo>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,

    #[xmlserde(name = b"id", ty = "attr")]
    pub id: u32,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"displayName", ty = "attr")]
    pub display_name: String,
    #[xmlserde(name = b"comment", ty = "attr")]
    pub comment: Option<String>,
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: String,
    #[xmlserde(name = b"tableType", ty = "attr")]
    pub table_type: Option<StTableType>,
    #[xmlserde(name = b"headerRowCount", ty = "attr", default = "default_one_u32")]
    pub header_row_count: u32,
    #[xmlserde(name = b"insertRow", ty = "attr", default = "default_false")]
    pub insert_row: bool,
    #[xmlserde(name = b"insertRowShift", ty = "attr", default = "default_false")]
    pub insert_row_shift: bool,
    #[xmlserde(name = b"totalsRowCount", ty = "attr", default = "default_zero_u32")]
    pub totals_row_count: u32,
    #[xmlserde(name = b"totalsRowShown", ty = "attr", default = "default_true")]
    pub totals_row_shown: bool,
    #[xmlserde(name = b"published", ty = "attr", default = "default_false")]
    pub published: bool,
    #[xmlserde(name = b"headerRowDxfId", ty = "attr")]
    pub header_row_dxf_id: Option<u32>,
    #[xmlserde(name = b"dataDxfId", ty = "attr")]
    pub data_dxf_id: Option<u32>,
    #[xmlserde(name = b"totalsRowDxfId", ty = "attr")]
    pub totals_row_dxf_id: Option<u32>,
    #[xmlserde(name = b"headerRowBorderDxfId", ty = "attr")]
    pub header_row_border_dxf_id: Option<u32>,
    #[xmlserde(name = b"tableBorderDxfId", ty = "attr")]
    pub table_border_dxf_id: Option<u32>,
    #[xmlserde(name = b"totalsRowBorderDxfId", ty = "attr")]
    pub totals_row_border_dxf_id: Option<u32>,
    #[xmlserde(name = b"headerRowCellStyle", ty = "attr")]
    pub header_row_cell_style: Option<String>,
    #[xmlserde(name = b"dataCellStyle", ty = "attr")]
    pub data_cell_style: Option<String>,
    #[xmlserde(name = b"totalsRowCellStyle", ty = "attr")]
    pub totals_row_cell_style: Option<String>,
    #[xmlserde(name = b"connectionId", ty = "attr")]
    pub connection_id: Option<u32>,
}

/// CT_TableColumns (§18.5.1.4).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtTableColumns {
    #[xmlserde(name = b"tableColumn", ty = "child", vec_size = "count")]
    pub table_column: Vec<CtTableColumn>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_TableColumn (§18.5.1.3).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtTableColumn {
    #[xmlserde(name = b"calculatedColumnFormula", ty = "child")]
    pub calculated_column_formula: Option<CtTableFormula>,
    #[xmlserde(name = b"totalsRowFormula", ty = "child")]
    pub totals_row_formula: Option<CtTableFormula>,
    #[xmlserde(name = b"xmlColumnPr", ty = "child")]
    pub xml_column_pr: Option<Unparsed>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,

    #[xmlserde(name = b"id", ty = "attr")]
    pub id: u32,
    #[xmlserde(name = b"uniqueName", ty = "attr")]
    pub unique_name: Option<String>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"totalsRowFunction", ty = "attr")]
    pub totals_row_function: Option<StTotalsRowFunction>,
    #[xmlserde(name = b"totalsRowLabel", ty = "attr")]
    pub totals_row_label: Option<String>,
    #[xmlserde(name = b"queryTableFieldId", ty = "attr")]
    pub query_table_field_id: Option<u32>,
    #[xmlserde(name = b"headerRowDxfId", ty = "attr")]
    pub header_row_dxf_id: Option<u32>,
    #[xmlserde(name = b"dataDxfId", ty = "attr")]
    pub data_dxf_id: Option<u32>,
    #[xmlserde(name = b"totalsRowDxfId", ty = "attr")]
    pub totals_row_dxf_id: Option<u32>,
    #[xmlserde(name = b"headerRowCellStyle", ty = "attr")]
    pub header_row_cell_style: Option<String>,
    #[xmlserde(name = b"dataCellStyle", ty = "attr")]
    pub data_cell_style: Option<String>,
    #[xmlserde(name = b"totalsRowCellStyle", ty = "attr")]
    pub totals_row_cell_style: Option<String>,
}

/// CT_TableFormula (§18.5.1.6) — a calculated-column or totals-row formula. The
/// formula text is the element's content.
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtTableFormula {
    #[xmlserde(ty = "text")]
    pub formula: String,
    #[xmlserde(name = b"array", ty = "attr", default = "default_false")]
    pub array: bool,
}

/// CT_TableStyleInfo (§18.5.1.5).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtTableStyleInfo {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"showFirstColumn", ty = "attr", default = "default_false")]
    pub show_first_column: bool,
    #[xmlserde(name = b"showLastColumn", ty = "attr", default = "default_false")]
    pub show_last_column: bool,
    #[xmlserde(name = b"showRowStripes", ty = "attr", default = "default_false")]
    pub show_row_stripes: bool,
    #[xmlserde(name = b"showColumnStripes", ty = "attr", default = "default_false")]
    pub show_column_stripes: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{xml_deserialize_from_str, xml_serialize_with_decl};

    #[test]
    fn round_trip() {
        let xml = include_str!("../../examples/table.xml");
        let t = xml_deserialize_from_str::<Table>(xml).expect("deserialize");
        assert_eq!(t.display_name, "Table1");
        assert_eq!(t.reference, "A1:C4");
        assert_eq!(t.table_columns.count, 3);
        assert_eq!(t.table_columns.table_column.len(), 3);
        assert_eq!(t.table_columns.table_column[0].name, "Region");
        assert_eq!(t.totals_row_count, 1);
        let total = &t.table_columns.table_column[2];
        assert!(matches!(
            total.totals_row_function,
            Some(StTotalsRowFunction::Sum)
        ));
        let style = t.table_style_info.as_ref().unwrap();
        assert_eq!(style.name.as_deref(), Some("TableStyleMedium2"));

        let out = xml_serialize_with_decl(t);
        let t2 = xml_deserialize_from_str::<Table>(&out).expect("re-deserialize");
        assert_eq!(t2.table_columns.table_column.len(), 3);
        assert_eq!(t2.display_name, "Table1");
    }
}
