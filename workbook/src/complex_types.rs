use crate::defaults::*;
use crate::simple_types::*;
use macros::OoxmlHash;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
#[serde(rename_all = "camelCase", rename = "extLst")]
pub struct ExtLst {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "pageMargins")]
pub struct PageMargins {
    pub left: f64,
    pub right: f64,
    pub top: f64,
    pub bottom: f64,
    pub header: f64,
    pub footer: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "headerFooter")]
pub struct HeaderFooter {
    pub odd_header: Option<PlainText>,
    pub odd_footer: Option<PlainText>,
    pub even_header: Option<PlainText>,
    pub even_footer: Option<PlainText>,
    pub first_header: Option<PlainText>,
    pub first_footer: Option<PlainText>,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub different_odd_even: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub different_first: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub scale_with_doc: bool,
    #[serde(
        default = "default_as_true",
        skip_serializing_if = "is_default_true",
        serialize_with = "serialize_bool"
    )]
    pub align_with_margins: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "drawing")]
pub struct Drawing {
    #[serde(rename = "r:id")]
    pub r_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "drawingHF")]
pub struct DrawingHf {
    #[serde(rename = "r:id")]
    pub r_id: String,
    pub lho: Option<u32>,
    pub lhe: Option<u32>,
    pub lhf: Option<u32>,
    pub cho: Option<u32>,
    pub che: Option<u32>,
    pub chf: Option<u32>,
    pub rho: Option<u32>,
    pub rhe: Option<u32>,
    pub rhf: Option<u32>,
    pub lfo: Option<u32>,
    pub lfe: Option<u32>,
    pub lff: Option<u32>,
    pub cfo: Option<u32>,
    pub cfe: Option<u32>,
    pub cff: Option<u32>,
    pub rfo: Option<u32>,
    pub rfe: Option<u32>,
    pub rff: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "autoFilter")]
pub struct AutoFilter {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub filter_column: Vec<FilterColumn>,
    pub sort_state: Option<SortState>,
    #[serde(rename = "ref")]
    pub reference: StRef,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "autoFilter")]
pub struct SortState {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub sort_condition: Vec<SortCondition>,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub column_sort: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub case_sensitive: bool,
    #[serde(default = "StSortMethod::DefaultBuilder::None")]
    pub sort_method: StSortMethod::Type,
    #[serde(rename = "ref")]
    pub reference: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "sortCondition")]
pub struct SortCondition {
    pub descending: bool,
    pub sort_by: StSortBy::Type,
    #[serde(rename = "ref")]
    pub reference: StRef,
    pub custom_list: Option<String>,
    pub dxf_id: Option<StDxfId>,
    pub icon_set: Option<String>, // StIconSetType
    pub icon_id: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "filterColumn")]
pub struct FilterColumn {
    // Choice in filters, top10, custom_filters, dynamic_filter, icon_filter
    pub filters: Option<Filters>,
    pub top10: Option<Top10>,
    pub custom_filters: Option<CustomFilters>,
    pub dynamic_filter: Option<DynamicFilter>,
    pub color_filter: Option<ColorFilter>,
    pub icon_filter: Option<IconFilter>,
    pub col_id: u32,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub hidden_button: bool,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub show_button: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "top10")]
pub struct Top10 {
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub top: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub percent: bool,
    pub val: f64,
    pub filter_val: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "filters")]
pub struct Filters {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub filter: Vec<Filter>,
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub date_group_item: Vec<DateGroupItem>,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub blank: bool,
    #[serde(default = "StCalendarType::DefaultBuilder::None")]
    pub calendar_type: StCalendarType::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customFilters")]
pub struct CustomFilters {
    // At least 1 element. At most 2 element.
    pub custom_filter: Vec<CustomFilter>,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub and: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "customFilters")]
pub struct CustomFilter {
    #[serde(default = "StFilterOperator::DefaultBuilder::Equal")]
    pub operator: StFilterOperator::Type,
    pub val: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "filters")]
pub struct DateGroupItem {
    pub year: u8,
    pub month: Option<u8>,
    pub day: Option<u8>,
    pub hour: Option<u8>,
    pub minute: Option<u8>,
    pub second: Option<u8>,
    pub date_time_grouping: StDateTimeGrouping::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "filter")]
pub struct Filter {
    pub val: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "filterColumn")]
pub struct ColorFilter {
    pub dxf_id: Option<StDxfId>,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub cell_color: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "iconFilter")]
pub struct IconFilter {
    pub icon_set: String, // StIconSetType
    pub icon_id: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "dynamicFilter")]
pub struct DynamicFilter {
    #[serde(rename = "type")]
    pub ty: StDynamicFilterType::Type,
    pub val: Option<f64>,
    pub val_iso: Option<String>,     // Datetime
    pub max_val_iso: Option<String>, // Datetime
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "objectAnchor")]
pub struct ObjectAnchor {
    #[serde(rename = "xdr:from")]
    pub xdr_from: Option<PlainText>,
    #[serde(rename = "xdr:to")]
    pub xdr_to: Option<PlainText>,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub move_with_cells: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub size_with_cells: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "rst")]
pub struct Rst {
    pub t: Option<PlainText>,
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub r: Vec<RElt>,
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub r_ph: Vec<PhoneticRun>,
    pub phonetic_pr: Option<PhoneticPr>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RElt {
    pub r_pr: Option<RPrElt>,
    pub t: PlainText,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
pub struct UnderlineProperty {
    #[serde(
        default = "StUnderlineValues::DefaultBuilder::Single",
        skip_serializing_if = "StUnderlineValues::DefaultBuilder::isSingle"
    )]
    pub val: StUnderlineValues::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", rename = "RPrElt")]
pub struct RPrElt {
    // Choice
    pub b: Option<BooleanProperty>,
    pub i: Option<BooleanProperty>,
    pub sz: Option<FontSize>,
    pub color: Option<Color>,
    pub r_font: Option<FontName>,
    pub family: Option<IntProperty>,
    pub charset: Option<IntProperty>,
    pub strike: Option<BooleanProperty>,
    pub outline: Option<BooleanProperty>,
    pub shadow: Option<BooleanProperty>,
    pub condense: Option<BooleanProperty>,
    pub extend: Option<BooleanProperty>,
    pub u: Option<UnderlineProperty>,
    pub vert_align: Option<VerticalAlignFontProperty>,
    pub scheme: Option<FontScheme>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "phoneticPr")]
pub struct PhoneticPr {
    pub font_id: StFontId,
    #[serde(
        rename = "type",
        default = "StPhoneticType::DefaultBuilder::FullWidthKatakana",
        skip_serializing_if = "StPhoneticType::DefaultBuilder::isFullWidthKatakana"
    )]
    pub ty: StPhoneticType::Type,
    #[serde(
        default = "StPhoneticAlignment::DefaultBuilder::Left",
        skip_serializing_if = "StPhoneticAlignment::DefaultBuilder::isLeft"
    )]
    pub alignment: StPhoneticAlignment::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "RElt")]
pub struct PhoneticRun {
    pub t: PlainText,
    pub sb: u32,
    pub eb: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
pub struct VerticalAlignFontProperty {
    pub val: StVerticalAlignRun::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
pub struct FontFamily {
    pub val: StFontFamily,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
pub struct FontScheme {
    pub val: StFontScheme::Type,
}

#[derive(Debug, Serialize, Deserialize, Clone, OoxmlHash)]
pub struct FontSize {
    pub val: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
pub struct IntProperty {
    pub val: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
pub struct BooleanProperty {
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub val: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, Eq, PartialEq)]
pub struct PlainText {
    #[serde(rename = "$value", default = "default_empty_string")]
    pub value: String,
    #[serde(rename = "xml:space")]
    pub space: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, OoxmlHash)]
pub struct FontName {
    pub val: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, OoxmlHash)]
#[serde(rename_all = "camelCase", rename = "tabColor")]
pub struct Color {
    pub auto: Option<bool>,
    pub indexed: Option<u32>,
    pub rgb: Option<StUnsignedIntHex>,
    pub theme: Option<u32>,
    #[serde(
        default = "default_zero_f64",
        skip_serializing_if = "is_default_zero_f64"
    )]
    pub tint: f64,
    // #[serde(default = "default_zero_string", skip_serializing_if = "is_default_zero_string")]
    // tint: String,
}

fn default_empty_string() -> String {
    String::from("")
}
