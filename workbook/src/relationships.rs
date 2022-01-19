use crate::namespace::Namespaces;
use crate::xml_element::*;
use macros::serde_st_string_enum;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RelationshipsPart {
    #[serde(rename = "Relationship")]
    pub relationship: Vec<Relationship>,
    #[serde(flatten)]
    namespaces: Namespaces,
}

impl RelationshipsPart {
    pub fn get_relationship(&self, r_id: &str) -> Option<&Relationship> {
        self.relationship.iter().find(|r| r.id == r_id)
    }

    pub fn get_relationship_from_type(&self, tp: &str) -> Option<&Relationship> {
        self.relationship.iter().find(|r| r.ty == tp)
    }
}

impl OpenXmlElementInfo for RelationshipsPart {
    fn tag_name() -> &'static str {
        "styleSheet"
    }
}

impl OpenXmlDeserializeDefault for RelationshipsPart {}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Relationship {
    #[serde(rename = "Id")]
    pub id: String,
    #[serde(rename = "Type")]
    pub ty: String,
    #[serde(rename = "Target")]
    pub target: String,
    #[serde(
        rename = "TargetMode",
        default = "TargetMode::DefaultBuilder::Internal"
    )]
    pub target_mode: TargetMode::Type,
}

#[serde_st_string_enum]
pub enum TargetMode {
    External,
    Internal,
}
