use linked_hash_map::LinkedHashMap;
use quick_xml::events::attributes::Attribute;
use serde::de::{Deserialize, Deserializer, MapAccess, Visitor};
use serde::ser::{Serialize, SerializeMap, Serializer};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Namespaces {
    map: LinkedHashMap<String, String>,
}

impl Namespaces {
    pub fn new<S: Into<String>>(uri: S) -> Self {
        let mut ns = Namespaces::default();
        ns.set_default_namespace(uri);
        ns
    }

    pub fn add_namespace<S1: Into<String>, S2: Into<String>>(&mut self, decl: S1, uri: S2) {
        self.map.insert(decl.into(), uri.into());
    }

    pub fn remove_namespace(&mut self, decl: &str) {
        self.map.remove(decl);
    }

    pub fn set_default_namespace<S: Into<String>>(&mut self, uri: S) {
        self.add_namespace("xmlns", uri);
    }

    pub fn to_xml_attributes(&self) -> Vec<Attribute> {
        self.map
            .iter()
            .map(|(k, v)| Attribute {
                key: k.as_bytes(),
                value: v.as_bytes().into(),
            })
            .collect()
    }
}

struct ContentTypesVisitor;

impl<'de> Visitor<'de> for ContentTypesVisitor {
    type Value = Namespaces;

    // Format a message stating what data this Visitor expects to receive.
    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("unexpected namespace attribute")
    }

    fn visit_map<M>(self, mut access: M) -> Result<Self::Value, M::Error>
    where
        M: MapAccess<'de>,
    {
        let mut ns = Namespaces::default();
        while let Some(key) = access.next_key()? {
            let key: String = key;
            let value: String = access.next_value()?;
            ns.add_namespace(key, value);
            // let key: String = key;
            // match key {
            //     s if s.starts_with("xmlns") => {
            //         let xmlns: String = access.next_value()?;
            //         ns.add_namespace(s, xmlns);
            //     }
            //     s => unreachable!("{:?}", s),
            // }
        }
        Ok(ns)
    }
}

impl<'de> Deserialize<'de> for Namespaces {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_map(ContentTypesVisitor)
    }
}

impl Serialize for Namespaces {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(Some(self.map.len()))?;
        for (k, v) in &self.map {
            map.serialize_entry(k, v)?;
        }
        map.end()
    }
}
