use std::collections::HashSet;

use logisheets_base::{errors::BasicError, BlockId, SheetId};

use crate::{
    block_manager::schema_manager::{
        ctx::BlockSchemaCtx,
        manager::SchemaManager,
        schema::{ColSchema, RandomSchema, RowSchema, Schema, SchemaTrait},
    },
    edit_action::EditPayload,
    Error,
};

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

                // Validate template references *before* committing the
                // schema: every #FIELD("X") in any field_formula must
                // refer to a field name actually declared in this bind.
                // (#KEY is always valid; #PLACEHOLDER isn't expected in
                // value formulas but is left untouched if present.)
                //
                // Index alignment: `field_formulas[i]` corresponds to
                // `fields[i]`. Missing or empty strings are normalized
                // to None below.
                let declared_names: std::collections::HashSet<&str> =
                    p.fields.iter().map(|s| s.as_str()).collect();
                for (i, formula_opt) in p.field_formulas.iter().enumerate() {
                    let Some(formula) = formula_opt else { continue };
                    let trimmed = formula.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    let names = scan_field_refs(trimmed);
                    for n in names {
                        if !declared_names.contains(n.as_str()) {
                            return Err(BasicError::InvalidFormula(format!(
                                "field_formulas[{}] (for '{}') references unknown field {:?}",
                                i,
                                p.fields.get(i).map(|s| s.as_str()).unwrap_or(""),
                                n
                            ))
                            .into());
                        }
                    }
                }

                let mut field_formulas_iter = p.field_formulas.into_iter();
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
                    let formula = field_formulas_iter
                        .next()
                        .flatten()
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty());
                    fields.push((field, (id, render_id, formula)));
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
