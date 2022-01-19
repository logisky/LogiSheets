use crate::errors::Result;
use crate::namespace::Namespaces;
use crate::variant::Variant;
use crate::xml_element::*;
use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Properties {
    #[serde(flatten)]
    namespaces: Namespaces,
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub property: Vec<Property>,
}

impl OpenXmlElementInfo for Properties {
    fn tag_name() -> &'static str {
        "Properties"
    }
    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlSerialize for Properties {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.property)?;
        Ok(())
    }
}

impl OpenXmlDeserializeDefault for Properties {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "property")]
pub struct Property {
    pub fmtid: String,
    pub pid: i32,
    pub name: Option<String>,
    pub link_target: Option<String>,
    #[serde(rename = "$value")]
    pub value: Variant,
}
