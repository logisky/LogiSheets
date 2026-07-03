use std::collections::HashSet;

use logisheets_base::{errors::BasicError, BlockId, SheetId};

use crate::{
    block_manager::schema_manager::{
        ctx::BlockSchemaCtx,
        manager::SchemaManager,
        schema::{ColSchema, FieldEntry, RandomSchema, RowSchema, Schema, SchemaTrait},
    },
    edit_action::EditPayload,
    Error,
};

/// Normalize a `Vec<Option<String>>` of formula templates: trim whitespace,
/// collapse empty / whitespace-only strings to `None`. Used uniformly for
/// value / validation / editability formula columns.
fn normalize_formula_vec(input: Vec<Option<String>>) -> Vec<Option<String>> {
    input
        .into_iter()
        .map(|f| {
            f.and_then(|s| {
                let t = s.trim().to_string();
                if t.is_empty() {
                    None
                } else {
                    Some(t)
                }
            })
        })
        .collect()
}

/// Pad a formula vec with `None` to match `target_len`. Used so callers can
/// omit `validation_formulas` / `editability_formulas` (sending `vec![]`)
/// and have it interpreted as "all None" instead of a length mismatch.
fn pad_to_len(input: Vec<Option<String>>, target_len: usize) -> Vec<Option<String>> {
    if input.is_empty() {
        return vec![None; target_len];
    }
    input
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
        let names = scan_field_refs(trimmed);
        for n in names {
            if !declared_names.contains(&n) {
                return Err(BasicError::InvalidFormula(format!(
                    "{}[{}] references unknown field {:?}",
                    kind, i, n
                ))
                .into());
            }
        }
    }
    Ok(())
}

/// Scan a value-formula template for `#FIELD("name")` occurrences and
/// return every referenced name. Used at bind time to validate that
/// every reference resolves to a declared field — early failure beats
/// runtime `#NAME?` for typos.
///
/// String-literal-safe: skips characters inside `"..."` (honoring Excel's
/// doubled-quote escape `""`) so a literal like `"#FIELD(\"x\")"` inside
/// a text constant is NOT picked up.
///
/// UTF-8-safe: operates on the &str by-byte for ASCII anchors (`#FIELD("`,
/// `"`) and reads field names as a &str slice — never reinterprets a
/// raw byte as a `char`, which would mangle CJK / emoji / any multibyte
/// character mid-sequence.
fn scan_field_refs(template: &str) -> Vec<String> {
    let bytes = template.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'"' {
            // Skip over the string literal, honoring "" escapes.
            i += 1;
            while i < bytes.len() {
                if bytes[i] == b'"' {
                    if i + 1 < bytes.len() && bytes[i + 1] == b'"' {
                        i += 2;
                        continue;
                    }
                    i += 1;
                    break;
                }
                i += 1;
            }
            continue;
        }
        // Match the literal `#FIELD("` prefix, then read the name as
        // a &str slice up to the closing quote — preserves UTF-8
        // multi-byte characters. `""` inside the name is the Excel
        // escape for a literal `"`; we splice the pieces.
        let head = b"#FIELD(\"";
        if bytes[i..].starts_with(head) {
            i += head.len();
            let mut name = String::new();
            let mut chunk_start = i;
            while i < bytes.len() {
                if bytes[i] == b'"' {
                    // Flush the chunk so far (always at a UTF-8 boundary
                    // — `"` is ASCII and we only advanced on whole chars
                    // via str index arithmetic).
                    name.push_str(&template[chunk_start..i]);
                    if i + 1 < bytes.len() && bytes[i + 1] == b'"' {
                        // Escaped quote inside the name.
                        name.push('"');
                        i += 2;
                        chunk_start = i;
                        continue;
                    }
                    i += 1;
                    break;
                }
                // Advance one whole UTF-8 char. utf8_char_width is
                // unstable, so derive from the leading-byte pattern.
                let lead = bytes[i];
                let char_len = if lead < 0x80 {
                    1
                } else if lead < 0xC0 {
                    // Continuation byte — malformed if we land here,
                    // but be defensive and skip 1.
                    1
                } else if lead < 0xE0 {
                    2
                } else if lead < 0xF0 {
                    3
                } else {
                    4
                };
                i += char_len;
            }
            out.push(name);
            continue;
        }
        i += 1;
    }
    out
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

                // Pad-to-len the optional rule vecs so callers can omit
                // them (send vec![]) and have it mean "all None".
                let field_formulas = pad_to_len(p.field_formulas, p.fields.len());
                let validation_formulas = pad_to_len(p.validation_formulas, p.fields.len());
                let editability_formulas = pad_to_len(p.editability_formulas, p.fields.len());

                // Length checks after pad — if user sent a non-empty but
                // wrong-length vec, that's an error.
                if field_formulas.len() != p.fields.len()
                    || validation_formulas.len() != p.fields.len()
                    || editability_formulas.len() != p.fields.len()
                {
                    return Err(BasicError::InvalidFormula(format!(
                        "BindFormSchema: formula vec length mismatch \
                         (fields={}, value={}, validation={}, editability={})",
                        p.fields.len(),
                        field_formulas.len(),
                        validation_formulas.len(),
                        editability_formulas.len()
                    ))
                    .into());
                }

                // Validate template references *before* committing the
                // schema: every #FIELD("X") in any rule template must
                // refer to a field name actually declared in this bind.
                // (#KEY is always valid; #PLACEHOLDER is allowed in
                // validation/editability but not in value_formula —
                // leaving it untouched there surfaces as #NAME?.)
                let declared_names: std::collections::HashSet<String> =
                    p.fields.iter().cloned().collect();
                validate_field_refs(&field_formulas, &declared_names, "field_formulas")?;
                validate_field_refs(&validation_formulas, &declared_names, "validation_formulas")?;
                validate_field_refs(
                    &editability_formulas,
                    &declared_names,
                    "editability_formulas",
                )?;

                let mut value_iter = normalize_formula_vec(field_formulas).into_iter();
                let mut validation_iter = normalize_formula_vec(validation_formulas).into_iter();
                let mut editability_iter = normalize_formula_vec(editability_formulas).into_iter();

                let mut fields = Vec::new();
                for (i, (field, render_id)) in p
                    .fields
                    .into_iter()
                    .zip(p.render_ids.into_iter())
                    .enumerate()
                {
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
                    let entry = FieldEntry::new(id, render_id)
                        .with_value_formula(value_iter.next().flatten())
                        .with_validation_formula(validation_iter.next().flatten())
                        .with_editability_formula(editability_iter.next().flatten());
                    fields.push((field, entry));
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
            _ => Ok((self, false)),
        }
    }
}
