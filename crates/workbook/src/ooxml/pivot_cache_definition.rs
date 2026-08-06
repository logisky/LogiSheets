//! pivotCacheDefinition part (§18.10.1.67, CT_PivotCacheDefinition) — describes
//! the source and fields of a pivot cache. Stored at
//! `xl/pivotCache/pivotCacheDefinitionN.xml`.
//!
//! Server/OLAP-only subtrees (cacheHierarchies, kpis, tupleCache,
//! calculatedMembers, dimensions, measureGroups, maps) are preserved verbatim
//! as `Unparsed` rather than structurally modeled — they never appear for
//! ordinary worksheet-source pivots and still round-trip untouched.

use xmlserde::Unparsed;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

use super::defaults::{
    default_false, default_one_f64, default_true, default_zero_i32, default_zero_u32,
    default_zero_u8, st_group_by_range,
};
use super::complex_types::CtPivotArea;
use super::pivot_shared::{CtX, PivotSharedItem};
use super::simple_types::{StGroupBy, StSourceType};

#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
#[xmlserde(root = b"pivotCacheDefinition")]
pub struct PivotCacheDefinition {
    #[xmlserde(name = b"cacheSource", ty = "child")]
    pub cache_source: CtCacheSource,
    #[xmlserde(name = b"cacheFields", ty = "child")]
    pub cache_fields: CtCacheFields,
    #[xmlserde(name = b"cacheHierarchies", ty = "child")]
    pub cache_hierarchies: Option<Unparsed>,
    #[xmlserde(name = b"kpis", ty = "child")]
    pub kpis: Option<Unparsed>,
    #[xmlserde(name = b"tupleCache", ty = "child")]
    pub tuple_cache: Option<Unparsed>,
    #[xmlserde(name = b"calculatedItems", ty = "child")]
    pub calculated_items: Option<CtCalculatedItems>,
    #[xmlserde(name = b"calculatedMembers", ty = "child")]
    pub calculated_members: Option<Unparsed>,
    #[xmlserde(name = b"dimensions", ty = "child")]
    pub dimensions: Option<Unparsed>,
    #[xmlserde(name = b"measureGroups", ty = "child")]
    pub measure_groups: Option<Unparsed>,
    #[xmlserde(name = b"maps", ty = "child")]
    pub maps: Option<Unparsed>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,

    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: Option<String>,
    #[xmlserde(name = b"invalid", ty = "attr", default = "default_false")]
    pub invalid: bool,
    #[xmlserde(name = b"saveData", ty = "attr", default = "default_true")]
    pub save_data: bool,
    #[xmlserde(name = b"refreshOnLoad", ty = "attr", default = "default_false")]
    pub refresh_on_load: bool,
    #[xmlserde(name = b"optimizeMemory", ty = "attr", default = "default_false")]
    pub optimize_memory: bool,
    #[xmlserde(name = b"enableRefresh", ty = "attr", default = "default_true")]
    pub enable_refresh: bool,
    #[xmlserde(name = b"refreshedBy", ty = "attr")]
    pub refreshed_by: Option<String>,
    #[xmlserde(name = b"refreshedDate", ty = "attr")]
    pub refreshed_date: Option<f64>,
    #[xmlserde(name = b"refreshedDateIso", ty = "attr")]
    pub refreshed_date_iso: Option<String>,
    #[xmlserde(name = b"backgroundQuery", ty = "attr", default = "default_false")]
    pub background_query: bool,
    #[xmlserde(name = b"missingItemsLimit", ty = "attr")]
    pub missing_items_limit: Option<u32>,
    #[xmlserde(name = b"createdVersion", ty = "attr", default = "default_zero_u8")]
    pub created_version: u8,
    #[xmlserde(name = b"refreshedVersion", ty = "attr", default = "default_zero_u8")]
    pub refreshed_version: u8,
    #[xmlserde(
        name = b"minRefreshableVersion",
        ty = "attr",
        default = "default_zero_u8"
    )]
    pub min_refreshable_version: u8,
    #[xmlserde(name = b"recordCount", ty = "attr")]
    pub record_count: Option<u32>,
    #[xmlserde(name = b"upgradeOnRefresh", ty = "attr", default = "default_false")]
    pub upgrade_on_refresh: bool,
    #[xmlserde(name = b"tupleCache", ty = "attr", default = "default_false")]
    pub tuple_cache_attr: bool,
    #[xmlserde(name = b"supportSubquery", ty = "attr", default = "default_false")]
    pub support_subquery: bool,
    #[xmlserde(name = b"supportAdvancedDrill", ty = "attr", default = "default_false")]
    pub support_advanced_drill: bool,
}

/// CT_CacheSource (§18.10.1.14).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtCacheSource {
    #[xmlserde(name = b"worksheetSource", ty = "child")]
    pub worksheet_source: Option<CtWorksheetSource>,
    #[xmlserde(name = b"consolidation", ty = "child")]
    pub consolidation: Option<CtConsolidation>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"type", ty = "attr")]
    pub ty: StSourceType,
    #[xmlserde(name = b"connectionId", ty = "attr")]
    pub connection_id: Option<u32>,
}

/// CT_WorksheetSource (§18.10.1.96).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtWorksheetSource {
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: Option<String>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"sheet", ty = "attr")]
    pub sheet: Option<String>,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: Option<String>,
}

/// CT_Consolidation (§18.10.1.19).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtConsolidation {
    #[xmlserde(name = b"pages", ty = "child")]
    pub pages: Option<CtPages>,
    #[xmlserde(name = b"rangeSets", ty = "child")]
    pub range_sets: CtRangeSets,
    #[xmlserde(name = b"autoPage", ty = "attr", default = "default_true")]
    pub auto_page: bool,
}

/// CT_Pages (§18.10.1.65).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPages {
    #[xmlserde(name = b"page", ty = "child", vec_size = "count")]
    pub page: Vec<CtPcdscPage>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_PCDSCPage (§18.10.1.66).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPcdscPage {
    #[xmlserde(name = b"pageItem", ty = "child", vec_size = "count")]
    pub page_item: Vec<CtPageItem>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_PageItem (§18.10.1.70).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtPageItem {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
}

/// CT_RangeSets (§18.10.1.77).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtRangeSets {
    #[xmlserde(name = b"rangeSet", ty = "child", vec_size = "count")]
    pub range_set: Vec<CtRangeSet>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_RangeSet (§18.10.1.78).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtRangeSet {
    #[xmlserde(name = b"i1", ty = "attr")]
    pub i1: Option<u32>,
    #[xmlserde(name = b"i2", ty = "attr")]
    pub i2: Option<u32>,
    #[xmlserde(name = b"i3", ty = "attr")]
    pub i3: Option<u32>,
    #[xmlserde(name = b"i4", ty = "attr")]
    pub i4: Option<u32>,
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: Option<String>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"sheet", ty = "attr")]
    pub sheet: Option<String>,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: Option<String>,
}

/// CT_CacheFields (§18.10.1.8).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtCacheFields {
    #[xmlserde(name = b"cacheField", ty = "child", vec_size = "count")]
    pub cache_field: Vec<CtCacheField>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_CacheField (§18.10.1.7).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtCacheField {
    #[xmlserde(name = b"sharedItems", ty = "child")]
    pub shared_items: Option<CtSharedItems>,
    #[xmlserde(name = b"fieldGroup", ty = "child")]
    pub field_group: Option<CtFieldGroup>,
    #[xmlserde(name = b"mpMap", ty = "child")]
    pub mp_map: Vec<CtX>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"caption", ty = "attr")]
    pub caption: Option<String>,
    #[xmlserde(name = b"propertyName", ty = "attr")]
    pub property_name: Option<String>,
    #[xmlserde(name = b"serverField", ty = "attr", default = "default_false")]
    pub server_field: bool,
    #[xmlserde(name = b"uniqueList", ty = "attr", default = "default_true")]
    pub unique_list: bool,
    #[xmlserde(name = b"numFmtId", ty = "attr")]
    pub num_fmt_id: Option<u32>,
    #[xmlserde(name = b"formula", ty = "attr")]
    pub formula: Option<String>,
    #[xmlserde(name = b"sqlType", ty = "attr", default = "default_zero_i32")]
    pub sql_type: i32,
    #[xmlserde(name = b"hierarchy", ty = "attr", default = "default_zero_i32")]
    pub hierarchy: i32,
    #[xmlserde(name = b"level", ty = "attr", default = "default_zero_u32")]
    pub level: u32,
    #[xmlserde(name = b"databaseField", ty = "attr", default = "default_true")]
    pub database_field: bool,
    #[xmlserde(name = b"mappingCount", ty = "attr")]
    pub mapping_count: Option<u32>,
    #[xmlserde(name = b"memberPropertyField", ty = "attr", default = "default_false")]
    pub member_property_field: bool,
}

/// CT_SharedItems (§18.10.1.90).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtSharedItems {
    #[xmlserde(ty = "untagged_enum")]
    pub items: Vec<PivotSharedItem>,
    #[xmlserde(
        name = b"containsSemiMixedTypes",
        ty = "attr",
        default = "default_true"
    )]
    pub contains_semi_mixed_types: bool,
    #[xmlserde(name = b"containsNonDate", ty = "attr", default = "default_true")]
    pub contains_non_date: bool,
    #[xmlserde(name = b"containsDate", ty = "attr", default = "default_false")]
    pub contains_date: bool,
    #[xmlserde(name = b"containsString", ty = "attr", default = "default_true")]
    pub contains_string: bool,
    #[xmlserde(name = b"containsBlank", ty = "attr", default = "default_false")]
    pub contains_blank: bool,
    #[xmlserde(name = b"containsMixedTypes", ty = "attr", default = "default_false")]
    pub contains_mixed_types: bool,
    #[xmlserde(name = b"containsNumber", ty = "attr", default = "default_false")]
    pub contains_number: bool,
    #[xmlserde(name = b"containsInteger", ty = "attr", default = "default_false")]
    pub contains_integer: bool,
    #[xmlserde(name = b"minValue", ty = "attr")]
    pub min_value: Option<f64>,
    #[xmlserde(name = b"maxValue", ty = "attr")]
    pub max_value: Option<f64>,
    #[xmlserde(name = b"minDate", ty = "attr")]
    pub min_date: Option<String>,
    #[xmlserde(name = b"maxDate", ty = "attr")]
    pub max_date: Option<String>,
    #[xmlserde(name = b"count", ty = "attr")]
    pub count: Option<u32>,
    #[xmlserde(name = b"longText", ty = "attr", default = "default_false")]
    pub long_text: bool,
}

/// CT_FieldGroup (§18.10.1.38).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtFieldGroup {
    #[xmlserde(name = b"rangePr", ty = "child")]
    pub range_pr: Option<CtRangePr>,
    #[xmlserde(name = b"discretePr", ty = "child")]
    pub discrete_pr: Option<CtDiscretePr>,
    #[xmlserde(name = b"groupItems", ty = "child")]
    pub group_items: Option<CtGroupItems>,
    #[xmlserde(name = b"par", ty = "attr")]
    pub par: Option<u32>,
    #[xmlserde(name = b"base", ty = "attr")]
    pub base: Option<u32>,
}

/// CT_RangePr (§18.10.1.76).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtRangePr {
    #[xmlserde(name = b"autoStart", ty = "attr", default = "default_true")]
    pub auto_start: bool,
    #[xmlserde(name = b"autoEnd", ty = "attr", default = "default_true")]
    pub auto_end: bool,
    #[xmlserde(name = b"groupBy", ty = "attr", default = "st_group_by_range")]
    pub group_by: StGroupBy,
    #[xmlserde(name = b"startNum", ty = "attr")]
    pub start_num: Option<f64>,
    #[xmlserde(name = b"endNum", ty = "attr")]
    pub end_num: Option<f64>,
    #[xmlserde(name = b"startDate", ty = "attr")]
    pub start_date: Option<String>,
    #[xmlserde(name = b"endDate", ty = "attr")]
    pub end_date: Option<String>,
    #[xmlserde(name = b"groupInterval", ty = "attr", default = "default_one_f64")]
    pub group_interval: f64,
}

/// CT_DiscretePr (§18.10.1.22).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtDiscretePr {
    #[xmlserde(name = b"x", ty = "child", vec_size = "count")]
    pub x: Vec<CtX>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_GroupItems (§18.10.1.41).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtGroupItems {
    #[xmlserde(ty = "untagged_enum")]
    pub items: Vec<PivotSharedItem>,
    #[xmlserde(name = b"count", ty = "attr")]
    pub count: Option<u32>,
}

/// CT_CalculatedItems (§18.10.1.10).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtCalculatedItems {
    #[xmlserde(name = b"calculatedItem", ty = "child", vec_size = "count")]
    pub calculated_item: Vec<CtCalculatedItem>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_CalculatedItem (§18.10.1.9).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtCalculatedItem {
    #[xmlserde(name = b"pivotArea", ty = "child")]
    pub pivot_area: CtPivotArea,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"field", ty = "attr")]
    pub field: Option<u32>,
    #[xmlserde(name = b"formula", ty = "attr")]
    pub formula: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{xml_deserialize_from_str, xml_serialize_with_decl};

    #[test]
    fn round_trip() {
        let xml = include_str!("../../examples/pivot_cache_definition.xml");
        let p = xml_deserialize_from_str::<PivotCacheDefinition>(xml).expect("deserialize");
        assert_eq!(p.id.as_deref(), Some("rId1"));
        assert_eq!(p.record_count, Some(3));
        assert!(matches!(p.cache_source.ty, StSourceType::Worksheet));
        let ws = p.cache_source.worksheet_source.as_ref().unwrap();
        assert_eq!(ws.reference.as_deref(), Some("A1:B4"));
        assert_eq!(ws.sheet.as_deref(), Some("Sheet1"));
        assert_eq!(p.cache_fields.count, 2);
        assert_eq!(p.cache_fields.cache_field.len(), 2);
        assert_eq!(p.cache_fields.cache_field[0].name, "Region");
        let si = p.cache_fields.cache_field[0].shared_items.as_ref().unwrap();
        assert_eq!(si.items.len(), 2);
        let out = xml_serialize_with_decl(p);
        let p2 = xml_deserialize_from_str::<PivotCacheDefinition>(&out).expect("re-deserialize");
        assert_eq!(p2.cache_fields.cache_field.len(), 2);
    }
}
