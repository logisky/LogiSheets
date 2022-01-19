use std::borrow::Cow;
use std::io::prelude::Write;

use crate::complex_types::*;
use crate::errors::Result;
use crate::simple_types::*;
use crate::xml_element::*;
use crate::{defaults::*, namespace::Namespaces};

use macros::{Handler, OoxmlHash};
use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "anchor")]
pub struct Anchor {
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub move_with_cells: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub size_with_cells: bool,
    #[serde(rename = "z-order")]
    pub z_order: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "brk")]
pub struct Break {
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub id: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub man: bool,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub max: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub min: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub pt: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "c")]
pub struct C {
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub cm: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub ph: bool,
    pub r: Option<StCellRef>,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub s: u32,
    #[serde(
        default = "StCellType::DefaultBuilder::N",
        skip_serializing_if = "StCellType::DefaultBuilder::isN"
    )]
    pub t: StCellType::Type,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub vm: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellSmartTag")]
pub struct CellSmartTag {
    pub cell_smart_tag_pr: Vec<CellSmartTagPr>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub deleted: bool,
    #[serde(rename = "type")]
    pub ty: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub xml_based: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellWatch")]
pub struct CellWatch {
    pub r: StCellRef,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellWatches")]
pub struct CellWatches {
    pub cell_watch: Vec<CellWatch>,
}

/// Conditional Formatting Rule
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "CfRules")]
pub struct CfRule {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub formula: Vec<PlainText>,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub above_average: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub bottom: bool,
    #[serde(rename = "type")]
    pub ty: StCfType::Type,
    pub dxf_id: Option<StDxfId>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub equal_average: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub percent: bool,
    pub priority: i32,
    pub rank: Option<u32>,
    pub std_dev: Option<i32>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub stop_if_true: bool,
    pub operator: Option<StConditionalFormattingOperator::Type>,
    pub text: Option<String>,
    pub time_period: Option<StTimePeriod::Type>,
}

/// Conditional Format Value Object
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cfvo")]
pub struct Cfvo {
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub gte: bool,
    #[serde(rename = "type")]
    pub ty: Option<StCfvoType::Type>,
    pub val: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellSmartTagPr")]
pub struct CellSmartTagPr {
    pub key: String,
    pub val: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "legacyDrawing")]
pub struct LegacyDrawing {
    #[serde(rename = "r:id")]
    pub r_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "worksheet")]
pub struct WorksheetPart {
    #[serde(flatten)]
    namespaces: Namespaces,
    pub sheet_pr: Option<SheetPr>,
    pub dimension: Option<SheetDimension>,
    pub sheet_views: Option<SheetViews>,
    pub sheet_format_pr: Option<SheetFormatPr>,
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub cols: Vec<Cols>,
    #[serde(default = "SheetData::default")]
    pub sheet_data: SheetData,
    pub sheet_calc_pr: Option<SheetCalcPr>,
    pub sheet_protection: Option<SheetProtection>,
    pub protected_ranges: Option<ProtectRanges>,
    pub scenarios: Option<Scenarios>,
    pub auto_filter: Option<AutoFilter>,
    pub sort_state: Option<SortState>,
    pub data_consolidate: Option<DataConsolidate>,
    pub custom_sheet_views: Option<CustomSheetViews>,
    pub merge_cells: Option<MergeCells>,
    pub phonetic_pr: Option<PhoneticPr>,
    pub conditional_formatting: Option<ConditionalFormatting>,
    pub data_validations: Option<DataValidations>,
    pub hyperlinks: Option<Hyperlinks>,
    pub print_options: Option<PrintOptions>,
    pub page_margins: Option<PageMargins>,
    pub page_setup: Option<PageSetup>,
    pub header_footer: Option<HeaderFooter>,
    pub row_breaks: Option<PageBreak>,
    pub col_breaks: Option<PageBreak>,
    pub custom_properties: Option<CustomProperties>,
    pub cell_watches: Option<CellWatches>,
    pub ignored_errors: Option<IgnoredErrors>,
    pub smart_tags: Option<SmartTags>,
    pub drawing: Option<Drawing>,
    pub drawing_h_f: Option<DrawingHf>,
    pub picture: Option<SheetBackgroundPicture>,
    pub ole_objects: Option<OleObjects>,
    pub controls: Option<Controls>,
    pub web_publish_items: Option<WebPublishItems>,
    pub table_parts: Option<TableParts>,
    pub legacy_drawing: Option<LegacyDrawing>,
}

impl OpenXmlElementInfo for WorksheetPart {
    fn tag_name() -> &'static str {
        "worksheet"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlDeserializeDefault for WorksheetPart {}

impl OpenXmlSerialize for WorksheetPart {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut xml = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(xml.inner(), &self.sheet_pr)?;
        quick_xml::se::to_writer(xml.inner(), &self.dimension)?;
        quick_xml::se::to_writer(xml.inner(), &self.sheet_views)?;
        quick_xml::se::to_writer(xml.inner(), &self.sheet_format_pr)?;
        quick_xml::se::to_writer(xml.inner(), &self.cols)?;
        quick_xml::se::to_writer(xml.inner(), &self.sheet_data)?;
        quick_xml::se::to_writer(xml.inner(), &self.sheet_calc_pr)?;
        quick_xml::se::to_writer(xml.inner(), &self.sheet_protection)?;
        quick_xml::se::to_writer(xml.inner(), &self.protected_ranges)?;
        quick_xml::se::to_writer(xml.inner(), &self.scenarios)?;
        quick_xml::se::to_writer(xml.inner(), &self.auto_filter)?;
        quick_xml::se::to_writer(xml.inner(), &self.sort_state)?;
        quick_xml::se::to_writer(xml.inner(), &self.data_consolidate)?;
        quick_xml::se::to_writer(xml.inner(), &self.custom_sheet_views)?;
        quick_xml::se::to_writer(xml.inner(), &self.merge_cells)?;
        quick_xml::se::to_writer(xml.inner(), &self.phonetic_pr)?;
        quick_xml::se::to_writer(xml.inner(), &self.conditional_formatting)?;
        quick_xml::se::to_writer(xml.inner(), &self.data_validations)?;
        quick_xml::se::to_writer(xml.inner(), &self.hyperlinks)?;
        quick_xml::se::to_writer(xml.inner(), &self.print_options)?;
        quick_xml::se::to_writer(xml.inner(), &self.page_margins)?;
        quick_xml::se::to_writer(xml.inner(), &self.page_setup)?;
        quick_xml::se::to_writer(xml.inner(), &self.header_footer)?;
        quick_xml::se::to_writer(xml.inner(), &self.row_breaks)?;
        quick_xml::se::to_writer(xml.inner(), &self.col_breaks)?;
        quick_xml::se::to_writer(xml.inner(), &self.custom_properties)?;
        quick_xml::se::to_writer(xml.inner(), &self.cell_watches)?;
        quick_xml::se::to_writer(xml.inner(), &self.ignored_errors)?;
        quick_xml::se::to_writer(xml.inner(), &self.smart_tags)?;
        quick_xml::se::to_writer(xml.inner(), &self.drawing)?;
        quick_xml::se::to_writer(xml.inner(), &self.drawing_h_f)?;
        quick_xml::se::to_writer(xml.inner(), &self.picture)?;
        quick_xml::se::to_writer(xml.inner(), &self.ole_objects)?;
        quick_xml::se::to_writer(xml.inner(), &self.controls)?;
        quick_xml::se::to_writer(xml.inner(), &self.web_publish_items)?;
        quick_xml::se::to_writer(xml.inner(), &self.table_parts)?;
        quick_xml::se::to_writer(xml.inner(), &self.legacy_drawing)?;
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableParts")]
pub struct TableParts {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub table_part: Vec<TablePart>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableParts")]
pub struct TablePart {
    #[serde(rename = "r:id")]
    pub r_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "webPublishItems")]
pub struct WebPublishItems {
    // At least 1 element.
    pub web_publish_item: Vec<WebPublishItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "webPublishItem")]
pub struct WebPublishItem {
    pub id: u32,
    pub div_id: String,
    pub source_type: StWebSourceType::Type,
    pub source_ref: Option<StRef>,
    pub source_object: Option<String>,
    pub destination_file: String,
    pub title: Option<String>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub auto_republish: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "oleObjects")]
pub struct OleObjects {
    // At least 1 element.
    pub ole_object: Vec<OleObject>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "oleObject")]
pub struct OleObject {
    pub object_pr: Option<ObjectPr>,
    pub prog_id: Option<String>,
    #[serde(
        default = "StDvAspect::DefaultBuilder::DVASPECT_CONTENT",
        skip_serializing_if = "StDvAspect::DefaultBuilder::isDVASPECT_CONTENT"
    )]
    pub dv_aspect: StDvAspect::Type,
    pub link: Option<String>,
    pub ole_update: Option<StOleUpdate::Type>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub auto_load: bool,
    pub shape_id: u32,
    pub r_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "objectPr")]
pub struct ObjectPr {
    pub anchor: ObjectAnchor,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub locked: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub default_size: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub print: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub disabled: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub ui_object: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_fill: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_line: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_pict: bool,
    #[serde(rename = "macro")]
    pub m: Option<StFormula>,
    pub alt_text: Option<String>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub dde: bool,
    #[serde(rename = "r:id")]
    pub r_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "controls")]
pub struct Controls {
    // At least 1 element.
    pub control: Vec<Control>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "control")]
pub struct Control {
    pub control_pr: Option<ControlPr>,
    pub shape_id: u32,
    #[serde(rename = "r:id")]
    pub r_id: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "control")]
pub struct ControlPr {
    pub anchor: ObjectAnchor,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub locked: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub default_size: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub print: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub disabled: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub recalc_always: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub ui_object: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_fill: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_line: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_pict: bool,
    #[serde(rename = "macro")]
    pub m: Option<StFormula>,
    pub alt_text: Option<String>,
    pub linked_cell: Option<StFormula>,
    #[serde(default = "default_pict", skip_serializing_if = "is_default_pict")]
    pub cf: String,
    #[serde(rename = "r:id")]
    pub r_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetBackgroundPicture")]
pub struct SheetBackgroundPicture {
    #[serde(rename = "r:id")]
    pub r_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "smartTags")]
pub struct SmartTags {
    // At least 1 element.
    pub cell_smart_tags: Vec<CellSmartTags>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellSmartTags")]
pub struct CellSmartTags {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub cell_smart_tag_pr: Vec<CellSmartTagPr>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "ignoredErrors")]
pub struct IgnoredErrors {
    // At least 1 element.
    pub ignored_error: Vec<IgnoredError>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "ignoredError")]
pub struct IgnoredError {
    pub sqref: StSqref,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub eval_error: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub two_digit_text_year: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub number_stored_as_text: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub formula: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub formula_range: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub unlocked_formula: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub empty_cell_reference: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub list_data_validation: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub calculated_column: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customProperties")]
pub struct CustomProperties {
    // At least 1 element.
    pub custom_pr: Vec<CustomProperty>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customProperty")]
pub struct CustomProperty {
    pub name: String,
    #[serde(rename = "r:id")]
    pub r_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "hyperlinks")]
pub struct Hyperlinks {
    // At least 1 element.
    pub hyperlink: Vec<Hyperlink>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "hyperlink")]
pub struct Hyperlink {
    #[serde(rename = "ref")]
    pub reference: StRef,
    #[serde(rename = "r:id")]
    pub r_id: Option<String>,
    pub location: Option<String>,
    pub tooltip: Option<String>,
    pub display: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "dataValidations")]
pub struct DataValidations {
    // At least 1 element.
    pub data_validation: Vec<DataValidation>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub disable_prompts: bool,
    pub x_window: Option<u32>,
    pub y_window: Option<u32>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "conditionalFormatting")]
pub struct ConditionalFormatting {
    // At least 1 element.
    pub cf_rule: Vec<CfRule>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub pivot: bool,
    pub sqref: StSqref,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "mergeCells")]
pub struct MergeCells {
    // At least 1 element
    pub merge_cell: Vec<MergeCell>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "mergeCell")]
pub struct MergeCell {
    #[serde(rename = "ref")]
    pub reference: StRef,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customSheetViews")]
pub struct CustomSheetViews {
    // At least 1 element
    pub custom_sheet_view: Vec<CustomSheetView>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customSheetView")]
pub struct CustomSheetView {
    pub pane: Option<Pane>,
    pub selection: Option<Selection>,
    pub row_breaks: Option<PageBreak>,
    pub col_breaks: Option<PageBreak>,
    pub page_margins: Option<PageMargins>,
    pub print_options: Option<PrintOptions>,
    pub page_setup: Option<PageSetup>,
    pub header_footer: Option<HeaderFooter>,
    pub auto_filter: Option<AutoFilter>,
    pub guid: StGuid,
    #[serde(default = "default_scale", skip_serializing_if = "is_default_scale")]
    pub scale: u32,
    #[serde(
        default = "default_color_id",
        skip_serializing_if = "is_default_color_id"
    )]
    pub color_id: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_page_breaks: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_formulas: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_grid_lines: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_row_col: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub outline_symbols: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub zero_values: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub fit_to_page: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub print_area: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub filter: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_auto_filter: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub hidden_rows: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub hidden_columns: bool,
    #[serde(
        default = "StSheetState::DefaultBuilder::Visible",
        skip_serializing_if = "StSheetState::DefaultBuilder::isVisible"
    )]
    pub state: StSheetState::Type,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub filter_unique: bool,
    #[serde(
        default = "StSheetViewType::DefaultBuilder::Normal",
        skip_serializing_if = "StSheetViewType::DefaultBuilder::isNormal"
    )]
    pub view: StSheetViewType::Type,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_ruler: bool,
    pub top_left_cell: Option<StCellRef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "printOptions")]
pub struct PrintOptions {
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub horizontal_centered: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub vertical_centered: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub headings: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub grid_lines: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub grid_lines_set: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "pageSetup")]
pub struct PageSetup {
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub paper_size: u32,
    pub paper_height: Option<String>, // [0-9]+(\.[0-9]+)?(mm|cm|in|pt|pc|pi)
    pub paper_width: Option<String>,  // [0-9]+(\.[0-9]+)?(mm|cm|in|pt|pc|pi)
    #[serde(default = "default_scale", skip_serializing_if = "is_default_scale")]
    pub scale: u32,
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub first_page_number: u32,
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub fit_to_width: u32,
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub fit_to_height: u32,
    #[serde(
        default = "StPageOrder::DefaultBuilder::DownThenOver",
        skip_serializing_if = "StPageOrder::DefaultBuilder::isDownThenOver"
    )]
    pub page_order: StPageOrder::Type,
    #[serde(
        default = "StOrientation::DefaultBuilder::Default",
        skip_serializing_if = "StOrientation::DefaultBuilder::isDefault"
    )]
    pub orientation: StOrientation::Type,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub use_printer_defaults: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub black_and_white: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub draft: bool,
    #[serde(
        default = "StCellComments::DefaultBuilder::None",
        skip_serializing_if = "StCellComments::DefaultBuilder::isNone"
    )]
    pub cell_comments: StCellComments::Type,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub use_first_page_number: bool,
    #[serde(
        default = "StPrintError::DefaultBuilder::displayed",
        skip_serializing_if = "StPrintError::DefaultBuilder::isdisplayed"
    )]
    pub errors: StPrintError::Type,
    #[serde(default = "default_dpi", skip_serializing_if = "is_default_dpi")]
    pub horizontal_dpi: u32,
    #[serde(default = "default_dpi", skip_serializing_if = "is_default_dpi")]
    pub vertical_dpi: u32,
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub copies: u32,
    #[serde(rename = "r:id")]
    pub r_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "pageBreak")]
pub struct PageBreak {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub brk: Vec<Break>,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub count: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub manual_break_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "dataConsolidate")]
pub struct DataConsolidate {
    // At least 1 element.
    pub data_validation: Vec<DataValidation>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub disable_prompts: bool,
    pub x_window: Option<u32>,
    pub y_window: Option<u32>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "dataConsolidate")]
pub struct DataValidation {
    pub formula1: Option<StFormula>,
    pub formula2: Option<StFormula>,
    #[serde(
        rename = "type",
        default = "StDataValidationType::DefaultBuilder::None",
        skip_serializing_if = "StDataValidationType::DefaultBuilder::isNone"
    )]
    pub ty: StDataValidationType::Type,
    #[serde(
        default = "StDataValidationErrorStyle::DefaultBuilder::Stop",
        skip_serializing_if = "StDataValidationErrorStyle::DefaultBuilder::isStop"
    )]
    pub error_style: StDataValidationErrorStyle::Type,
    #[serde(
        default = "StDataValidationImeMode::DefaultBuilder::NoControl",
        skip_serializing_if = "StDataValidationImeMode::DefaultBuilder::isNoControl"
    )]
    pub ime_mode: StDataValidationImeMode::Type,
    #[serde(
        default = "StDataValidationOperator::DefaultBuilder::Between",
        skip_serializing_if = "StDataValidationOperator::DefaultBuilder::isBetween"
    )]
    pub operator: StDataValidationOperator::Type,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub allow_blank: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_drop_down: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_input_message: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_error_message: bool,
    pub error_title: Option<String>,
    pub error: Option<String>,
    pub prompt_title: Option<String>,
    pub prompt: Option<String>,
    pub sqref: StSqref,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "scenarios")]
pub struct Scenarios {
    // At least 1 element.
    pub scenario: Vec<Scenario>,
    pub current: Option<u32>,
    pub show: Option<u32>,
    pub sqref: Option<StSqref>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "scenario")]
pub struct Scenario {
    // At least 1 element.
    pub input_cells: Vec<InputCells>,
    pub name: String,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub locked: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub hidden: bool,
    pub count: Option<u32>,
    pub user: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "scenario")]
pub struct InputCells {
    pub r: StCellRef,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub deleted: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub undone: bool,
    pub val: String,
    pub num_fmt_id: Option<StNumFmtId>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "protectRanges")]
pub struct ProtectRanges {
    // At least 1 element.
    pub protected_range: Vec<ProtectRange>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "protectRanges")]
pub struct ProtectRange {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub security_descriptor: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetProtection")]
pub struct SheetProtection {
    pub algorithm_name: Option<String>,
    pub hash_value: Option<String>,
    pub spin_count: Option<u32>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub sheet: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub objects: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub scenarios: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub format_cells: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub format_columns: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub format_rows: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub insert_columns: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub insert_rows: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub insert_hyperlinks: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub delete_columns: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub delete_rows: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub select_locked_cells: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub sort: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_filter: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub pivot_tables: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub select_unlocked_cells: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetCalcPr")]
pub struct SheetCalcPr {
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub full_calc_on_load: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "sheetData")]
pub struct SheetData {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub row: Vec<Row>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "row")]
pub struct Row {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub c: Vec<Cell>,
    pub r: Option<u32>,
    pub spans: Option<StCellSpans>,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub s: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub custom_format: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub hidden: bool,
    pub ht: Option<f64>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub custom_height: bool,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub outline_level: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub collapsed: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub thick_top: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub thick_bot: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub ph: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "c")]
pub struct Cell {
    pub f: Option<CellFormula>,
    pub v: Option<PlainText>,
    pub is: Option<Rst>,
    pub r: Option<StCellRef>,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub s: u32,
    #[serde(
        default = "StCellType::DefaultBuilder::N",
        skip_serializing_if = "StCellType::DefaultBuilder::isN"
    )]
    pub t: StCellType::Type,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub cm: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub vm: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub ph: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "f")]
pub struct CellFormula {
    #[serde(rename = "$value")]
    pub f: Option<String>,
    #[serde(
        default = "StCellFormulaType::DefaultBuilder::Normal",
        skip_serializing_if = "StCellFormulaType::DefaultBuilder::isNormal"
    )]
    pub t: StCellFormulaType::Type,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub aca: bool,
    #[serde(rename = "ref")]
    pub reference: Option<StRef>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub dt_2d: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub dtr: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub del1: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub del2: bool,
    pub r1: Option<StCellRef>,
    pub r2: Option<StCellRef>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub ca: bool,
    pub si: Option<u32>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub bx: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cols")]
pub struct Cols {
    pub col: Vec<Col>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "col")]
pub struct Col {
    pub min: u32,
    pub max: u32,
    pub width: Option<f64>,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub style: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub hidden: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub best_fit: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub custom_width: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub phonetic: bool,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub outline_level: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub collapsed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetFormatPr")]
pub struct SheetFormatPr {
    #[serde(
        default = "default_base_col_width",
        skip_serializing_if = "is_default_base_col_width"
    )]
    pub base_col_width: u32,
    pub default_col_width: Option<f64>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub custom_height: bool,
    pub default_row_height: f64,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub zero_height: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub thick_top: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub thick_bottom: bool,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub outline_level_row: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub outline_level_col: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "dimension")]
pub struct SheetDimension {
    #[serde(rename = "ref")]
    pub reference: StRef,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetViews")]
pub struct SheetViews {
    pub sheet_view: Vec<SheetView>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetView")]
pub struct SheetView {
    pub pane: Option<Pane>,
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub selection: Vec<Selection>, // Max 4
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub pivot_selection: Vec<PivotSelection>, // Max 4
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub window_protection: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_formulas: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_grid_lines: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_row_col_headers: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_zeros: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub right_to_left: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub tab_selected: bool,
    pub top_left_cell: Option<StCellRef>,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_ruler: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_outlines_symbols: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub default_grid_color: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_white_space: bool,
    #[serde(
        default = "StSheetViewType::DefaultBuilder::Normal",
        skip_serializing_if = "StSheetViewType::DefaultBuilder::isNormal"
    )]
    pub view: StSheetViewType::Type,
    #[serde(
        default = "default_color_id",
        skip_serializing_if = "is_default_color_id"
    )]
    pub color_id: u32,
    #[serde(
        default = "default_zoom_scale",
        skip_serializing_if = "is_default_zoom_scale"
    )]
    pub zoom_scale: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub zoom_scale_normal: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub zoom_scale_page_layout_view: u32,
    pub workbook_view_id: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "pane")]
pub struct Pane {
    #[serde(
        default = "default_zero_f64",
        skip_serializing_if = "is_default_zero_f64"
    )]
    pub x_split: f64,
    #[serde(
        default = "default_zero_f64",
        skip_serializing_if = "is_default_zero_f64"
    )]
    pub y_split: f64,
    pub top_left_cell: Option<StCellRef>,
    #[serde(
        default = "StPane::DefaultBuilder::TopLeft",
        skip_serializing_if = "StPane::DefaultBuilder::isTopLeft"
    )]
    pub active_pane: StPane::Type,
    #[serde(
        default = "StPaneState::DefaultBuilder::Split",
        skip_serializing_if = "StPaneState::DefaultBuilder::isSplit"
    )]
    pub state: StPaneState::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "selection")]
pub struct Selection {
    #[serde(
        default = "StPane::DefaultBuilder::TopLeft",
        skip_serializing_if = "StPane::DefaultBuilder::isTopLeft"
    )]
    pub pane: StPane::Type,
    pub active_cell: Option<StCellRef>,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub active_cell_id: u32,
    #[serde(default = "default_sqref")]
    pub sqref: StSqref,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "pivotSelection")]
pub struct PivotSelection {
    pub pivot_area: PivotArea,
    #[serde(
        default = "StPane::DefaultBuilder::TopLeft",
        skip_serializing_if = "StPane::DefaultBuilder::isTopLeft"
    )]
    pub name: StPane::Type,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_header: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub label: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub data: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub extendable: bool,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub count: u32,
    pub axis: Option<StAxis::Type>,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub dimension: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub start: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub min: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub max: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub acitve_row: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub acitve_col: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub previous_row: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub previous_col: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub click: u32,
    #[serde(rename = "r:id")]
    pub r_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "pivotArea")]
pub struct PivotArea {
    pub references: Option<PivotAreaReferences>,
    pub field: Option<i32>,
    #[serde(rename = "type", default = "StPivotAreaType::DefaultBuilder::Normal")]
    pub ty: StPivotAreaType::Type,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub data_only: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub label_only: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub grand_row: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub grand_col: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub cache_index: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub outline: bool,
    pub offset: StRef,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub collapsed_level_are_subtotals: bool,
    pub axis: Option<StAxis::Type>,
    pub field_position: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "pivotAreaReferences")]
pub struct PivotAreaReferences {
    pub reference: Vec<PivotAreaReference>,
    pub count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "pivotAreaReference")]
pub struct PivotAreaReference {
    pub x: Vec<Index>,
    pub field: Option<u32>,
    pub count: u32,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub selected: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub by_position: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub relative: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub default_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub sum_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub count_a_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub avg_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub max_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub min_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub product_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub count_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub std_dev_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub std_dev_p_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub var_subtotal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub var_p_subtotal: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "index")]
pub struct Index {
    pub v: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Handler)]
#[serde(rename_all = "camelCase", rename = "sheetPr")]
pub struct SheetPr {
    pub tab_color: Option<Color>,
    pub outline_pr: Option<OutlinePr>,
    pub page_set_up_pr: Option<PageSetUpPr>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub sync_horizontal: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub sync_vertical: bool,
    pub sync_ref: Option<StRef>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub transition_evaluation: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub transition_entry: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub published: bool,
    pub code_name: Option<String>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub filter_mode: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub enable_format_conditions_calculation: bool,
}

impl Default for SheetPr {
    fn default() -> Self {
        SheetPr {
            tab_color: None,
            outline_pr: None,
            page_set_up_pr: None,
            sync_horizontal: false,
            sync_vertical: false,
            sync_ref: None,
            transition_evaluation: false,
            transition_entry: false,
            published: true,
            code_name: None,
            filter_mode: false,
            enable_format_conditions_calculation: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, OoxmlHash, Clone)]
#[serde(rename_all = "camelCase", rename = "pageSetUpPr")]
pub struct PageSetUpPr {
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_page_breaks: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub fit_to_page: bool,
}

#[derive(Debug, Serialize, Deserialize, OoxmlHash, Clone)]
#[serde(rename_all = "camelCase", rename = "outlinePr")]
pub struct OutlinePr {
    #[serde(default = "default_as_false")]
    pub apply_styles: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub summary_below: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub summary_right: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_outline_symbols: bool,
}

fn default_sqref() -> StSqref {
    String::from("A1")
}

fn default_color_id() -> u32 {
    64
}

fn is_default_color_id(id: &u32) -> bool {
    *id == 64
}

fn default_base_col_width() -> u32 {
    8
}

fn is_default_base_col_width(t: &u32) -> bool {
    *t == 8
}

fn default_pict() -> String {
    String::from("pict")
}

fn is_default_pict(t: &String) -> bool {
    String::from("pict").eq(t)
}
