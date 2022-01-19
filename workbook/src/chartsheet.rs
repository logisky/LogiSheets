use crate::complex_types::*;
use crate::defaults::*;
use crate::errors::Result;
use crate::namespace::Namespaces;
use crate::simple_types::*;
use crate::xml_element::*;
use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::Write;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartsheetPart {
    #[serde(flatten)]
    namespaces: Namespaces,
    pub sheet_pr: Option<ChartsheetPr>,
    pub sheet_views: ChartsheetViews,
    pub sheet_protection: Option<ChartsheetProtection>,
    pub custom_sheet_views: Option<CustomChartsheetViews>,
    pub page_margins: Option<PageMargins>,
    pub header_footer: Option<HeaderFooter>,
    pub drawing: Drawing,
    pub drawing_h_f: Option<DrawingHf>,
    pub picture: Option<SheetBackgroundPicture>,
    pub ext_lst: Option<ExtLst>,
}

impl OpenXmlElementInfo for ChartsheetPart {
    fn tag_name() -> &'static str {
        "chartsheet"
    }
    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlSerialize for ChartsheetPart {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.sheet_pr)?;
        quick_xml::se::to_writer(writer.inner(), &self.sheet_views)?;
        quick_xml::se::to_writer(writer.inner(), &self.sheet_protection)?;
        quick_xml::se::to_writer(writer.inner(), &self.custom_sheet_views)?;
        quick_xml::se::to_writer(writer.inner(), &self.page_margins)?;
        quick_xml::se::to_writer(writer.inner(), &self.header_footer)?;
        quick_xml::se::to_writer(writer.inner(), &self.drawing)?;
        quick_xml::se::to_writer(writer.inner(), &self.drawing_h_f)?;
        quick_xml::se::to_writer(writer.inner(), &self.picture)?;
        quick_xml::se::to_writer(writer.inner(), &self.ext_lst)?;
        Ok(())
    }
}

impl OpenXmlDeserializeDefault for ChartsheetPart {}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetBackgroundPicture")]
pub struct SheetBackgroundPicture {
    #[serde(rename = "r:id")]
    pub r_id: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customChartsheetViews")]
pub struct CustomChartsheetViews {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub custom_sheet_view: Vec<CustomChartsheetView>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customChartsheetView")]
pub struct CustomChartsheetView {
    pub page_margins: Option<PageMargins>,
    pub page_setup: Option<CsPageSetup>,
    pub header_footer: Option<HeaderFooter>,
    pub guid: StGuid,
    #[serde(default = "default_scale", skip_serializing_if = "is_default_scale")]
    pub scale: u32,
    #[serde(default = "StSheetState::DefaultBuilder::Visible")]
    pub state: StSheetState::Type,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub zoom_to_fit: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename = "csPageSetup")]
pub struct CsPageSetup {
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub paper_size: u32,
    pub paper_height: Option<String>,
    pub paper_width: Option<String>,
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub first_page_number: u32,
    #[serde(default = "StOrientation::DefaultBuilder::Default")]
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
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub use_first_page_number: bool,
    #[serde(default = "default_dpi", skip_serializing_if = "is_default_dpi")]
    pub horizontal_dpi: u32,
    #[serde(default = "default_dpi", skip_serializing_if = "is_default_dpi")]
    pub vertical_dpi: u32,
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub copies: u32,
    #[serde(rename = "r:id")]
    pub r_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetPr")]
pub struct ChartsheetPr {
    pub tab_color: Option<Color>,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub published: bool,
    pub code_name: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetViews")]
pub struct ChartsheetViews {
    // At least 1 element.
    pub sheet_view: Vec<ChartsheetView>,
    pub ext_lst: Option<ExtLst>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sheetViews")]
pub struct ChartsheetView {
    pub ext_lst: Option<ExtLst>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub tab_selected: bool,
    #[serde(
        default = "default_zoom_scale",
        skip_serializing_if = "is_default_zoom_scale"
    )]
    pub zoom_scale: u32,
    pub workbook_view_id: u32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub zoom_to_fit: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename = "charsheetProtection")]
pub struct ChartsheetProtection {
    pub algorithm_name: Option<String>,
    pub hash_value: Option<String>,
    pub salt_value: Option<String>,
    pub spin_count: Option<u32>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub content: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub objects: bool,
}
