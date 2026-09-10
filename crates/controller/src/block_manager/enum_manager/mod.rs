//! The workbook's enum sets — the option lists an `enum` / `multiSelect` field
//! draws from.
//!
//! These lived only in the host (`packages/engine/.../enum_set_manager.ts`),
//! persisted inside the same opaque AppData blob as the field metadata. A field
//! could declare `enum{setId}` and no headless host could say what the options
//! were, so no host but the browser could tell a valid value from an invalid
//! one. Watson worked around it by composing an `OR(EXACT(...), ...)` whitelist
//! at create time and storing it as a validation formula — a lowering with no
//! declaration behind it, which nothing could later regenerate.
//!
//! **Ids and labels only.** A variant's colour is presentation and stays in the
//! host, keyed by variant id. The engine needs the options in order to decide
//! whether a value is one of them; it needs nothing else. See
//! `design/block-field-semantics.md` §4.

pub mod executor;
pub mod persistence;

use imbl::{HashMap, Vector};

/// One option. `label` is what a reader sees, `id` is what the cell stores.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnumVariant {
    pub id: String,
    pub label: String,
}

/// A named list of options.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnumSet {
    pub id: String,
    /// Empty for a set nobody named — one inferred from a column's distinct
    /// values, for instance.
    pub name: String,
    pub variants: Vector<EnumVariant>,
}

impl EnumSet {
    /// The stored values this set allows, in declaration order.
    pub fn variant_ids(&self) -> Vec<&str> {
        self.variants.iter().map(|v| v.id.as_str()).collect()
    }
}

/// Workbook-scoped, keyed by set id. Persistent collections so a `Status`
/// snapshot (and therefore undo/redo) stays cheap, matching every other
/// manager.
#[derive(Debug, Clone, Default)]
pub struct EnumSetManager {
    pub sets: HashMap<String, EnumSet>,
}

impl EnumSetManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, id: &str) -> Option<&EnumSet> {
        self.sets.get(id)
    }

    /// Create the set, or replace it wholesale.
    ///
    /// Replacing rather than merging is deliberate: a set is the complete list
    /// of what is allowed, and a caller that sends four variants means four,
    /// not "these four plus whatever was there". Removing an option is a normal
    /// edit and has to be expressible.
    pub fn upsert(&mut self, set: EnumSet) {
        self.sets.insert(set.id.clone(), set);
    }

    pub fn remove(&mut self, id: &str) -> Option<EnumSet> {
        self.sets.remove(id)
    }

    /// Every set, ordered by id so two reads of an unchanged workbook agree.
    pub fn all(&self) -> Vec<&EnumSet> {
        let mut out: Vec<&EnumSet> = self.sets.values().collect();
        out.sort_by(|a, b| a.id.cmp(&b.id));
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(id: &str, variants: &[(&str, &str)]) -> EnumSet {
        EnumSet {
            id: id.to_string(),
            name: String::new(),
            variants: variants
                .iter()
                .map(|(i, l)| EnumVariant {
                    id: i.to_string(),
                    label: l.to_string(),
                })
                .collect(),
        }
    }

    #[test]
    fn an_upsert_replaces_the_option_list_rather_than_merging_into_it() {
        let mut m = EnumSetManager::new();
        m.upsert(set("status", &[("open", "Open"), ("done", "Done")]));
        assert_eq!(m.get("status").unwrap().variant_ids(), vec!["open", "done"]);

        // Dropping an option has to be expressible; a merge would make it
        // impossible to ever narrow a set.
        m.upsert(set("status", &[("open", "Open")]));
        assert_eq!(m.get("status").unwrap().variant_ids(), vec!["open"]);
    }

    #[test]
    fn sets_are_listed_in_a_stable_order() {
        let mut m = EnumSetManager::new();
        m.upsert(set("zeta", &[("a", "A")]));
        m.upsert(set("alpha", &[("b", "B")]));
        m.upsert(set("mid", &[("c", "C")]));
        assert_eq!(
            m.all().iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["alpha", "mid", "zeta"]
        );
    }
}
