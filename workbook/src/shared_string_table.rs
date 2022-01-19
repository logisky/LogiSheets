use crate::complex_types::*;
use crate::errors::Result;
use crate::namespace::Namespaces;
use crate::xml_element::*;
use quick_xml::events::attributes::Attribute;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename = "sst")]
pub struct SstPart {
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub si: Vec<SiRst>,
    // TODO: Turns the Option<String> to u32.
    pub count: Option<String>,
    pub unique_count: Option<String>,
    #[serde(flatten)]
    namespaces: Namespaces,
}

impl SstPart {
    pub fn get_count(&self) -> u32 {
        if let Some(c) = &self.count {
            let r = c.parse::<u32>();
            if r.is_err() {
                0
            } else {
                r.unwrap()
            }
        } else {
            0
        }
    }

    pub fn get_unique_count(&self) -> u32 {
        if let Some(uc) = &self.count {
            let r = uc.parse::<u32>();
            if r.is_err() {
                0
            } else {
                r.unwrap()
            }
        } else {
            0
        }
    }

    pub fn set_count(&mut self, c: u32) {
        self.count = Some(c.to_string());
    }

    pub fn set_unique_count(&mut self, uc: u32) {
        self.unique_count = Some(uc.to_string());
    }
}

// A Rst struct and used in sst. Because it will be renamed to `si`.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename = "si")]
pub struct SiRst {
    pub t: Option<PlainText>,
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub r: Vec<RElt>,
    #[serde(default = "Vec::new", skip_serializing_if = "Vec::is_empty")]
    pub r_ph: Vec<PhoneticRun>,
    pub phonetic_pr: Option<PhoneticPr>,
}

impl OpenXmlElementInfo for SstPart {
    fn tag_name() -> &'static str {
        "sst"
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Root
    }
}

impl OpenXmlDeserializeDefault for SstPart {}

impl OpenXmlSerialize for SstPart {
    fn namespaces(&self) -> Option<Cow<Namespaces>> {
        Some(Cow::Borrowed(&self.namespaces))
    }

    fn attributes(&self) -> Option<Vec<Attribute>> {
        let mut v: Vec<Attribute> = Vec::with_capacity(2);
        if let Some(c) = &self.count {
            v.push(Attribute {
                key: "count".as_bytes(),
                value: c.as_bytes().into(),
            })
        }
        if let Some(uc) = &self.unique_count {
            v.push(Attribute {
                key: "uniqueCount".as_bytes(),
                value: uc.as_bytes().into(),
            })
        }
        if v.len() == 0 {
            None
        } else {
            Some(v)
        }
    }

    fn write_inner<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        // quick_xml::se::to_writer(writer.inner(), &self.si)?;
        quick_xml::se::to_writer(writer.inner(), &self.si)?;
        Ok(())
    }
}
