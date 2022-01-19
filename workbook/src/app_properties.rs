use crate::namespace::Namespaces;
use crate::variant::Variant;
use crate::xml_element::*;
use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename = "Properties", rename_all = "PascalCase")]
pub struct AppProperties {
    #[serde(flatten)]
    pub namespaces: Namespaces,
    pub template: Option<Template>,
    pub manager: Option<Manager>,
    pub company: Option<Company>,
    pub pages: Option<i32>,
    pub words: Option<i32>,
    pub characters: Option<i32>,
    pub presentation_format: Option<PresentationFormat>,
    pub lines: Option<i32>,
    pub paragraphs: Option<i32>,
    pub slides: Option<i32>,
    pub notes: Option<i32>,
    pub total_time: Option<i32>,
    pub hidden_slides: Option<i32>,
    pub m_m_clips: Option<i32>,
    pub scale_crop: Option<ScaleCrop>,
    pub heading_pairs: Option<HeadingPairs>,
    pub titles_of_parts: Option<TitlesOfParts>,
    pub links_up_to_date: Option<LinksUpToDate>,
    pub characters_with_spaces: Option<CharactersWithSpaces>,
    pub shared_doc: Option<SharedDoc>,
    pub hyperlink_base: Option<HyperlinkBase>,
    // pub h_links: Option<VectorVariant>,
    pub hyperlinks_changed: Option<HyperlinksChanged>,
    // pub dig_sig: Option<DigSigBlob>,
    pub application: Option<Application>,
    pub app_version: Option<AppVersion>,
    pub doc_security: Option<DocSecurity>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CharactersWithSpaces(i32);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct LinksUpToDate(bool);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SharedDoc(bool);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ScaleCrop(bool);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct PresentationFormat(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Company(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Template(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Manager(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct HyperlinkBase(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct HyperlinksChanged(bool);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DocSecurity(i32);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Application(String);

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AppVersion(String);

impl OpenXmlElementInfo for AppProperties {
    fn tag_name() -> &'static str {
        "Properties"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlSerialize for AppProperties {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }
    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }
    fn write_inner<W: Write>(&self, writer: W) -> crate::errors::Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.application)?;
        quick_xml::se::to_writer(writer.inner(), &self.doc_security)?;
        quick_xml::se::to_writer(writer.inner(), &self.scale_crop)?;
        quick_xml::se::to_writer(writer.inner(), &self.heading_pairs)?;
        quick_xml::se::to_writer(writer.inner(), &self.titles_of_parts)?;
        quick_xml::se::to_writer(writer.inner(), &self.company)?;
        quick_xml::se::to_writer(writer.inner(), &self.links_up_to_date)?;
        quick_xml::se::to_writer(writer.inner(), &self.shared_doc)?;
        quick_xml::se::to_writer(writer.inner(), &self.hyperlinks_changed)?;
        quick_xml::se::to_writer(writer.inner(), &self.app_version)?;
        quick_xml::se::to_writer(writer.inner(), &self.template)?;
        quick_xml::se::to_writer(writer.inner(), &self.manager)?;
        quick_xml::se::to_writer(writer.inner(), &self.pages)?;
        quick_xml::se::to_writer(writer.inner(), &self.words)?;
        quick_xml::se::to_writer(writer.inner(), &self.characters)?;
        quick_xml::se::to_writer(writer.inner(), &self.lines)?;
        quick_xml::se::to_writer(writer.inner(), &self.slides)?;
        quick_xml::se::to_writer(writer.inner(), &self.notes)?;
        quick_xml::se::to_writer(writer.inner(), &self.total_time)?;
        quick_xml::se::to_writer(writer.inner(), &self.hidden_slides)?;
        quick_xml::se::to_writer(writer.inner(), &self.m_m_clips)?;
        quick_xml::se::to_writer(writer.inner(), &self.paragraphs)?;
        Ok(())
    }
}

impl OpenXmlDeserializeDefault for AppProperties {}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeadingPairs {
    #[serde(rename(deserialize = "$value"))]
    variant: Variant,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TitlesOfParts {
    #[serde(rename(deserialize = "$value", serialize = "vt:vector"))]
    value: Variant,
}
