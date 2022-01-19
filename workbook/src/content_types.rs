use std::{borrow::Cow, io::Write};

use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};

use crate::{
    errors::Result,
    namespace::Namespaces,
    xml_element::{
        OpenXmlDeserializeDefault, OpenXmlElementInfo, OpenXmlElementType, OpenXmlSerialize,
    },
};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename = "Types", rename_all = "PascalCase")]
pub struct ContentTypes {
    #[serde(flatten)]
    pub namespaces: Namespaces,
    #[serde(default = "Vec::new")]
    default: Vec<Default>,
    #[serde(default = "Vec::new", rename = "Override")]
    overrides: Vec<Override>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
struct Default {
    extension: String,
    content_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
struct Override {
    part_name: String,
    content_type: String,
}

impl OpenXmlDeserializeDefault for ContentTypes {}

impl OpenXmlElementInfo for ContentTypes {
    fn tag_name() -> &'static str {
        "Types"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlSerialize for ContentTypes {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.default)?;
        quick_xml::se::to_writer(writer.inner(), &self.overrides)?;
        Ok(())
    }
}
