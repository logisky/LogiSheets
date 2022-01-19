use std::borrow::Cow;
use std::io::Write;

use crate::namespace::Namespaces;
use crate::xml_element::OpenXmlDeserializeDefault;
use crate::xml_element::{OpenXmlElementInfo, OpenXmlElementType, OpenXmlSerialize};
use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename = "cp:coreProperties", rename_all = "camelCase")]
pub struct CoreProperties {
    #[serde(flatten)]
    pub namespaces: Namespaces,
    pub category: Option<Category>,
    pub content_status: Option<ContentStatus>,
    pub created: Option<Created>,
    pub creator: Option<Creator>,
    pub description: Option<Description>,
    pub identifier: Option<Identifier>,
    pub keywords: Option<Keywords>,
    pub language: Option<Language>,
    pub last_modified_by: Option<LastModifiedBy>,
    pub last_printed: Option<LastPrinted>,
    pub modified: Option<Modified>,
    pub revision: Option<Revision>,
    pub subject: Option<Subject>,
    pub title: Option<Title>,
    pub version: Option<Version>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "cp:category")]
pub struct Category(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "cp:contentStatus")]
pub struct ContentStatus(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "dcterms:created")]
pub struct Created {
    #[serde(rename = "$value")]
    value: Option<String>,
    #[serde(rename = "xsi:type")]
    i_type: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "dc:creator")]
pub struct Creator(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "dc:description")]
pub struct Description(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "dc:identifier")]
pub struct Identifier(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "dc:language")]
pub struct Language(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "cp:lastModifiedBy")]
pub struct LastModifiedBy(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "cp:lastPrinted")]
pub struct LastPrinted(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "dcterms:modified")]
pub struct Modified {
    #[serde(rename = "$value")]
    value: Option<String>,
    #[serde(rename = "xsi:type")]
    i_type: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "cp:revision")]
pub struct Revision(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "dc:subject")]
pub struct Subject(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "dc:title")]
pub struct Title(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "cp:version")]
pub struct Version(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "cp:keywords")]
pub struct Keywords {
    #[serde(rename = "$value")]
    k: Option<String>,
    #[serde(rename = "xml:lang")]
    lang: Option<String>,
    value: Vec<Keyword>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "value")]
pub struct Keyword {
    #[serde(rename = "$value")]
    k: Option<String>,
    #[serde(rename = "xml:lang")]
    lang: Option<String>,
}

impl OpenXmlElementInfo for CoreProperties {
    fn tag_name() -> &'static str {
        "cp:coreProperties"
    }
    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlSerialize for CoreProperties {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }
    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }
    fn write_inner<W: Write>(&self, writer: W) -> crate::errors::Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.category)?;
        quick_xml::se::to_writer(writer.inner(), &self.content_status)?;
        quick_xml::se::to_writer(writer.inner(), &self.creator)?;
        quick_xml::se::to_writer(writer.inner(), &self.description)?;
        quick_xml::se::to_writer(writer.inner(), &self.identifier)?;
        quick_xml::se::to_writer(writer.inner(), &self.keywords)?;
        quick_xml::se::to_writer(writer.inner(), &self.language)?;
        quick_xml::se::to_writer(writer.inner(), &self.last_modified_by)?;
        quick_xml::se::to_writer(writer.inner(), &self.last_printed)?;
        quick_xml::se::to_writer(writer.inner(), &self.created)?;
        quick_xml::se::to_writer(writer.inner(), &self.modified)?;
        quick_xml::se::to_writer(writer.inner(), &self.revision)?;
        quick_xml::se::to_writer(writer.inner(), &self.subject)?;
        quick_xml::se::to_writer(writer.inner(), &self.title)?;
        quick_xml::se::to_writer(writer.inner(), &self.version)?;
        Ok(())
    }
}

impl OpenXmlDeserializeDefault for CoreProperties {}
