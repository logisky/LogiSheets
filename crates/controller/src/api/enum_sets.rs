//! Read the workbook's enum sets.
//!
//! A field declaring `enum{setId}` names a list it does not carry. Without this
//! a host could see the declaration and not the options — which is the state
//! every headless host was in while the sets lived in the browser's AppData
//! blob. See `design/block-field-semantics.md`.

use gents_derives::TS;

use super::Workbook;

/// One option: `id` is what the cell stores, `label` is what a reader sees.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "enum_variant_info.ts", rename_all = "camelCase")]
pub struct EnumVariantInfo {
    pub id: String,
    pub label: String,
}

/// A named option list. Carries no colours — those are presentation and stay in
/// the host, keyed by variant id.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "enum_set_info.ts", rename_all = "camelCase")]
pub struct EnumSetInfo {
    pub id: String,
    /// Empty for a set nobody named.
    pub name: String,
    pub variants: Vec<EnumVariantInfo>,
}

impl Workbook {
    /// Every enum set in the workbook, ordered by id so two reads of an
    /// unchanged workbook agree.
    pub fn get_enum_sets(&self) -> Vec<EnumSetInfo> {
        self.controller
            .status
            .enum_set_manager
            .all()
            .into_iter()
            .map(|s| EnumSetInfo {
                id: s.id.clone(),
                name: s.name.clone(),
                variants: s
                    .variants
                    .iter()
                    .map(|v| EnumVariantInfo {
                        id: v.id.clone(),
                        label: v.label.clone(),
                    })
                    .collect(),
            })
            .collect()
    }
}
