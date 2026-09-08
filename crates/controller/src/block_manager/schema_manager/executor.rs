use std::collections::HashSet;

use logisheets_base::{BlockId, SheetId, errors::BasicError};

use crate::{
    Error,
    block_manager::schema_manager::{
        ctx::BlockSchemaCtx,
        field_type::{AggFunc, FieldAggregate, FieldType, FieldWritePolicy},
        manager::SchemaManager,
        schema::{ColSchema, FieldEntry, RandomSchema, RowSchema, Schema, SchemaTrait},
    },
    edit_action::EditPayload,
};

/// Trim a template and collapse an empty / whitespace-only one to `None`, so
/// a caller sending `Some("")` means the same as sending nothing.
fn normalize_formula(input: Option<String>) -> Option<String> {
    input.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    })
}

/// Normalize a `Vec<Option<String>>` of formula templates: trim whitespace,
/// collapse empty / whitespace-only strings to `None`. Used uniformly for
/// value / validation / editability formula columns.
fn normalize_formula_vec(input: Vec<Option<String>>) -> Vec<Option<String>> {
    input
        .into_iter()
        .map(|f| {
            f.and_then(|s| {
                let t = s.trim().to_string();
                if t.is_empty() { None } else { Some(t) }
            })
        })
        .collect()
}

/// Apply a slice of (possibly-updated) rule values to a schema's existing
/// rule slots. When `incoming.is_empty()`, the existing rule is preserved
/// untouched — this is how callers say "don't change validation, I'm only
/// updating value_formulas". Otherwise, the incoming vec replaces all
/// existing values for that rule kind (per-field).
fn apply_rule_update(
    incoming_empty: bool,
    incoming: Vec<Option<String>>,
    take_existing: impl Fn(usize) -> Option<String>,
    field_count: usize,
) -> Vec<Option<String>> {
    if incoming_empty {
        (0..field_count).map(take_existing).collect()
    } else {
        incoming
    }
}

/// Validate that every `#FIELD("X")` reference in a list of formula
/// templates points at a declared field. `kind` is used in error
/// messages ("value_formulas" / "validation_formulas" / ...).
fn validate_field_refs(
    formulas: &[Option<String>],
    declared_names: &std::collections::HashSet<String>,
    kind: &str,
) -> Result<(), Error> {
    for (i, formula_opt) in formulas.iter().enumerate() {
        let Some(formula) = formula_opt else { continue };
        let trimmed = formula.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Some(placeholders) = logisheets_parser::Parser {}.scan_placeholders(trimmed) else {
            continue;
        };
        for ph in placeholders {
            // Only the field name is checked. The row key of a
            // `#FIELD("f", "key")` is data, not schema: rows come and go,
            // so a key that resolves today may not tomorrow, and vice
            // versa. An unresolvable key surfaces as `#NAME?` at eval
            // time rather than blocking the bind.
            let logisheets_parser::Placeholder::FieldRef(name, _) = ph else {
                continue;
            };
            if !declared_names.contains(&name) {
                return Err(BasicError::InvalidFormula(format!(
                    "{}[{}] references unknown field {:?}",
                    kind, i, name
                ))
                .into());
            }
        }
    }
    Ok(())
}

pub struct BlockSchemaExecutor {
    pub manager: SchemaManager,
    /// Blocks whose schema was (re)bound during this payload. The formula
    /// executor turns these into `Vertex::BlockAll(sheet, block)` dirty
    /// entries — id-keyed so that ref-name renames don't break dependency
    /// tracking the way the old string-keyed `dirty_schemas` did.
    pub dirty_blocks: HashSet<(SheetId, BlockId)>,
}

impl BlockSchemaExecutor {
    pub fn new(manager: SchemaManager) -> Self {
        Self {
            manager,
            dirty_blocks: HashSet::new(),
        }
    }

    pub fn execute<C: BlockSchemaCtx>(
        self,
        ctx: &mut C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::BindFormSchema(p) => {
                let mut dirty_blocks = self.dirty_blocks;
                let mut manager = self.manager;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let block_id = p.block_id;

                // Validate template references *before* committing the schema:
                // every #FIELD("X") in any rule template must name a field
                // actually declared in this bind. (#KEY is always valid;
                // #PLACEHOLDER is allowed in validation / editability but not
                // in value_formula — leaving it untouched there surfaces as
                // #NAME?.)
                let declared_names: HashSet<String> =
                    p.fields.iter().map(|f| f.name.clone()).collect();
                validate_field_refs(
                    &p.fields
                        .iter()
                        .map(|f| f.value_formula.clone())
                        .collect::<Vec<_>>(),
                    &declared_names,
                    "value_formula",
                )?;
                validate_field_refs(
                    &p.fields
                        .iter()
                        .map(|f| f.validation_formula.clone())
                        .collect::<Vec<_>>(),
                    &declared_names,
                    "validation_formula",
                )?;
                validate_field_refs(
                    &p.fields
                        .iter()
                        .map(|f| f.editability_formula.clone())
                        .collect::<Vec<_>>(),
                    &declared_names,
                    "editability_formula",
                )?;

                let mut fields = Vec::new();
                for (i, spec) in p.fields.into_iter().enumerate() {
                    let idx = i + p.field_from;
                    // RowSchema (p.row=true) stores ColId per field — fields
                    // run along columns, records along rows. ColSchema flips
                    // both. We fetch from the *records* dimension at index 0
                    // and take the *fields* dimension's id at idx, so the
                    // bind only needs the block to extend `idx` cells along
                    // the fields axis. Existing buggy behavior swapped these
                    // and accidentally worked for square blocks because
                    // RowId and ColId share the u32 representation.
                    let id = if p.row {
                        ctx.fetch_block_cell_id(&sheet_id, &block_id, 0, idx)?.col
                    } else {
                        ctx.fetch_block_cell_id(&sheet_id, &block_id, idx, 0)?.row
                    };
                    let field_type = spec
                        .field_type
                        .map(FieldType::from)
                        .unwrap_or(FieldType::Unspecified);
                    let entry = FieldEntry::new(id, spec.render_id)
                        .with_value_formula(normalize_formula(spec.value_formula))
                        .with_validation_formula(normalize_formula(spec.validation_formula))
                        .with_editability_formula(normalize_formula(spec.editability_formula))
                        .with_field_type(field_type)
                        .with_description(normalize_formula(spec.description))
                        .with_required(spec.required.unwrap_or(false))
                        .with_unique(spec.unique.unwrap_or(false))
                        .with_default_value(spec.default_value)
                        .with_write_policy(FieldWritePolicy::from_str(spec.write_policy.as_deref()))
                        // Both halves or neither. A function with no field to
                        // aggregate, or a field with no function, is not a
                        // declaration — and a function this build does not know
                        // yields no aggregate rather than a guess.
                        .with_aggregate(match (spec.agg_func.as_deref(), spec.agg_field) {
                            (Some(func), Some(source_field)) => AggFunc::from_str(func)
                                .map(|func| FieldAggregate { func, source_field }),
                            _ => None,
                        });
                    fields.push((spec.name, entry));
                }
                let schema = if p.row {
                    let key = ctx
                        .fetch_block_cell_id(&sheet_id, &block_id, 0, p.key_idx)?
                        .col;
                    Schema::RowSchema(RowSchema {
                        fields,
                        key,
                        name: p.ref_name.clone(),
                    })
                } else {
                    let key = ctx
                        .fetch_block_cell_id(&sheet_id, &block_id, p.key_idx, 0)?
                        .row;
                    Schema::ColSchema(ColSchema {
                        fields,
                        key,
                        name: p.ref_name.clone(),
                    })
                };
                // A ref name addresses one block for the whole workbook. Taking
                // one that is already spoken for used to overwrite the entry, so
                // the first block stayed on the sheet but every BLOCKREF naming
                // it silently began resolving to the second — formulas that kept
                // evaluating, against the wrong data.
                if let Some((owner_sheet, owner_block)) = manager.ref_name_owner(&p.ref_name) {
                    if (owner_sheet, owner_block) != (sheet_id, block_id) {
                        return Err(BasicError::BlockRefNameTaken(
                            p.ref_name.clone(),
                            owner_sheet,
                            owner_block,
                        )
                        .into());
                    }
                }
                let old_schema = manager.schemas.get(&(sheet_id, block_id));
                if old_schema.is_some() {
                    let old_ref = old_schema.unwrap().get_ref_name();
                    manager.refs.remove(&old_ref);
                }
                manager.schemas.insert((sheet_id, block_id), schema);
                manager
                    .refs
                    .insert(p.ref_name.clone(), (sheet_id, block_id));
                dirty_blocks.insert((sheet_id, block_id));
                Ok((
                    Self {
                        manager,
                        dirty_blocks,
                    },
                    true,
                ))
            }
            EditPayload::UpsertFieldFormulas(p) => {
                let mut dirty_blocks = self.dirty_blocks;
                let mut manager = self.manager;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let block_id = p.block_id;

                // Must follow a prior BindFormSchema — refuse if no
                // RowSchema / ColSchema is registered for this block.
                let Some(existing) = manager.schemas.get(&(sheet_id, block_id)) else {
                    return Err(BasicError::BlockIdDoesNotExist(block_id).into());
                };
                let field_count = match existing {
                    Schema::RowSchema(s) => s.fields.len(),
                    Schema::ColSchema(s) => s.fields.len(),
                    Schema::RandomSchema(_) => {
                        // RandomSchema doesn't carry templates in v1 —
                        // reject loudly instead of silently dropping.
                        return Err(BasicError::InvalidFormula(format!(
                            "UpsertFieldFormulas: block {} uses RandomSchema, \
                             which does not support field-formula templates",
                            block_id
                        ))
                        .into());
                    }
                };

                // `[]` for any rule vec means "leave this rule kind
                // untouched" — preserve the existing per-field values.
                // Non-empty vecs replace all per-field values for that
                // rule kind. This lets callers update one rule kind
                // (e.g. only validation_formulas) without re-sending
                // the others.
                let field_empty = p.field_formulas.is_empty();
                let validation_empty = p.validation_formulas.is_empty();
                let editability_empty = p.editability_formulas.is_empty();

                // Snapshot existing per-field rules so apply_rule_update
                // can preserve them for any kind with an empty incoming
                // vec.
                let existing_rules: Vec<(Option<String>, Option<String>, Option<String>)> =
                    match existing {
                        Schema::RowSchema(s) => s
                            .fields
                            .iter()
                            .map(|(_, e)| {
                                (
                                    e.value_formula.clone(),
                                    e.validation_formula.clone(),
                                    e.editability_formula.clone(),
                                )
                            })
                            .collect(),
                        Schema::ColSchema(s) => s
                            .fields
                            .iter()
                            .map(|(_, e)| {
                                (
                                    e.value_formula.clone(),
                                    e.validation_formula.clone(),
                                    e.editability_formula.clone(),
                                )
                            })
                            .collect(),
                        Schema::RandomSchema(_) => unreachable!(),
                    };

                let field_formulas = apply_rule_update(
                    field_empty,
                    p.field_formulas,
                    |i| existing_rules[i].0.clone(),
                    field_count,
                );
                let validation_formulas = apply_rule_update(
                    validation_empty,
                    p.validation_formulas,
                    |i| existing_rules[i].1.clone(),
                    field_count,
                );
                let editability_formulas = apply_rule_update(
                    editability_empty,
                    p.editability_formulas,
                    |i| existing_rules[i].2.clone(),
                    field_count,
                );

                if field_formulas.len() != field_count
                    || validation_formulas.len() != field_count
                    || editability_formulas.len() != field_count
                {
                    return Err(BasicError::InvalidFormula(format!(
                        "UpsertFieldFormulas: formula vec length mismatch \
                         (fields={}, value={}, validation={}, editability={}) \
                         for block {}",
                        field_count,
                        field_formulas.len(),
                        validation_formulas.len(),
                        editability_formulas.len(),
                        block_id
                    ))
                    .into());
                }

                // Validate every `#FIELD("X")` against the existing
                // field names (same rule as BindFormSchema).
                let declared_names: std::collections::HashSet<String> = match existing {
                    Schema::RowSchema(s) => s.fields.iter().map(|(n, _)| n.clone()).collect(),
                    Schema::ColSchema(s) => s.fields.iter().map(|(n, _)| n.clone()).collect(),
                    Schema::RandomSchema(_) => unreachable!(),
                };
                validate_field_refs(&field_formulas, &declared_names, "field_formulas")?;
                validate_field_refs(&validation_formulas, &declared_names, "validation_formulas")?;
                validate_field_refs(
                    &editability_formulas,
                    &declared_names,
                    "editability_formulas",
                )?;

                // Normalize (trim + empty → None), then mutate the
                // schema's per-field rule slots in place.
                let normalized_value = normalize_formula_vec(field_formulas);
                let normalized_validation = normalize_formula_vec(validation_formulas);
                let normalized_editability = normalize_formula_vec(editability_formulas);

                let schema_mut = manager.schemas.get(&(sheet_id, block_id)).unwrap().clone();
                let updated = match schema_mut {
                    Schema::RowSchema(mut s) => {
                        for (i, entry) in s.fields.iter_mut().enumerate() {
                            entry.1.value_formula = normalized_value[i].clone();
                            entry.1.validation_formula = normalized_validation[i].clone();
                            entry.1.editability_formula = normalized_editability[i].clone();
                        }
                        Schema::RowSchema(s)
                    }
                    Schema::ColSchema(mut s) => {
                        for (i, entry) in s.fields.iter_mut().enumerate() {
                            entry.1.value_formula = normalized_value[i].clone();
                            entry.1.validation_formula = normalized_validation[i].clone();
                            entry.1.editability_formula = normalized_editability[i].clone();
                        }
                        Schema::ColSchema(s)
                    }
                    Schema::RandomSchema(_) => unreachable!(),
                };
                manager.schemas.insert((sheet_id, block_id), updated);
                // Mark dirty so the formula_manager re-walks every
                // cell in the block and re-materializes templates
                // through input_block_cell_template (which now reads
                // the updated formula slots).
                dirty_blocks.insert((sheet_id, block_id));
                Ok((
                    Self {
                        manager,
                        dirty_blocks,
                    },
                    true,
                ))
            }
            EditPayload::BindRandomSchema(p) => {
                let mut dirty_blocks = self.dirty_blocks;
                let mut manager = self.manager;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let block_id = p.block_id;
                let mut key_field = Vec::new();
                for unit in p.units {
                    let r = unit.row;
                    let c = unit.col;
                    let cell_id = ctx.fetch_block_cell_id(&sheet_id, &block_id, r, c)?;
                    key_field.push((unit.key, cell_id.row, cell_id.col, unit.render_id));
                }
                let schema = Schema::RandomSchema(RandomSchema {
                    key_field,
                    name: p.ref_name.clone(),
                });
                // A ref name addresses one block for the whole workbook. Taking
                // one that is already spoken for used to overwrite the entry, so
                // the first block stayed on the sheet but every BLOCKREF naming
                // it silently began resolving to the second — formulas that kept
                // evaluating, against the wrong data.
                if let Some((owner_sheet, owner_block)) = manager.ref_name_owner(&p.ref_name) {
                    if (owner_sheet, owner_block) != (sheet_id, block_id) {
                        return Err(BasicError::BlockRefNameTaken(
                            p.ref_name.clone(),
                            owner_sheet,
                            owner_block,
                        )
                        .into());
                    }
                }
                let old_schema = manager.schemas.get(&(sheet_id, block_id));
                if old_schema.is_some() {
                    let old_ref = old_schema.unwrap().get_ref_name();
                    manager.refs.remove(&old_ref);
                }
                manager.schemas.insert((sheet_id, block_id), schema);
                manager
                    .refs
                    .insert(p.ref_name.clone(), (sheet_id, block_id));
                dirty_blocks.insert((sheet_id, block_id));
                Ok((
                    Self {
                        manager,
                        dirty_blocks,
                    },
                    true,
                ))
            }
            // Structural edits to a block's rows or columns.
            //
            // `BlockAll` is documented as being dirtied when a row or field is
            // added or removed, and BLOCKREFS depends on nothing else — its
            // filters scan whatever the block currently holds, so no per-cell
            // edge can stand in for it. Only the three schema payloads above
            // were dirtying it, which left deletion silently stale: removing a
            // row from a block did not change `SUM(BLOCKREFS(...))` until some
            // unrelated write happened to trigger a recalculation. A stale
            // total that still looks like a total is the worst failure a
            // calculation engine has.
            //
            // Insertion appeared to work only by accident: new rows materialize
            // their fields' value formulas, and writing those cells reaches
            // `BlockAll` through the per-cell edge. Rows with no computed field
            // had the same bug. Dirty it explicitly for both directions rather
            // than relying on a side effect.
            EditPayload::InsertRowsInBlock(p) => {
                Self::dirty_structural(self, ctx, p.sheet_idx, p.block_id)
            }
            EditPayload::DeleteRowsInBlock(p) => {
                Self::dirty_structural(self, ctx, p.sheet_idx, p.block_id)
            }
            EditPayload::InsertColsInBlock(p) => {
                Self::dirty_structural(self, ctx, p.sheet_idx, p.block_id)
            }
            EditPayload::DeleteColsInBlock(p) => {
                Self::dirty_structural(self, ctx, p.sheet_idx, p.block_id)
            }
            _ => Ok((self, false)),
        }
    }

    /// Mark a block's structure as changed, so `BlockAll` gets dirtied and the
    /// block's external readers recompute. Returns `false` for "handled but
    /// nothing else to do" — the payload's real work happens elsewhere; this
    /// only records the dependency consequence.
    fn dirty_structural<C: BlockSchemaCtx>(
        mut this: Self,
        ctx: &mut C,
        sheet_idx: usize,
        block_id: BlockId,
    ) -> Result<(Self, bool), Error> {
        let sheet_id = ctx
            .fetch_sheet_id_by_index(sheet_idx)
            .map_err(|l| BasicError::SheetIdxExceed(l))?;
        this.dirty_blocks.insert((sheet_id, block_id));
        Ok((this, false))
    }
}
