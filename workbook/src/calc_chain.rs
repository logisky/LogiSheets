use crate::defaults::*;
use crate::errors::Result;
use crate::simple_types::*;
use crate::xml_element::*;
use crate::{complex_types::*, namespace::Namespaces};
use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "calcChain")]
pub struct CalcChainPart {
    // At least 1 element.
    pub c: Vec<CalcCell>,
    pub ext_lst: Option<ExtLst>,
    #[serde(flatten)]
    namespaces: Namespaces,
}

impl OpenXmlElementInfo for CalcChainPart {
    fn tag_name() -> &'static str {
        "calcChain"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlDeserializeDefault for CalcChainPart {}

impl OpenXmlSerialize for CalcChainPart {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.c)?;
        quick_xml::se::to_writer(writer.inner(), &self.ext_lst)?;
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "c")]
pub struct CalcCell {
    pub r: StCellRef,
    #[serde(
        default = "default_zero_i32",
        skip_serializing_if = "is_default_zero_i32"
    )]
    pub i: i32,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub s: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub l: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub t: bool,
    #[serde(
        default = "default_as_false",
        skip_serializing_if = "is_default_false",
        serialize_with = "serialize_bool"
    )]
    pub a: bool,
}

fn default_zero_i32() -> i32 {
    0
}

fn is_default_zero_i32(t: &i32) -> bool {
    *t == 0
}
