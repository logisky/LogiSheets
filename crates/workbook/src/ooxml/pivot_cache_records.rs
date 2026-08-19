//! pivotCacheRecords part (§18.10.1.73, CT_PivotCacheRecords) — the cached row
//! data behind a pivot cache. Stored at `xl/pivotCache/pivotCacheRecordsN.xml`.

use xmlserde::Unparsed;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

use super::defaults::default_zero_u32;
use super::pivot_shared::PivotRecordItem;

#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
#[xmlserde(root = b"pivotCacheRecords")]
pub struct PivotCacheRecords {
    #[xmlserde(name = b"r", ty = "child", vec_size = "count")]
    pub records: Vec<CtRecord>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

/// CT_Record (§18.10.1.79) — one cached row: an ordered list of field values,
/// each either an inline value (`m`/`n`/`b`/`e`/`s`/`d`) or a shared-item
/// reference (`x`).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtRecord {
    #[xmlserde(ty = "untagged_enum")]
    pub items: Vec<PivotRecordItem>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{xml_deserialize_from_str, xml_serialize_with_decl};

    #[test]
    fn round_trip() {
        let xml = include_str!("../../examples/pivot_cache_records.xml");
        let p = xml_deserialize_from_str::<PivotCacheRecords>(xml).expect("deserialize");
        assert_eq!(p.count, 3);
        assert_eq!(p.records.len(), 3);
        assert_eq!(p.records[0].items.len(), 2);
        match &p.records[1].items[0] {
            PivotRecordItem::Index(x) => assert_eq!(x.v, 1i64),
            other => panic!("expected x index, got {:?}", other),
        }
        // serialize -> deserialize again must be stable
        let out = xml_serialize_with_decl(p);
        let p2 = xml_deserialize_from_str::<PivotCacheRecords>(&out).expect("re-deserialize");
        assert_eq!(p2.records.len(), 3);
    }

    /// Excel writes the "no item" shared-index sentinel as `4294967295`
    /// (`u32::MAX`). `CtX::v` used to be an `i32`, and xmlserde's derive PANICS
    /// on an attribute it cannot parse, so a workbook whose pivot cache used the
    /// sentinel could not be opened AT ALL — the panic came out of the loader
    /// before anything else was read.
    #[test]
    fn shared_item_index_accepts_u32_max_sentinel() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<pivotCacheRecords count="1"><r><x v="4294967295"/><x v="7"/></r></pivotCacheRecords>"#;
        let p = xml_deserialize_from_str::<PivotCacheRecords>(xml).expect("must deserialize");
        match &p.records[0].items[0] {
            PivotRecordItem::Index(x) => assert_eq!(x.v, 4_294_967_295i64),
            other => panic!("expected x index, got {other:?}"),
        }
        // And it must survive being written back out unchanged.
        let out = xml_serialize_with_decl(p);
        assert!(
            out.contains(r#"v="4294967295""#),
            "sentinel must round-trip verbatim, got {out}"
        );
    }
}
