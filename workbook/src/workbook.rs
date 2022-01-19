use std::borrow::Cow;

use quick_xml::events::attributes::Attribute;
use quick_xml::se::to_writer;
use serde::{Deserialize, Serialize};

use crate::defaults::*;
use crate::errors::Result;
use crate::xml_element::*;
use crate::{namespace::Namespaces, simple_types::*};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "fileVersion")]
pub struct FileVersion {
    pub app_name: Option<String>,
    pub last_edited: Option<String>,
    pub lowest_edited: Option<String>,
    pub rup_build: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, Hash, PartialEq, Eq)]
#[serde(rename_all = "camelCase", rename = "definedName")]
pub struct DefinedName {
    pub comment: Option<String>,
    pub custom_menu: Option<String>,
    pub description: Option<String>,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub function: bool,
    pub function_group_id: Option<u32>,
    pub help: Option<String>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub hidden: bool,
    pub local_sheet_id: Option<u32>,
    pub name: String,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub publish_to_server: bool,
    pub shortcut_key: Option<String>,
    pub status_bar: Option<String>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub vb_procedure: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "definedNames")]
pub struct DefinedNames {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub name: Vec<DefinedName>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheet")]
pub struct Sheet {
    pub name: String,
    pub sheet_id: usize,
    #[serde(rename = "r:id")]
    pub r_id: String,
    #[serde(
        default = "StSheetState::DefaultBuilder::Visible",
        skip_serializing_if = "StSheetState::DefaultBuilder::isVisible"
    )]
    pub state: StSheetState::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "sheets")]
pub struct Sheets {
    pub sheet: Vec<Sheet>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "workbookProtection")]
pub struct WorkbookProtection {
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub lock_revision: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub lock_structure: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub lock_windows: bool,
    pub revisions_algorithm_name: Option<String>,
    pub revisions_hash_value: Option<String>,
    pub revisions_salt_value: Option<String>,
    pub revisions_spin_count: u32,
    pub workbook_algorithm_name: Option<String>,
    pub workbook_hash_value: Option<String>,
    pub workbook_salt_value: Option<String>,
    pub workbook_spin_count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "workbookPr")]
pub struct WorkbookPr {
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub allow_refresh_query: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_compress_pictures: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub backup_file: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub check_compatibility: bool,
    pub code_name: Option<String>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub date1904: bool,
    pub default_theme_version: Option<u32>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub filter_privacy: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub hide_pivot_field_list: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub prompted_solutions: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub publish_items: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub refresh_all_connections: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub save_external_link_values: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_border_unselected_tables: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_ink_annotation: bool,
    #[serde(
        default = "StObjects::DefaultBuilder::All",
        skip_serializing_if = "StObjects::DefaultBuilder::isAll"
    )]
    pub show_objects: StObjects::Type,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub show_pivot_chart_filter: bool,
    #[serde(
        default = "StUpdateLinks::DefaultBuilder::UserSet",
        skip_serializing_if = "StUpdateLinks::DefaultBuilder::isUserSet"
    )]
    pub update_links: StUpdateLinks::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "workbookView")]
pub struct WorkbookView {
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub active_tab: u32,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub auto_filter_date_grouping: bool,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub first_sheet: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub minimized: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_horizontal_scroll: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_sheet_tabs: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_vertical_scroll: bool,
    #[serde(
        default = "default_tab_ratio",
        skip_serializing_if = "is_default_tab_ratio"
    )]
    pub tab_ratio: u32,
    #[serde(
        default = "StVisibility::DefaultBuilder::Visible",
        skip_serializing_if = "StVisibility::DefaultBuilder::isVisible"
    )]
    pub visibility: StVisibility::Type,
    pub window_height: Option<u32>,
    pub window_width: Option<u32>,
    pub x_window: Option<String>,
    pub y_window: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "bookViews")]
pub struct BookViews {
    pub workbook_view: Vec<WorkbookView>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "pivotCache")]
pub struct PivotCache {
    pub cache_id: u32,
    #[serde(rename = "r:id")]
    pub r_id: String,
    pub state: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "pivotCaches")]
pub struct PivotCaches {
    #[serde(rename = "pivotCache")]
    caches: Vec<PivotCache>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "smartTagPr")]
pub struct SmartTagPr {
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub embed: bool,
    #[serde(
        default = "StSmartTagShow::DefaultBuilder::All",
        skip_serializing_if = "StSmartTagShow::DefaultBuilder::isAll"
    )]
    pub show: StSmartTagShow::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "smartTagType")]
pub struct SmartTagType {
    pub name: String,
    pub namespace_uri: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "smartTagTypes")]
pub struct SmartTagTypes {
    pub smart_tag_type: Vec<SmartTagType>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customWorkbookView")]
pub struct CustomWorkbookView {
    pub active_sheet_id: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub auto_update: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub changes_saved_win: bool,
    pub guid: String,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub include_hidden_row_col: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub include_print_settings: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub maximized: bool,
    pub merge_interval: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub minimized: bool,
    pub name: String,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub only_sync: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub personal_view: bool,
    #[serde(
        default = "StComments::DefaultBuilder::CommIndicator",
        skip_serializing_if = "StComments::DefaultBuilder::isCommIndicator"
    )]
    pub show_comments: StComments::Type,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_formula_bar: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_horizontal_scroll: bool,
    #[serde(
        default = "StObjects::DefaultBuilder::All",
        skip_serializing_if = "StObjects::DefaultBuilder::isAll"
    )]
    pub show_objects: StObjects::Type,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_sheet_tabs: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_status_bar: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub show_vertical_scroll: bool,
    #[serde(default = "default_tab_ratio")]
    pub tab_ratio: u32,
    pub window_height: u32,
    pub window_width: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub x_window: u32,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub y_window: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customWorkbookViews")]
pub struct CustomWorkbookViews {
    pub custom_book_views: Vec<CustomWorkbookView>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "calcPr")]
pub struct CalcPr {
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub calc_completed: bool,
    pub calc_id: Option<u32>,
    #[serde(
        default = "StCalcMode::DefaultBuilder::Auto",
        skip_serializing_if = "StCalcMode::DefaultBuilder::isAuto"
    )]
    pub calc_mode: StCalcMode::Type,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub calc_on_save: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub concurrent_calc: bool,
    pub concurrent_manual_count: Option<u32>,
    pub force_full_calc: Option<bool>,
    pub full_calc_onload: Option<bool>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub full_precision: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub iterate: bool,
    #[serde(default = "default_iterate_count")]
    pub iterate_count: u32,
    #[serde(
        default = "default_iterate_delta",
        skip_serializing_if = "is_default_iterate_delta"
    )]
    pub iterate_delta: f64,
    #[serde(
        default = "StRefMode::DefaultBuilder::A1",
        skip_serializing_if = "StRefMode::DefaultBuilder::isA1"
    )]
    pub ref_mode: StRefMode::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "fileRecoverPr")]
pub struct FileRecoveryPr {
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub auto_recover: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub crash_save: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub data_extract_load: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub repair_load: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "externalReference")]
pub struct ExternalReference {
    #[serde(rename = "r:id")]
    pub rid: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "externalReferences")]
pub struct ExternalReferences {
    pub external_reference: Vec<ExternalReference>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "fileSharing")]
pub struct FileSharing {
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub read_only_recommended: bool,
    pub user_name: String,
    pub algorithm_name: Option<String>,
    pub hash_value: Option<String>,
    pub salt_value: Option<String>,
    pub spin_count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "fileSharing")]
pub struct OleSize {
    #[serde(rename = "ref")]
    pub reference: StRef,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkbookPart {
    pub file_version: Option<FileVersion>,
    pub file_sharing: Option<FileSharing>,
    pub workbook_pr: Option<WorkbookPr>,
    pub workbook_protection: Option<WorkbookProtection>,
    pub book_views: BookViews,
    pub sheets: Sheets,
    pub external_references: Option<ExternalReferences>,
    pub defined_names: Option<DefinedNames>,
    pub calc_pr: Option<CalcPr>,
    pub ole_size: Option<OleSize>,
    pub custom_workbook_views: Option<CustomWorkbookViews>,
    pub pivot_caches: Option<PivotCaches>,
    pub smart_tag_pr: Option<SmartTagPr>,
    pub smart_tag_types: Option<SmartTagTypes>,
    pub file_recover_pr: Option<FileRecoveryPr>,
    #[serde(
        default = "StConformanceClass::DefaultBuilder::Transitional",
        skip_serializing_if = "StConformanceClass::DefaultBuilder::isTransitional"
    )]
    pub conformance: StConformanceClass::Type,
    pub xmlns: Option<String>,
    #[serde(rename = "xmlns:r")]
    pub xmlns_r: Option<String>,
}

impl OpenXmlElementInfo for WorkbookPart {
    fn tag_name() -> &'static str {
        "workbook"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlDeserializeDefault for WorkbookPart {}

impl OpenXmlSerialize for WorkbookPart {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        None
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        let mut result: Vec<Attribute> = Vec::new();
        if let Some(xmlns) = &self.xmlns {
            let xmlns_attr = Attribute {
                key: b"xmlns",
                value: Cow::Borrowed(xmlns.as_bytes()),
            };
            result.push(xmlns_attr);
        }
        if let Some(xmlns_r) = &self.xmlns_r {
            let xmlns_r_attr = Attribute {
                key: b"xmlns:r",
                value: Cow::Borrowed(xmlns_r.as_bytes()),
            };
            result.push(xmlns_r_attr);
        }
        Some(result)
    }

    fn write_inner<W: std::io::Write>(&self, writer: W) -> Result<()> {
        let mut xml = quick_xml::Writer::new(writer);
        to_writer(xml.inner(), &self.file_version)?;
        to_writer(xml.inner(), &self.book_views)?;
        to_writer(xml.inner(), &self.workbook_pr)?;
        to_writer(xml.inner(), &self.sheets)?;
        to_writer(xml.inner(), &self.calc_pr)?;
        to_writer(xml.inner(), &self.file_recover_pr)?;
        to_writer(xml.inner(), &self.defined_names)?;
        to_writer(xml.inner(), &self.smart_tag_pr)?;
        to_writer(xml.inner(), &self.smart_tag_types)?;
        to_writer(xml.inner(), &self.custom_workbook_views)?;
        Ok(())
    }
}

fn default_iterate_count() -> u32 {
    100
}

fn default_iterate_delta() -> f64 {
    0.001
}

fn is_default_iterate_delta(t: &f64) -> bool {
    *t == 0.001_f64
}

fn default_tab_ratio() -> u32 {
    600
}

fn is_default_tab_ratio(t: &u32) -> bool {
    *t == 600
}
