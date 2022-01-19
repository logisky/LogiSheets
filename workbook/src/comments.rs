use std::borrow::Cow;
use std::io::Write;

use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};

use crate::{
    complex_types::*,
    errors::Result,
    namespace::Namespaces,
    xml_element::{OpenXmlDeserializeDefault, OpenXmlSerialize},
};
use crate::{defaults::*, xml_element::OpenXmlElementInfo};
use crate::{simple_types::*, xml_element::OpenXmlElementType};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "comments")]
pub struct Comments {
    #[serde(flatten)]
    namespaces: Namespaces,
    pub authors: Authors,
    pub comment_list: CommentList,
    pub ext_list: Option<ExtLst>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "authors")]
pub struct Authors {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub author: Vec<PlainText>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "commentList")]
pub struct CommentList {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub comment: Vec<Comment>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "comment")]
pub struct Comment {
    #[serde(rename(deserialize = "text"))]
    pub text: Rst,
    pub comment_pr: Option<CommentPr>,
    #[serde(rename = "ref")]
    pub reference: StRef,
    pub author_id: usize,
    pub guid: Option<StGuid>,
    pub shape_id: Option<u32>,
    #[serde(rename = "xr:uid")]
    uid: Option<String>,
}

impl OpenXmlElementInfo for Comments {
    fn tag_name() -> &'static str {
        "comments"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlSerialize for Comments {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        None
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        quick_xml::se::to_writer(writer.inner(), &self.authors)?;
        quick_xml::se::to_writer(writer.inner(), &self.comment_list)?;
        quick_xml::se::to_writer(writer.inner(), &self.ext_list)?;
        Ok(())
    }
}

impl OpenXmlDeserializeDefault for Comments {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "commentPr")]
pub struct CommentPr {
    pub anchor: ObjectAnchor,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub locked: bool,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub default_size: bool,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub print: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub disabled: bool,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub auto_fill: bool,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub auto_line: bool,
    pub alt_text: Option<String>,
    #[serde(default = "StTextHAlign::DefaultBuilder::Left")]
    pub text_h_align: StTextHAlign::Type,
    #[serde(default = "StTextVAlign::DefaultBuilder::Top")]
    pub text_v_align: StTextVAlign::Type,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub lock_text: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub just_last_x: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub auto_scale: bool,
}
