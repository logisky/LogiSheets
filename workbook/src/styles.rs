use crate::complex_types::*;
use crate::defaults::*;
use crate::errors::Result;
use crate::namespace::Namespaces;
use crate::simple_types::*;
use crate::xml_element::*;
use macros::{Handler, OoxmlHash};
use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", rename = "styleSheet")]
pub struct StyleSheetPart {
    #[serde(flatten)]
    namespaces: Namespaces,
    pub num_fmts: Option<NumFmts>,
    pub fonts: Option<Fonts>,
    pub fills: Option<Fills>,
    pub borders: Option<Borders>,
    pub cell_style_xfs: Option<CellStyleXfs>,
    pub cell_xfs: Option<CellXfs>,
    pub cell_styles: Option<CellStyles>,
    pub dxfs: Option<Dxfs>,
    pub table_styles: Option<TableStyles>,
    pub colors: Option<Colors>,
    #[serde(skip_serializing)]
    pub ext_lst: Option<ExtLst>,
}

impl OpenXmlElementInfo for StyleSheetPart {
    fn tag_name() -> &'static str {
        "styleSheet"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlDeserializeDefault for StyleSheetPart {}

impl OpenXmlSerialize for StyleSheetPart {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.num_fmts)?;
        quick_xml::se::to_writer(writer.inner(), &self.fonts)?;
        quick_xml::se::to_writer(writer.inner(), &self.fills)?;
        quick_xml::se::to_writer(writer.inner(), &self.borders)?;
        quick_xml::se::to_writer(writer.inner(), &self.cell_style_xfs)?;
        quick_xml::se::to_writer(writer.inner(), &self.cell_xfs)?;
        quick_xml::se::to_writer(writer.inner(), &self.cell_styles)?;
        quick_xml::se::to_writer(writer.inner(), &self.dxfs)?;
        quick_xml::se::to_writer(writer.inner(), &self.table_styles)?;
        quick_xml::se::to_writer(writer.inner(), &self.colors)?;
        quick_xml::se::to_writer(writer.inner(), &self.ext_lst)?;
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "colors")]
pub struct Colors {
    pub indexed_colors: Option<IndexedColors>,
    pub mru_colors: Option<MRUColors>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "indexedColors")]
pub struct IndexedColors {
    // At least 1 element.
    pub rgb_color: Vec<RgbColor>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "mruColors")]
pub struct MRUColors {
    // At least 1 element
    pub color: Vec<Color>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "rgbColors")]
pub struct RgbColor {
    pub rgb: Option<StUnsignedIntHex>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableStyles")]
pub struct TableStyles {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub table_style: Vec<TableStyle>,
    pub count: Option<u32>,
    pub default_table_style: Option<String>,
    pub default_pivot_style: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableStyles")]
pub struct TableStyle {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub table_style_element: Vec<TableStyleElement>,
    pub name: String,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub pivot: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub table: bool,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "tableStyleElement")]
pub struct TableStyleElement {
    #[serde(rename = "type")]
    pub ty: StTableStyleType::Type,
    #[serde(default = "default_one", skip_serializing_if = "is_default_one")]
    pub size: u32,
    pub dxf_id: Option<StDxfId>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "dxfs")]
pub struct Dxfs {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub dxf: Vec<Dxf>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "dxf")]
pub struct Dxf {
    pub font: Option<Font>,
    pub num_fmt: Option<NumFmt>,
    pub fill: Option<Fill>,
    pub alignment: Option<CellAlignment>,
    pub border: Option<Border>,
    pub protection: Option<CellProtection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellStyles")]
pub struct CellStyles {
    // At least 1 element.
    pub cell_style: Vec<CellStyle>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellStyle")]
pub struct CellStyle {
    pub name: Option<String>,
    pub xf_id: StCellStyleXfId,
    pub builtin_id: Option<u32>,
    pub i_level: Option<u32>,
    pub hidden: Option<bool>,
    pub custom_builtin: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellXfs")]
pub struct CellXfs {
    // At least 1 element,
    pub xf: Vec<Xf>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "cellStyleXfs")]
pub struct CellStyleXfs {
    // At least 1 element.
    pub xf: Vec<Xf>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", rename = "xf")]
pub struct Xf {
    pub alignment: Option<CellAlignment>,
    pub protection: Option<CellProtection>,
    pub num_fmt_id: Option<StNumFmtId>,
    pub font_id: Option<StFontId>,
    pub fill_id: Option<StFillId>,
    pub border_id: Option<StBorderId>,
    // For xf records contained in cellXfs this is the zero-based index of an xf
    // record contained in cellStyleXfs corresponding to the cell style applied
    // to the cell.
    // Not present for xf records contained in cellStyleXfs.
    pub xf_id: Option<StCellStyleXfId>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub quote_prefix: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub pivot_button: bool,
    /// The default values of these attributes depend on parent node.
    /// The default values for these attributes in cellStyleXfs are true,
    /// and are false in cellXfs.
    /// https://docs.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/68362a4b-5589-4504-b566-e8154dce1de3
    #[serde(serialize_with = "serialize_option_bool")]
    pub apply_number_format: Option<bool>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub apply_font: Option<bool>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub apply_fill: Option<bool>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub apply_border: Option<bool>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub apply_alignment: Option<bool>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub apply_protection: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, PartialEq, Eq)]
#[serde(rename_all = "camelCase", rename = "cellProtection")]
pub struct CellProtection {
    #[serde(serialize_with = "serialize_option_bool")]
    pub locked: Option<bool>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub hidden: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, PartialEq, Eq, Handler)]
#[serde(rename_all = "camelCase", rename = "cellAlignment")]
pub struct CellAlignment {
    pub horizontal: Option<StHorizontalAlignment::Type>,
    pub vertical: Option<StVerticalAlignment::Type>,
    pub text_rotation: Option<u32>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub wrap_text: Option<bool>,
    pub indent: Option<u32>,
    pub relative_indent: Option<i32>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub justify_last_line: Option<bool>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub shrink_to_fit: Option<bool>,
    pub reading_order: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "borders")]
pub struct Borders {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub border: Vec<Border>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, Handler, Hash, PartialEq, Eq)]
#[serde(rename_all = "camelCase", rename = "border")]
pub struct Border {
    pub left: Option<BorderPr>,
    pub right: Option<BorderPr>,
    pub top: Option<BorderPr>,
    pub bottom: Option<BorderPr>,
    pub diagonal: Option<BorderPr>,
    pub vertical: Option<BorderPr>,
    pub horizontal: Option<BorderPr>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub diagonal_up: Option<bool>,
    #[serde(serialize_with = "serialize_option_bool")]
    pub diagonal_down: Option<bool>,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub outline: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Hash, Eq)]
#[serde(rename_all = "camelCase", rename = "borderPr")]
pub struct BorderPr {
    pub color: Option<Color>,
    #[serde(
        default = "StBorderStyle::DefaultBuilder::None",
        skip_serializing_if = "StBorderStyle::DefaultBuilder::isNone"
    )]
    pub style: StBorderStyle::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "fills")]
pub struct Fills {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub fill: Vec<Fill>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Handler, Default, Hash, PartialEq, Eq)]
#[serde(rename_all = "camelCase", rename = "fill")]
pub struct Fill {
    // choice
    pub pattern_fill: Option<PatternFill>,
    pub gradient_fill: Option<GradientFill>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Handler, OoxmlHash)]
#[serde(rename_all = "camelCase", rename = "gradientFill")]
pub struct GradientFill {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub stop: Vec<GradientStop>,
    #[serde(
        rename = "type",
        default = "StGradientType::DefaultBuilder::Linear",
        skip_serializing_if = "StGradientType::DefaultBuilder::isLinear"
    )]
    pub ty: StGradientType::Type,
    #[serde(
        default = "default_zero_f64",
        skip_serializing_if = "is_default_zero_f64"
    )]
    pub degree: f64,
    #[serde(
        default = "default_zero_f64",
        skip_serializing_if = "is_default_zero_f64"
    )]
    pub left: f64,
    #[serde(
        default = "default_zero_f64",
        skip_serializing_if = "is_default_zero_f64"
    )]
    pub right: f64,
    #[serde(
        default = "default_zero_f64",
        skip_serializing_if = "is_default_zero_f64"
    )]
    pub top: f64,
    #[serde(
        default = "default_zero_f64",
        skip_serializing_if = "is_default_zero_f64"
    )]
    pub bottom: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "gradientStop")]
pub struct GradientStop {
    pub color: Color,
    pub position: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Handler, Default, Hash, PartialEq, Eq)]
#[serde(rename_all = "camelCase", rename = "patternFill")]
pub struct PatternFill {
    pub fg_color: Option<Color>,
    pub bg_color: Option<Color>,
    pub pattern_type: Option<StPatternType::Type>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "fonts")]
pub struct Fonts {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub font: Vec<Font>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Handler, Default, Hash, PartialEq, Eq)]
#[serde(rename_all = "camelCase", rename = "font")]
pub struct Font {
    pub b: Option<BooleanProperty>,
    pub i: Option<BooleanProperty>,
    pub u: Option<UnderlineProperty>,
    pub color: Option<Color>,
    pub sz: Option<FontSize>,
    pub name: Option<FontName>,
    pub charset: Option<IntProperty>,
    pub family: Option<FontFamily>,
    pub strike: Option<BooleanProperty>,
    pub outline: Option<BooleanProperty>,
    pub shadow: Option<BooleanProperty>,
    pub condense: Option<BooleanProperty>,
    pub extend: Option<BooleanProperty>,
    pub vert_align: Option<VerticalAlignFontProperty>,
    pub scheme: Option<FontScheme>,
    pub ext_lst: Option<ExtLst>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "numFmts")]
pub struct NumFmts {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub num_fmt: Vec<NumFmt>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
#[serde(rename_all = "camelCase", rename = "numFmt")]
pub struct NumFmt {
    pub num_fmt_id: StNumFmtId,
    pub format_code: String,
}
