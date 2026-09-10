//! `EnumSetManager` persistence.
//!
//! Enum sets go into `logisheets/data.xml` under the root element, beside
//! `<fieldRender>`, because a set is named by id and shared across sheets. A
//! variant whose label equals its id writes no `label` attribute, so the common
//! case (a set inferred from a column's distinct values) stays readable by eye.

use logisheets_workbook::logisheets::{EnumSetXml, EnumVariantXml};

use super::{EnumSet, EnumSetManager, EnumVariant};

pub fn enum_sets_to_xml(manager: &EnumSetManager) -> Vec<EnumSetXml> {
    manager
        .all()
        .into_iter()
        .map(|set| EnumSetXml {
            id: set.id.clone(),
            name: if set.name.is_empty() {
                None
            } else {
                Some(set.name.clone())
            },
            variants: set
                .variants
                .iter()
                .map(|v| EnumVariantXml {
                    id: v.id.clone(),
                    label: if v.label == v.id {
                        None
                    } else {
                        Some(v.label.clone())
                    },
                })
                .collect(),
        })
        .collect()
}

pub fn load_enum_sets(manager: &mut EnumSetManager, xs: Vec<EnumSetXml>) {
    for x in xs {
        // A set with no variants allows nothing, which is never what anyone
        // meant — most likely a truncated write. Skip it rather than install a
        // rule that rejects every value.
        if x.variants.is_empty() {
            continue;
        }
        let variants = x
            .variants
            .into_iter()
            .map(|v| EnumVariant {
                label: v.label.unwrap_or_else(|| v.id.clone()),
                id: v.id,
            })
            .collect();
        manager.upsert(EnumSet {
            id: x.id,
            name: x.name.unwrap_or_default(),
            variants,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_ids_labels_and_names() {
        let mut original = EnumSetManager::new();
        original.upsert(EnumSet {
            id: "status".into(),
            name: "Order status".into(),
            variants: vec![
                EnumVariant {
                    id: "open".into(),
                    label: "Open".into(),
                },
                EnumVariant {
                    id: "done".into(),
                    label: "Done".into(),
                },
            ]
            .into(),
        });
        // A set nobody named, whose labels are its ids — the inferred shape.
        original.upsert(EnumSet {
            id: "region".into(),
            name: String::new(),
            variants: vec![
                EnumVariant {
                    id: "north".into(),
                    label: "north".into(),
                },
                EnumVariant {
                    id: "south".into(),
                    label: "south".into(),
                },
            ]
            .into(),
        });

        let xml = enum_sets_to_xml(&original);
        assert_eq!(xml.len(), 2);
        // The inferred set costs no redundant attributes on disk.
        let region = xml.iter().find(|x| x.id == "region").unwrap();
        assert!(region.name.is_none());
        assert!(region.variants.iter().all(|v| v.label.is_none()));

        let mut restored = EnumSetManager::new();
        load_enum_sets(&mut restored, xml);
        assert_eq!(restored.sets.len(), 2);

        let status = restored.get("status").unwrap();
        assert_eq!(status.name, "Order status");
        assert_eq!(status.variant_ids(), vec!["open", "done"]);
        assert_eq!(status.variants[1].label, "Done");

        let region = restored.get("region").unwrap();
        assert_eq!(region.name, "");
        // A missing label reads back as the id, which is what it meant.
        assert_eq!(region.variants[0].label, "north");
    }

    #[test]
    fn a_set_with_no_variants_is_skipped_rather_than_installed() {
        // It would allow nothing at all — a rule that rejects every value is
        // never what a truncated write meant.
        let mut restored = EnumSetManager::new();
        load_enum_sets(
            &mut restored,
            vec![EnumSetXml {
                id: "empty".into(),
                name: None,
                variants: vec![],
            }],
        );
        assert!(restored.get("empty").is_none());
    }
}
