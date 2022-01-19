use quick_xml::events::{attributes::Attribute, BytesDecl, BytesEnd, BytesStart, Event};
use std::io::prelude::Write;
use std::io::{BufRead, BufReader};
use std::{borrow::Cow, fs::File, marker::Sized, path::Path};

use crate::errors::Result;
use crate::namespace::Namespaces;

pub enum OpenXmlElementType {
    /// Plain text
    Leaf,
    /// Internal xml element
    Node,
    /// Root
    Root,
}

pub trait OpenXmlLeafElement {}
pub trait OpenXmlNodeElement {}
pub trait OpenXmlRootElement {}

pub trait OpenXmlElementInfo: Sized {
    fn tag_name() -> &'static str;

    fn as_bytes_start() -> BytesStart<'static> {
        assert!(Self::have_tag_name());
        BytesStart::borrowed_name(Self::tag_name().as_bytes())
    }

    /// Helper function for xml end.
    fn as_bytes_end() -> BytesEnd<'static> {
        assert!(Self::have_tag_name());
        BytesEnd::borrowed(Self::tag_name().as_bytes())
    }

    fn have_tag_name() -> bool {
        match Self::element_type() {
            OpenXmlElementType::Root => true,
            _ => false,
        }
    }

    /// Check element type
    fn is_leaf_text_element() -> bool {
        match Self::element_type() {
            OpenXmlElementType::Leaf => true,
            _ => false,
        }
    }

    /// Check element type
    fn is_root_element() -> bool {
        match Self::element_type() {
            OpenXmlElementType::Root => true,
            _ => false,
        }
    }

    fn element_type() -> OpenXmlElementType {
        OpenXmlElementType::Node
    }

    fn can_have_children() -> bool {
        match Self::element_type() {
            OpenXmlElementType::Leaf => false,
            _ => true,
        }
    }

    fn can_have_attributes() -> bool {
        match Self::element_type() {
            OpenXmlElementType::Leaf => false,
            _ => true,
        }
    }
    /// If the element can have namespace declartions.
    fn can_have_namespace_declarations() -> bool {
        match Self::element_type() {
            OpenXmlElementType::Leaf => false,
            _ => true,
        }
    }
}

pub trait OpenXmlSerialize: OpenXmlElementInfo {
    fn attributes(&self) -> Option<Vec<Attribute>>;

    fn namespaces(&self) -> Option<Cow<Namespaces>>;

    fn write_inner<W: Write>(&self, writer: W) -> Result<()>;

    fn write_outter<W: Write>(&self, writer: W) -> Result<()> {
        let mut writer = quick_xml::Writer::new(writer);
        if Self::is_root_element() {
            writer.write_event(Event::Decl(BytesDecl::new(
                b"1.0",
                Some(b"UTF-8"),
                Some(b"yes"),
            )))?;
        }

        let mut ele = Self::as_bytes_start();
        if Self::can_have_namespace_declarations() {
            if let Some(ns) = self.namespaces() {
                ele.extend_attributes(ns.to_xml_attributes());
            }
        }
        if Self::can_have_attributes() {
            if let Some(attrs) = self.attributes() {
                ele.extend_attributes(attrs);
            }
        }
        if Self::is_leaf_text_element() {
            writer.write_event(Event::Empty(ele))?;
        } else {
            writer.write_event(Event::Start(ele))?;
            self.write_inner(writer.inner())?;
            writer.write_event(Event::End(Self::as_bytes_end()))?;
        }
        Ok(())
    }

    fn save_as<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let file = File::open(path)?;
        self.write_outter(file)
    }

    fn to_xml_bytes(&self) -> Result<Vec<u8>> {
        let mut container = Vec::new();
        self.write_outter(&mut container)?;
        Ok(container)
    }

    fn to_xml_string(&self) -> Result<String> {
        let bytes = self.to_xml_bytes()?;
        Ok(String::from_utf8_lossy(&bytes).to_string())
    }
}

pub trait OpenXmlSerializeDefault: serde::ser::Serialize {}

pub trait OpenXmlDeserialize: Sized {
    fn from_xml_reader<R: BufRead>(reader: R) -> Result<Self>;

    fn from_xml_str(s: &str) -> Result<Self> {
        Self::from_xml_reader(s.as_bytes())
    }

    fn from_xml_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        Self::from_xml_reader(reader)
    }
}

pub trait OpenXmlDeserializeDefault: serde::de::DeserializeOwned {}

impl<T: OpenXmlDeserializeDefault> OpenXmlDeserialize for T {
    fn from_xml_reader<R: BufRead>(reader: R) -> Result<Self> {
        Ok(quick_xml::de::from_reader(reader)?)
    }
}
