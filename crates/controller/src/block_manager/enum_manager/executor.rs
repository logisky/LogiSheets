//! Applies the two enum-set payloads.

use crate::{Error, edit_action::EditPayload};

use super::{EnumSet, EnumSetManager, EnumVariant};

pub struct EnumSetExecutor {
    pub manager: EnumSetManager,
    /// Sets this payload touched. A field declaring one of these has a derived
    /// membership rule that needs regenerating, so the caller dirties the
    /// blocks that reference them.
    pub dirty_sets: Vec<String>,
}

impl EnumSetExecutor {
    pub fn new(manager: EnumSetManager) -> Self {
        Self {
            manager,
            dirty_sets: Vec::new(),
        }
    }

    pub fn execute(self, payload: EditPayload) -> Result<(Self, bool), Error> {
        let mut executor = self;
        match payload {
            EditPayload::UpsertEnumSet(p) => {
                // A set with no options allows nothing. Refuse rather than
                // install a rule that rejects every value — silently accepting
                // it would light up every cell in the field.
                if p.variants.is_empty() {
                    return Err(Error::PayloadError(format!(
                        "UpsertEnumSet: set {:?} declares no variants, so nothing would be \
                         allowed in the fields that use it",
                        p.id
                    )));
                }
                let variants = p
                    .variants
                    .into_iter()
                    .map(|v| EnumVariant {
                        // An omitted label means "the id is the label", which
                        // is the shape an inferred set takes.
                        label: match v.label {
                            Some(l) if !l.trim().is_empty() => l,
                            _ => v.id.clone(),
                        },
                        id: v.id,
                    })
                    .collect();
                executor.dirty_sets.push(p.id.clone());
                executor.manager.upsert(EnumSet {
                    id: p.id,
                    name: p.name.unwrap_or_default(),
                    variants,
                });
                Ok((executor, true))
            }
            EditPayload::RemoveEnumSet(p) => {
                let removed = executor.manager.remove(&p.id).is_some();
                if removed {
                    executor.dirty_sets.push(p.id);
                }
                Ok((executor, removed))
            }
            _ => Ok((executor, false)),
        }
    }
}
