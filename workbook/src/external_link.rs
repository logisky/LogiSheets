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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalLink")]
pub struct ExternalLinkPart {
    #[serde(flatten)]
    namespaces: Namespaces,
    // Choice
    pub external_book: Option<ExternalBook>,
    pub dde_link: Option<DdeLink>,
    pub ole_link: Option<OleLink>,

    pub ext_lst: Option<ExtLst>,
}

impl OpenXmlElementInfo for ExternalLinkPart {
    fn tag_name() -> &'static str {
        "externalLink"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlDeserializeDefault for ExternalLinkPart {}

impl OpenXmlSerialize for ExternalLinkPart {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.external_book)?;
        quick_xml::se::to_writer(writer.inner(), &self.dde_link)?;
        quick_xml::se::to_writer(writer.inner(), &self.ole_link)?;
        quick_xml::se::to_writer(writer.inner(), &self.ext_lst)?;
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "oleLink")]
pub struct OleLink {
    pub ole_items: Option<OleItems>,
    #[serde(rename = "r:id")]
    pub r_id: String,
    pub prog_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "oleItems")]
pub struct OleItems {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub ole_item: Vec<OleItem>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "oleItem")]
pub struct OleItem {
    pub name: String,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub icon: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub advise: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub prefer_pic: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "ddeLink")]
pub struct DdeLink {
    pub dde_items: Option<DdeItems>,
    pub dde_service: String,
    pub dde_topic: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "ddeItems")]
pub struct DdeItems {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub dde_item: Vec<DdeItem>,
    pub dde_service: String,
    pub dde_topic: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "ddeItem")]
pub struct DdeItem {
    pub values: Option<DdeValues>,
    #[serde(default = "default_zero_string")]
    pub name: String,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub ole: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub advise: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub prefer_pic: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "ddeValues")]
pub struct DdeValues {
    // At least 1 element.
    pub value: Vec<DdeValue>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "ddeValue")]
pub struct DdeValue {
    pub val: String,
    #[serde(
        default = "StDdeValueType::DefaultBuilder::N",
        skip_serializing_if = "StDdeValueType::DefaultBuilder::isN"
    )]
    pub t: StDdeValueType::Type,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalBook")]
pub struct ExternalBook {
    #[serde(rename = "xmlns:r")]
    pub xmlns_r: Option<String>,
    #[serde(rename = "r:id")]
    pub r_id: String,
    pub sheet_names: Option<ExternalSheetNames>,
    pub defined_names: Option<ExternalDefinedNames>,
    pub sheet_data_set: Option<ExternalSheetDataSet>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalBook")]
pub struct ExternalSheetDataSet {
    // At least 1 element
    pub sheet_data: Vec<ExternalSheetData>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalSheetData")]
pub struct ExternalSheetData {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub row: Vec<ExternalRow>,
    pub sheet_id: usize,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub refresh_error: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalRow")]
pub struct ExternalRow {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub cell: Vec<ExternalCell>,
    pub r: u32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalCell")]
pub struct ExternalCell {
    pub v: PlainText,
    pub r: Option<StCellRef>,
    #[serde(
        default = "StCellType::DefaultBuilder::N",
        skip_serializing_if = "StCellType::DefaultBuilder::isN"
    )]
    pub t: StCellType::Type,
    #[serde(default = "default_zero", skip_serializing_if = "is_default_zero")]
    pub vm: u32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalSheetNames")]
pub struct ExternalSheetNames {
    // At least 1 element.
    pub sheet_name: Vec<ExternalSheetName>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalSheetName")]
pub struct ExternalSheetName {
    pub val: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalDefinedNames")]
pub struct ExternalDefinedNames {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub defined_name: Vec<ExternalDefinedName>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "externalDefinedName")]
pub struct ExternalDefinedName {
    pub name: String,
    pub refers_to: String,
}

fn default_zero_string() -> String {
    String::from("0")
}
