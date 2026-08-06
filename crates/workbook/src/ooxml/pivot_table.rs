//! pivotTableDefinition part (§18.10.1.68, CT_pivotTableDefinition) — the layout
//! and formatting of a pivot table. Stored at `xl/pivotTables/pivotTableN.xml`.
//!
//! Server/OLAP-only or chart-only subtrees (chartFormats, pivotHierarchies,
//! row/colHierarchiesUsage, and a pivot filter's embedded autoFilter) are
//! preserved verbatim as `Unparsed` rather than structurally modeled; they still
//! round-trip untouched.

use xmlserde::Unparsed;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

use super::defaults::{
    default_false, default_one_u32, default_ten_u32, default_true, default_zero_i32,
    default_zero_u32, default_zero_u8, st_data_consolidate_function_sum,
    st_field_sort_type_manual, st_format_action_formatting, st_item_type_data,
    st_scope_selection, st_show_data_as_normal,
};
use super::complex_types::CtPivotArea;
use super::pivot_shared::CtX;
use super::simple_types::{
    StAxis, StDataConsolidateFunction, StFieldSortType, StFormatAction, StItemType, StScope,
    StShowDataAs,
};

#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
#[xmlserde(root = b"pivotTableDefinition")]
pub struct PivotTableDefinition {
    #[xmlserde(name = b"location", ty = "child")]
    pub location: CtLocation,
    #[xmlserde(name = b"pivotFields", ty = "child")]
    pub pivot_fields: Option<CtPivotFields>,
    #[xmlserde(name = b"rowFields", ty = "child")]
    pub row_fields: Option<CtRowColFields>,
    #[xmlserde(name = b"rowItems", ty = "child")]
    pub row_items: Option<CtRowColItems>,
    #[xmlserde(name = b"colFields", ty = "child")]
    pub col_fields: Option<CtRowColFields>,
    #[xmlserde(name = b"colItems", ty = "child")]
    pub col_items: Option<CtRowColItems>,
    #[xmlserde(name = b"pageFields", ty = "child")]
    pub page_fields: Option<CtPageFields>,
    #[xmlserde(name = b"dataFields", ty = "child")]
    pub data_fields: Option<CtDataFields>,
    #[xmlserde(name = b"formats", ty = "child")]
    pub formats: Option<CtFormats>,
    #[xmlserde(name = b"conditionalFormats", ty = "child")]
    pub conditional_formats: Option<CtConditionalFormats>,
    #[xmlserde(name = b"chartFormats", ty = "child")]
    pub chart_formats: Option<Unparsed>,
    #[xmlserde(name = b"pivotHierarchies", ty = "child")]
    pub pivot_hierarchies: Option<Unparsed>,
    #[xmlserde(name = b"pivotTableStyleInfo", ty = "child")]
    pub pivot_table_style_info: Option<CtPivotTableStyle>,
    #[xmlserde(name = b"filters", ty = "child")]
    pub filters: Option<CtPivotFilters>,
    #[xmlserde(name = b"rowHierarchiesUsage", ty = "child")]
    pub row_hierarchies_usage: Option<Unparsed>,
    #[xmlserde(name = b"colHierarchiesUsage", ty = "child")]
    pub col_hierarchies_usage: Option<Unparsed>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,

    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"cacheId", ty = "attr")]
    pub cache_id: u32,
    #[xmlserde(name = b"dataOnRows", ty = "attr", default = "default_false")]
    pub data_on_rows: bool,
    #[xmlserde(name = b"dataPosition", ty = "attr")]
    pub data_position: Option<u32>,
    #[xmlserde(name = b"dataCaption", ty = "attr")]
    pub data_caption: String,
    #[xmlserde(name = b"grandTotalCaption", ty = "attr")]
    pub grand_total_caption: Option<String>,
    #[xmlserde(name = b"errorCaption", ty = "attr")]
    pub error_caption: Option<String>,
    #[xmlserde(name = b"showError", ty = "attr", default = "default_false")]
    pub show_error: bool,
    #[xmlserde(name = b"missingCaption", ty = "attr")]
    pub missing_caption: Option<String>,
    #[xmlserde(name = b"showMissing", ty = "attr", default = "default_true")]
    pub show_missing: bool,
    #[xmlserde(name = b"pageStyle", ty = "attr")]
    pub page_style: Option<String>,
    #[xmlserde(name = b"pivotTableStyle", ty = "attr")]
    pub pivot_table_style: Option<String>,
    #[xmlserde(name = b"vacatedStyle", ty = "attr")]
    pub vacated_style: Option<String>,
    #[xmlserde(name = b"tag", ty = "attr")]
    pub tag: Option<String>,
    #[xmlserde(name = b"updatedVersion", ty = "attr", default = "default_zero_u8")]
    pub updated_version: u8,
    #[xmlserde(
        name = b"minRefreshableVersion",
        ty = "attr",
        default = "default_zero_u8"
    )]
    pub min_refreshable_version: u8,
    #[xmlserde(name = b"asteriskTotals", ty = "attr", default = "default_false")]
    pub asterisk_totals: bool,
    #[xmlserde(name = b"showItems", ty = "attr", default = "default_true")]
    pub show_items: bool,
    #[xmlserde(name = b"editData", ty = "attr", default = "default_false")]
    pub edit_data: bool,
    #[xmlserde(name = b"disableFieldList", ty = "attr", default = "default_false")]
    pub disable_field_list: bool,
    #[xmlserde(name = b"showCalcMbrs", ty = "attr", default = "default_true")]
    pub show_calc_mbrs: bool,
    #[xmlserde(name = b"visualTotals", ty = "attr", default = "default_true")]
    pub visual_totals: bool,
    #[xmlserde(name = b"showMultipleLabel", ty = "attr", default = "default_true")]
    pub show_multiple_label: bool,
    #[xmlserde(name = b"showDataDropDown", ty = "attr", default = "default_true")]
    pub show_data_drop_down: bool,
    #[xmlserde(name = b"showDrill", ty = "attr", default = "default_true")]
    pub show_drill: bool,
    #[xmlserde(name = b"printDrill", ty = "attr", default = "default_false")]
    pub print_drill: bool,
    #[xmlserde(
        name = b"showMemberPropertyTips",
        ty = "attr",
        default = "default_true"
    )]
    pub show_member_property_tips: bool,
    #[xmlserde(name = b"showDataTips", ty = "attr", default = "default_true")]
    pub show_data_tips: bool,
    #[xmlserde(name = b"enableWizard", ty = "attr", default = "default_true")]
    pub enable_wizard: bool,
    #[xmlserde(name = b"enableDrill", ty = "attr", default = "default_true")]
    pub enable_drill: bool,
    #[xmlserde(name = b"enableFieldProperties", ty = "attr", default = "default_true")]
    pub enable_field_properties: bool,
    #[xmlserde(name = b"preserveFormatting", ty = "attr", default = "default_true")]
    pub preserve_formatting: bool,
    #[xmlserde(name = b"useAutoFormatting", ty = "attr", default = "default_false")]
    pub use_auto_formatting: bool,
    #[xmlserde(name = b"pageWrap", ty = "attr", default = "default_zero_u32")]
    pub page_wrap: u32,
    #[xmlserde(name = b"pageOverThenDown", ty = "attr", default = "default_false")]
    pub page_over_then_down: bool,
    #[xmlserde(name = b"subtotalHiddenItems", ty = "attr", default = "default_false")]
    pub subtotal_hidden_items: bool,
    #[xmlserde(name = b"rowGrandTotals", ty = "attr", default = "default_true")]
    pub row_grand_totals: bool,
    #[xmlserde(name = b"colGrandTotals", ty = "attr", default = "default_true")]
    pub col_grand_totals: bool,
    #[xmlserde(name = b"fieldPrintTitles", ty = "attr", default = "default_false")]
    pub field_print_titles: bool,
    #[xmlserde(name = b"itemPrintTitles", ty = "attr", default = "default_false")]
    pub item_print_titles: bool,
    #[xmlserde(name = b"mergeItem", ty = "attr", default = "default_false")]
    pub merge_item: bool,
    #[xmlserde(name = b"showDropZones", ty = "attr", default = "default_true")]
    pub show_drop_zones: bool,
    #[xmlserde(name = b"createdVersion", ty = "attr", default = "default_zero_u8")]
    pub created_version: u8,
    #[xmlserde(name = b"indent", ty = "attr", default = "default_one_u32")]
    pub indent: u32,
    #[xmlserde(name = b"showEmptyRow", ty = "attr", default = "default_false")]
    pub show_empty_row: bool,
    #[xmlserde(name = b"showEmptyCol", ty = "attr", default = "default_false")]
    pub show_empty_col: bool,
    #[xmlserde(name = b"showHeaders", ty = "attr", default = "default_true")]
    pub show_headers: bool,
    #[xmlserde(name = b"compact", ty = "attr", default = "default_true")]
    pub compact: bool,
    #[xmlserde(name = b"outline", ty = "attr", default = "default_false")]
    pub outline: bool,
    #[xmlserde(name = b"outlineData", ty = "attr", default = "default_false")]
    pub outline_data: bool,
    #[xmlserde(name = b"compactData", ty = "attr", default = "default_true")]
    pub compact_data: bool,
    #[xmlserde(name = b"published", ty = "attr", default = "default_false")]
    pub published: bool,
    #[xmlserde(name = b"gridDropZones", ty = "attr", default = "default_false")]
    pub grid_drop_zones: bool,
    #[xmlserde(name = b"immersive", ty = "attr", default = "default_true")]
    pub immersive: bool,
    #[xmlserde(name = b"multipleFieldFilters", ty = "attr", default = "default_true")]
    pub multiple_field_filters: bool,
    #[xmlserde(name = b"chartFormat", ty = "attr", default = "default_zero_u32")]
    pub chart_format: u32,
    #[xmlserde(name = b"rowHeaderCaption", ty = "attr")]
    pub row_header_caption: Option<String>,
    #[xmlserde(name = b"colHeaderCaption", ty = "attr")]
    pub col_header_caption: Option<String>,
    #[xmlserde(
        name = b"fieldListSortAscending",
        ty = "attr",
        default = "default_false"
    )]
    pub field_list_sort_ascending: bool,
    #[xmlserde(name = b"mdxSubqueries", ty = "attr", default = "default_false")]
    pub mdx_subqueries: bool,
    #[xmlserde(name = b"customListSort", ty = "attr", default = "default_true")]
    pub custom_list_sort: bool,
    #[xmlserde(name = b"autoFormatId", ty = "attr")]
    pub auto_format_id: Option<u32>,
    #[xmlserde(name = b"applyNumberFormats", ty = "attr", default = "default_false")]
    pub apply_number_formats: bool,
    #[xmlserde(name = b"applyBorderFormats", ty = "attr", default = "default_false")]
    pub apply_border_formats: bool,
    #[xmlserde(name = b"applyFontFormats", ty = "attr", default = "default_false")]
    pub apply_font_formats: bool,
    #[xmlserde(name = b"applyPatternFormats", ty = "attr", default = "default_false")]
    pub apply_pattern_formats: bool,
    #[xmlserde(
        name = b"applyAlignmentFormats",
        ty = "attr",
        default = "default_false"
    )]
    pub apply_alignment_formats: bool,
    #[xmlserde(
        name = b"applyWidthHeightFormats",
        ty = "attr",
        default = "default_false"
    )]
    pub apply_width_height_formats: bool,
}

/// CT_Location (§18.10.1.49).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtLocation {
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: String,
    #[xmlserde(name = b"firstHeaderRow", ty = "attr")]
    pub first_header_row: u32,
    #[xmlserde(name = b"firstDataRow", ty = "attr")]
    pub first_data_row: u32,
    #[xmlserde(name = b"firstDataCol", ty = "attr")]
    pub first_data_col: u32,
    #[xmlserde(name = b"rowPageCount", ty = "attr", default = "default_zero_u32")]
    pub row_page_count: u32,
    #[xmlserde(name = b"colPageCount", ty = "attr", default = "default_zero_u32")]
    pub col_page_count: u32,
}

/// CT_PivotFields (§18.10.1.70).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPivotFields {
    #[xmlserde(name = b"pivotField", ty = "child", vec_size = "count")]
    pub pivot_field: Vec<CtPivotField>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_PivotField (§18.10.1.69).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPivotField {
    #[xmlserde(name = b"items", ty = "child")]
    pub items: Option<CtItems>,
    #[xmlserde(name = b"autoSortScope", ty = "child")]
    pub auto_sort_scope: Option<CtAutoSortScope>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"axis", ty = "attr")]
    pub axis: Option<StAxis>,
    #[xmlserde(name = b"dataField", ty = "attr", default = "default_false")]
    pub data_field: bool,
    #[xmlserde(name = b"subtotalCaption", ty = "attr")]
    pub subtotal_caption: Option<String>,
    #[xmlserde(name = b"showDropDowns", ty = "attr", default = "default_true")]
    pub show_drop_downs: bool,
    #[xmlserde(name = b"hiddenLevel", ty = "attr", default = "default_false")]
    pub hidden_level: bool,
    #[xmlserde(name = b"uniqueMemberProperty", ty = "attr")]
    pub unique_member_property: Option<String>,
    #[xmlserde(name = b"compact", ty = "attr", default = "default_true")]
    pub compact: bool,
    #[xmlserde(name = b"allDrilled", ty = "attr", default = "default_false")]
    pub all_drilled: bool,
    #[xmlserde(name = b"numFmtId", ty = "attr")]
    pub num_fmt_id: Option<u32>,
    #[xmlserde(name = b"outline", ty = "attr", default = "default_true")]
    pub outline: bool,
    #[xmlserde(name = b"subtotalTop", ty = "attr", default = "default_true")]
    pub subtotal_top: bool,
    #[xmlserde(name = b"dragToRow", ty = "attr", default = "default_true")]
    pub drag_to_row: bool,
    #[xmlserde(name = b"dragToCol", ty = "attr", default = "default_true")]
    pub drag_to_col: bool,
    #[xmlserde(
        name = b"multipleItemSelectionAllowed",
        ty = "attr",
        default = "default_false"
    )]
    pub multiple_item_selection_allowed: bool,
    #[xmlserde(name = b"dragToPage", ty = "attr", default = "default_true")]
    pub drag_to_page: bool,
    #[xmlserde(name = b"dragToData", ty = "attr", default = "default_true")]
    pub drag_to_data: bool,
    #[xmlserde(name = b"dragOff", ty = "attr", default = "default_true")]
    pub drag_off: bool,
    #[xmlserde(name = b"showAll", ty = "attr", default = "default_true")]
    pub show_all: bool,
    #[xmlserde(name = b"insertBlankRow", ty = "attr", default = "default_false")]
    pub insert_blank_row: bool,
    #[xmlserde(name = b"serverField", ty = "attr", default = "default_false")]
    pub server_field: bool,
    #[xmlserde(name = b"insertPageBreak", ty = "attr", default = "default_false")]
    pub insert_page_break: bool,
    #[xmlserde(name = b"autoShow", ty = "attr", default = "default_false")]
    pub auto_show: bool,
    #[xmlserde(name = b"topAutoShow", ty = "attr", default = "default_true")]
    pub top_auto_show: bool,
    #[xmlserde(name = b"hideNewItems", ty = "attr", default = "default_false")]
    pub hide_new_items: bool,
    #[xmlserde(name = b"measureFilter", ty = "attr", default = "default_false")]
    pub measure_filter: bool,
    #[xmlserde(
        name = b"includeNewItemsInFilter",
        ty = "attr",
        default = "default_false"
    )]
    pub include_new_items_in_filter: bool,
    #[xmlserde(name = b"itemPageCount", ty = "attr", default = "default_ten_u32")]
    pub item_page_count: u32,
    #[xmlserde(name = b"sortType", ty = "attr", default = "st_field_sort_type_manual")]
    pub sort_type: StFieldSortType,
    #[xmlserde(name = b"dataSourceSort", ty = "attr")]
    pub data_source_sort: Option<bool>,
    #[xmlserde(name = b"nonAutoSortDefault", ty = "attr", default = "default_false")]
    pub non_auto_sort_default: bool,
    #[xmlserde(name = b"rankBy", ty = "attr")]
    pub rank_by: Option<u32>,
    #[xmlserde(name = b"defaultSubtotal", ty = "attr", default = "default_true")]
    pub default_subtotal: bool,
    #[xmlserde(name = b"sumSubtotal", ty = "attr", default = "default_false")]
    pub sum_subtotal: bool,
    #[xmlserde(name = b"countASubtotal", ty = "attr", default = "default_false")]
    pub count_a_subtotal: bool,
    #[xmlserde(name = b"avgSubtotal", ty = "attr", default = "default_false")]
    pub avg_subtotal: bool,
    #[xmlserde(name = b"maxSubtotal", ty = "attr", default = "default_false")]
    pub max_subtotal: bool,
    #[xmlserde(name = b"minSubtotal", ty = "attr", default = "default_false")]
    pub min_subtotal: bool,
    #[xmlserde(name = b"productSubtotal", ty = "attr", default = "default_false")]
    pub product_subtotal: bool,
    #[xmlserde(name = b"countSubtotal", ty = "attr", default = "default_false")]
    pub count_subtotal: bool,
    #[xmlserde(name = b"stdDevSubtotal", ty = "attr", default = "default_false")]
    pub std_dev_subtotal: bool,
    #[xmlserde(name = b"stdDevPSubtotal", ty = "attr", default = "default_false")]
    pub std_dev_p_subtotal: bool,
    #[xmlserde(name = b"varSubtotal", ty = "attr", default = "default_false")]
    pub var_subtotal: bool,
    #[xmlserde(name = b"varPSubtotal", ty = "attr", default = "default_false")]
    pub var_p_subtotal: bool,
    #[xmlserde(name = b"showPropCell", ty = "attr", default = "default_false")]
    pub show_prop_cell: bool,
    #[xmlserde(name = b"showPropTip", ty = "attr", default = "default_false")]
    pub show_prop_tip: bool,
    #[xmlserde(name = b"showPropAsCaption", ty = "attr", default = "default_false")]
    pub show_prop_as_caption: bool,
    #[xmlserde(
        name = b"defaultAttributeDrillState",
        ty = "attr",
        default = "default_false"
    )]
    pub default_attribute_drill_state: bool,
}

/// CT_Items (§18.10.1.44).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtItems {
    #[xmlserde(name = b"item", ty = "child", vec_size = "count")]
    pub item: Vec<CtItem>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_Item (§18.10.1.45).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtItem {
    #[xmlserde(name = b"n", ty = "attr")]
    pub n: Option<String>,
    #[xmlserde(name = b"t", ty = "attr", default = "st_item_type_data")]
    pub t: StItemType,
    #[xmlserde(name = b"h", ty = "attr", default = "default_false")]
    pub h: bool,
    #[xmlserde(name = b"s", ty = "attr", default = "default_false")]
    pub s: bool,
    #[xmlserde(name = b"sd", ty = "attr", default = "default_true")]
    pub sd: bool,
    #[xmlserde(name = b"f", ty = "attr", default = "default_false")]
    pub f: bool,
    #[xmlserde(name = b"m", ty = "attr", default = "default_false")]
    pub m: bool,
    #[xmlserde(name = b"c", ty = "attr", default = "default_false")]
    pub c: bool,
    #[xmlserde(name = b"x", ty = "attr")]
    pub x: Option<u32>,
    #[xmlserde(name = b"d", ty = "attr", default = "default_false")]
    pub d: bool,
    #[xmlserde(name = b"e", ty = "attr", default = "default_true")]
    pub e: bool,
}

/// CT_AutoSortScope (§18.10.1.2).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtAutoSortScope {
    #[xmlserde(name = b"pivotArea", ty = "child")]
    pub pivot_area: CtPivotArea,
}

/// CT_RowFields (§18.10.1.81) and CT_ColFields (§18.10.1.16) — identical shape.
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtRowColFields {
    #[xmlserde(name = b"field", ty = "child", vec_size = "count")]
    pub field: Vec<CtField>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_Field (§18.10.1.32) — `x` is the source-field index (-2 means the data
/// field).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtField {
    #[xmlserde(name = b"x", ty = "attr")]
    pub x: i32,
}

/// CT_rowItems (§18.10.1.80) and CT_colItems (§18.10.1.17) — identical shape.
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtRowColItems {
    #[xmlserde(name = b"i", ty = "child", vec_size = "count")]
    pub i: Vec<CtI>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_I (§18.10.1.42) — one row/column of items; `x` children index members.
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtI {
    #[xmlserde(name = b"x", ty = "child")]
    pub x: Vec<CtX>,
    #[xmlserde(name = b"t", ty = "attr", default = "st_item_type_data")]
    pub t: StItemType,
    #[xmlserde(name = b"r", ty = "attr", default = "default_zero_u32")]
    pub r: u32,
    #[xmlserde(name = b"i", ty = "attr", default = "default_zero_u32")]
    pub i: u32,
}

/// CT_PageFields (§18.10.1.61).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPageFields {
    #[xmlserde(name = b"pageField", ty = "child", vec_size = "count")]
    pub page_field: Vec<CtPageField>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_PageField (§18.10.1.60).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPageField {
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"fld", ty = "attr")]
    pub fld: i32,
    #[xmlserde(name = b"item", ty = "attr")]
    pub item: Option<u32>,
    #[xmlserde(name = b"hier", ty = "attr")]
    pub hier: Option<i32>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"cap", ty = "attr")]
    pub cap: Option<String>,
}

/// CT_DataFields (§18.10.1.23).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtDataFields {
    #[xmlserde(name = b"dataField", ty = "child", vec_size = "count")]
    pub data_field: Vec<CtDataField>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_DataField (§18.10.1.20).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtDataField {
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"fld", ty = "attr")]
    pub fld: u32,
    #[xmlserde(
        name = b"subtotal",
        ty = "attr",
        default = "st_data_consolidate_function_sum"
    )]
    pub subtotal: StDataConsolidateFunction,
    #[xmlserde(name = b"showDataAs", ty = "attr", default = "st_show_data_as_normal")]
    pub show_data_as: StShowDataAs,
    #[xmlserde(name = b"baseField", ty = "attr", default = "default_zero_i32")]
    pub base_field: i32,
    #[xmlserde(name = b"baseItem", ty = "attr")]
    pub base_item: Option<u32>,
    #[xmlserde(name = b"numFmtId", ty = "attr")]
    pub num_fmt_id: Option<u32>,
}

/// CT_Formats (§18.10.1.40).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtFormats {
    #[xmlserde(name = b"format", ty = "child", vec_size = "count")]
    pub format: Vec<CtFormat>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_Format (§18.10.1.39).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtFormat {
    #[xmlserde(name = b"pivotArea", ty = "child")]
    pub pivot_area: CtPivotArea,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"action", ty = "attr", default = "st_format_action_formatting")]
    pub action: StFormatAction,
    #[xmlserde(name = b"dxfId", ty = "attr")]
    pub dxf_id: Option<u32>,
}

/// CT_ConditionalFormats (§18.10.1.18).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtConditionalFormats {
    #[xmlserde(name = b"conditionalFormat", ty = "child", vec_size = "count")]
    pub conditional_format: Vec<CtConditionalFormat>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_ConditionalFormat (§18.10.1.15).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtConditionalFormat {
    #[xmlserde(name = b"pivotAreas", ty = "child")]
    pub pivot_areas: CtPivotAreas,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"scope", ty = "attr", default = "st_scope_selection")]
    pub scope: StScope,
    /// ST_Type (§18.18.83: none/all/row/column) — kept as text.
    #[xmlserde(name = b"type", ty = "attr")]
    pub ty: Option<String>,
    #[xmlserde(name = b"priority", ty = "attr")]
    pub priority: u32,
}

/// CT_PivotAreas (§18.10.1.74).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPivotAreas {
    #[xmlserde(name = b"pivotArea", ty = "child", vec_size = "count")]
    pub pivot_area: Vec<CtPivotArea>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_PivotTableStyle (pivotTableStyleInfo, §18.10.1.73).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPivotTableStyle {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"showRowHeaders", ty = "attr", default = "default_false")]
    pub show_row_headers: bool,
    #[xmlserde(name = b"showColHeaders", ty = "attr", default = "default_false")]
    pub show_col_headers: bool,
    #[xmlserde(name = b"showRowStripes", ty = "attr", default = "default_false")]
    pub show_row_stripes: bool,
    #[xmlserde(name = b"showColStripes", ty = "attr", default = "default_false")]
    pub show_col_stripes: bool,
    #[xmlserde(name = b"showLastColumn", ty = "attr", default = "default_false")]
    pub show_last_column: bool,
}

/// CT_PivotFilters (§18.10.1.62).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPivotFilters {
    #[xmlserde(name = b"filter", ty = "child", vec_size = "count")]
    pub filter: Vec<CtPivotFilter>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_PivotFilter (§18.10.1.63). The embedded `autoFilter` (a generic
/// worksheet filter) is preserved verbatim.
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPivotFilter {
    #[xmlserde(name = b"autoFilter", ty = "child")]
    pub auto_filter: Option<Unparsed>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"fld", ty = "attr")]
    pub fld: u32,
    #[xmlserde(name = b"mpFld", ty = "attr")]
    pub mp_fld: Option<u32>,
    #[xmlserde(name = b"type", ty = "attr")]
    pub ty: String,
    #[xmlserde(name = b"evalOrder", ty = "attr", default = "default_zero_i32")]
    pub eval_order: i32,
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: u32,
    #[xmlserde(name = b"iMeasureHier", ty = "attr")]
    pub i_measure_hier: Option<u32>,
    #[xmlserde(name = b"iMeasureFld", ty = "attr")]
    pub i_measure_fld: Option<u32>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"description", ty = "attr")]
    pub description: Option<String>,
    #[xmlserde(name = b"stringValue1", ty = "attr")]
    pub string_value1: Option<String>,
    #[xmlserde(name = b"stringValue2", ty = "attr")]
    pub string_value2: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{xml_deserialize_from_str, xml_serialize_with_decl};

    #[test]
    fn round_trip() {
        let xml = include_str!("../../examples/pivot_table.xml");
        let p = xml_deserialize_from_str::<PivotTableDefinition>(xml).expect("deserialize");
        assert_eq!(p.name, "PivotTable1");
        assert_eq!(p.cache_id, 1);
        assert_eq!(p.data_caption, "Values");
        assert_eq!(p.location.reference, "A3:B6");
        let pf = p.pivot_fields.as_ref().unwrap();
        assert_eq!(pf.count, 2);
        assert!(matches!(pf.pivot_field[0].axis, Some(StAxis::AxisRow)));
        assert_eq!(pf.pivot_field[0].items.as_ref().unwrap().item.len(), 3);
        assert!(pf.pivot_field[1].data_field);
        assert_eq!(p.row_fields.as_ref().unwrap().field[0].x, 0);
        assert_eq!(p.data_fields.as_ref().unwrap().data_field[0].fld, 1);
        let style = p.pivot_table_style_info.as_ref().unwrap();
        assert_eq!(style.name.as_deref(), Some("PivotStyleLight16"));
        let out = xml_serialize_with_decl(p);
        let p2 = xml_deserialize_from_str::<PivotTableDefinition>(&out).expect("re-deserialize");
        assert_eq!(p2.name, "PivotTable1");
        assert_eq!(p2.data_fields.as_ref().unwrap().data_field.len(), 1);
    }
}
