//! Schema persistence: convert `SchemaManager` state to/from the
//! workbook's XML representation.
//!
//! Schemas live in memory only by default — the worker installs them at
//! runtime when crafts send `BindFormSchema` payloads. To survive a file
//! save/load round-trip, the on-disk `logisheets/data.xml` carries each
//! schema as a child of its `<sheet>`. The three Schema variants map
//! one-to-one to three sibling XML element names (`<rowSchema>`,
//! `<colSchema>`, `<randomSchema>`) so xmlserde can dispatch without a
//! discriminator attribute.

use logisheets_base::{ColId, RowId, SheetId};
use logisheets_workbook::logisheets::{
    ColSchemaXml, RandomKeyFieldXml, RandomSchemaXml, RowSchemaXml, SchemaFieldXml,
};

use super::SchemaManager;
use super::field_type::{AggFunc, FieldAggregate, FieldType, FieldWritePolicy};
use super::schema::{ColSchema, FieldEntry, RandomSchema, RowSchema, Schema};

/// Project a field entry into its on-disk attributes. Shared by the row and
/// column variants, which have identical field shapes — before this existed the
/// two arms were copy-pasted, and adding the declaration to only one of them
/// would have been a very quiet bug.
fn field_to_xml<F: Copy + Into<u32>>(name: &str, entry: &FieldEntry<F>) -> SchemaFieldXml {
    let parts = entry.field_type.to_parts();
    SchemaFieldXml {
        name: name.to_string(),
        axis_id: entry.field_axis_id.into(),
        render_id: entry.render_id.clone(),
        value_formula: entry.value_formula.clone(),
        validation_formula: entry.validation_formula.clone(),
        editability_formula: entry.editability_formula.clone(),
        kind: parts.kind,
        enum_set_id: parts.enum_set_id,
        ref_sheet_id: parts.ref_sheet_id.map(|v| v as u32),
        ref_block_id: parts.ref_block_id.map(|v| v as u32),
        ref_field_name: parts.ref_field_name,
        description: entry.description.clone(),
        // Only written when set, so an ordinary field costs no attribute and a
        // file's schema stays readable by eye.
        required: entry.required.then_some(true),
        unique: entry.unique.then_some(true),
        default_value: entry.default_value.clone(),
        // Only written when it says something, so an ordinary field costs no
        // attribute.
        write_policy: match entry.write_policy {
            FieldWritePolicy::Inherit => None,
            p => Some(p.as_str().to_string()),
        },
        agg_func: entry
            .aggregate
            .as_ref()
            .map(|a| a.func.as_str().to_string()),
        agg_field: entry.aggregate.as_ref().map(|a| a.source_field.clone()),
    }
}

/// Inverse of [`field_to_xml`]: rebuild the in-memory entry, including the
/// declaration. Absent attributes mean "nobody said", which is what a file
/// written before the declaration existed meant.
fn field_from_xml<F: From<u32>>(f: SchemaFieldXml) -> (String, FieldEntry<F>) {
    let field_type = FieldType::from_parts(
        f.kind.as_deref(),
        f.enum_set_id.as_deref(),
        f.ref_sheet_id.map(|v| v as logisheets_base::SheetId),
        f.ref_block_id.map(|v| v as logisheets_base::BlockId),
        f.ref_field_name.as_deref(),
    );
    (
        f.name,
        FieldEntry::new(F::from(f.axis_id), f.render_id)
            .with_value_formula(f.value_formula)
            .with_validation_formula(f.validation_formula)
            .with_editability_formula(f.editability_formula)
            .with_field_type(field_type)
            .with_description(f.description)
            .with_required(f.required.unwrap_or(false))
            .with_unique(f.unique.unwrap_or(false))
            .with_default_value(f.default_value)
            .with_write_policy(FieldWritePolicy::from_str(f.write_policy.as_deref()))
            // Both halves or neither: a function with no field to aggregate,
            // or a field with no function, is not a declaration anybody made.
            .with_aggregate(match (f.agg_func.as_deref(), f.agg_field) {
                (Some(func), Some(source_field)) => {
                    AggFunc::from_str(func).map(|func| FieldAggregate { func, source_field })
                }
                _ => None,
            }),
    )
}

/// Pull every schema bound to `sheet_id` out of `manager` and project it
/// into the three xmlserde-friendly vecs that the workbook's `Sheet` carries.
/// The output order is unspecified (driven by `HashMap` iteration) — schemas
/// are identified by their `block_id` attribute, not by position.
pub fn schemas_to_xml(
    manager: &SchemaManager,
    sheet_id: SheetId,
) -> (Vec<RowSchemaXml>, Vec<ColSchemaXml>, Vec<RandomSchemaXml>) {
    let mut rows = Vec::new();
    let mut cols = Vec::new();
    let mut randoms = Vec::new();

    for ((sid, block_id), schema) in manager.schemas.iter() {
        if *sid != sheet_id {
            continue;
        }
        match schema {
            Schema::RowSchema(s) => rows.push(RowSchemaXml {
                block_id: *block_id,
                name: s.name.clone(),
                key: s.key as u32,
                fields: s
                    .fields
                    .iter()
                    .map(|(name, entry)| field_to_xml(name, entry))
                    .collect(),
            }),
            Schema::ColSchema(s) => cols.push(ColSchemaXml {
                block_id: *block_id,
                name: s.name.clone(),
                key: s.key as u32,
                fields: s
                    .fields
                    .iter()
                    .map(|(name, entry)| field_to_xml(name, entry))
                    .collect(),
            }),
            Schema::RandomSchema(s) => randoms.push(RandomSchemaXml {
                block_id: *block_id,
                name: s.name.clone(),
                key_fields: s
                    .key_field
                    .iter()
                    .map(|(key, row, col, render_id)| RandomKeyFieldXml {
                        key: key.clone(),
                        row: *row,
                        col: *col,
                        render_id: render_id.clone(),
                    })
                    .collect(),
            }),
        }
    }
    (rows, cols, randoms)
}

/// Inverse of [`schemas_to_xml`]: insert the three vecs into `manager.schemas`
/// and rebuild `manager.refs` entries for the inserted schemas. Designed to
/// be called once per sheet during file load before any cell evaluation
/// happens, so dependency-graph rebuilds see a populated schema map.
pub fn load_schemas_for_sheet(
    manager: &mut SchemaManager,
    sheet_id: SheetId,
    rows: Vec<RowSchemaXml>,
    cols: Vec<ColSchemaXml>,
    randoms: Vec<RandomSchemaXml>,
) {
    for x in rows {
        let block_id = x.block_id;
        let resolved = free_ref_name(&manager, x.name.clone(), block_id);
        let schema = RowSchema {
            fields: x.fields.into_iter().map(field_from_xml).collect(),
            name: resolved.clone(),
            key: x.key as RowId,
        };
        manager.refs.insert(resolved, (sheet_id, block_id));
        manager
            .schemas
            .insert((sheet_id, block_id), Schema::RowSchema(schema));
    }

    for x in cols {
        let block_id = x.block_id;
        let resolved = free_ref_name(&manager, x.name.clone(), block_id);
        let schema = ColSchema {
            fields: x.fields.into_iter().map(field_from_xml).collect(),
            name: resolved.clone(),
            key: x.key as ColId,
        };
        manager.refs.insert(resolved, (sheet_id, block_id));
        manager
            .schemas
            .insert((sheet_id, block_id), Schema::ColSchema(schema));
    }

    for x in randoms {
        let block_id = x.block_id;
        let resolved = free_ref_name(&manager, x.name.clone(), block_id);
        let schema = RandomSchema {
            key_field: x
                .key_fields
                .into_iter()
                .map(|kf| (kf.key, kf.row as RowId, kf.col as ColId, kf.render_id))
                .collect(),
            name: resolved.clone(),
        };
        manager.refs.insert(resolved, (sheet_id, block_id));
        manager
            .schemas
            .insert((sheet_id, block_id), Schema::RandomSchema(schema));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_row_schema() -> RowSchema {
        RowSchema {
            fields: vec![
                (
                    "qty".to_string(),
                    FieldEntry::new(3, "render-qty".to_string())
                        .with_value_formula(Some("=#KEY*2".to_string()))
                        .with_field_type(FieldType::Number)
                        .with_description(Some("how many, in units of 10".to_string()))
                        .with_required(true),
                ),
                (
                    "name".to_string(),
                    FieldEntry::new(4, "render-name".to_string())
                        .with_validation_formula(Some("LEN(#PLACEHOLDER)>0".to_string()))
                        .with_editability_formula(Some("TRUE".to_string()))
                        .with_field_type(FieldType::Text)
                        .with_unique(true)
                        .with_default_value(Some("(unnamed)".to_string())),
                ),
            ],
            name: "materials".to_string(),
            key: 2,
        }
    }

    fn sample_col_schema() -> ColSchema {
        ColSchema {
            fields: vec![(
                "alpha".to_string(),
                FieldEntry::new(7, "render-alpha".to_string()),
            )],
            name: "transposed".to_string(),
            key: 5,
        }
    }

    fn sample_random_schema() -> RandomSchema {
        RandomSchema {
            key_field: vec![
                ("k1".to_string(), 1, 2, "render-k1".to_string()),
                ("k2".to_string(), 3, 4, "render-k2".to_string()),
            ],
            name: "scattered".to_string(),
        }
    }

    #[test]
    fn round_trips_all_three_variants() {
        let mut original = SchemaManager::new();
        let sheet_id: SheetId = 1;
        original
            .schemas
            .insert((sheet_id, 10), Schema::RowSchema(sample_row_schema()));
        original
            .schemas
            .insert((sheet_id, 11), Schema::ColSchema(sample_col_schema()));
        original
            .schemas
            .insert((sheet_id, 12), Schema::RandomSchema(sample_random_schema()));

        let (rows, cols, randoms) = schemas_to_xml(&original, sheet_id);
        assert_eq!(rows.len(), 1);
        assert_eq!(cols.len(), 1);
        assert_eq!(randoms.len(), 1);

        let mut restored = SchemaManager::new();
        load_schemas_for_sheet(&mut restored, sheet_id, rows, cols, randoms);

        assert_eq!(restored.schemas.len(), 3);

        match restored.schemas.get(&(sheet_id, 10)) {
            Some(Schema::RowSchema(s)) => {
                assert_eq!(s.name, "materials");
                assert_eq!(s.key, 2);
                assert_eq!(s.fields.len(), 2);
                assert_eq!(s.fields[0].0, "qty");
                assert_eq!(s.fields[0].1.field_axis_id, 3);
                assert_eq!(s.fields[0].1.render_id, "render-qty");
                assert_eq!(s.fields[0].1.value_formula.as_deref(), Some("=#KEY*2"));
                assert_eq!(
                    s.fields[1].1.validation_formula.as_deref(),
                    Some("LEN(#PLACEHOLDER)>0")
                );

                // The declaration travels with the templates. Without this the
                // field's meaning would be wiped by every save/load — which is
                // exactly what happens while it lives in the host's AppData
                // blob and nothing but the browser app reads it.
                assert_eq!(s.fields[0].1.field_type, FieldType::Number);
                assert_eq!(
                    s.fields[0].1.description.as_deref(),
                    Some("how many, in units of 10")
                );
                assert!(s.fields[0].1.required);
                assert!(!s.fields[0].1.unique);
                assert_eq!(s.fields[1].1.field_type, FieldType::Text);
                assert!(s.fields[1].1.unique);
                assert!(!s.fields[1].1.required);
                assert_eq!(s.fields[1].1.default_value.as_deref(), Some("(unnamed)"));
            }
            _ => panic!("expected RowSchema at (1, 10)"),
        }

        match restored.schemas.get(&(sheet_id, 11)) {
            Some(Schema::ColSchema(s)) => {
                assert_eq!(s.name, "transposed");
                assert_eq!(s.key, 5);
                assert_eq!(s.fields[0].1.field_axis_id, 7);
            }
            _ => panic!("expected ColSchema at (1, 11)"),
        }

        match restored.schemas.get(&(sheet_id, 12)) {
            Some(Schema::RandomSchema(s)) => {
                assert_eq!(s.name, "scattered");
                assert_eq!(s.key_field.len(), 2);
                assert_eq!(
                    s.key_field[0],
                    ("k1".to_string(), 1, 2, "render-k1".to_string())
                );
            }
            _ => panic!("expected RandomSchema at (1, 12)"),
        }

        // Ref-name index is rebuilt for every restored schema.
        assert_eq!(restored.refs.get("materials"), Some(&(sheet_id, 10)));
        assert_eq!(restored.refs.get("transposed"), Some(&(sheet_id, 11)));
        assert_eq!(restored.refs.get("scattered"), Some(&(sheet_id, 12)));
    }

    #[test]
    fn skips_schemas_from_other_sheets() {
        let mut manager = SchemaManager::new();
        manager
            .schemas
            .insert((1, 10), Schema::RowSchema(sample_row_schema()));
        manager
            .schemas
            .insert((2, 10), Schema::RowSchema(sample_row_schema()));

        let (rows, _, _) = schemas_to_xml(&manager, 1);
        assert_eq!(rows.len(), 1, "only sheet 1's schema should be projected");
    }
}

/// A ref name nothing else answers to yet.
///
/// The bind path rejects a name that is taken; a load cannot — refusing would
/// make the file unopenable over something the file already contains. So a
/// collision here is resolved by suffixing, which keeps the later block
/// addressable instead of letting it silently steal the name and redirect every
/// BLOCKREF that meant the first one.
fn free_ref_name(
    manager: &SchemaManager,
    wanted: String,
    block_id: logisheets_base::BlockId,
) -> String {
    if !manager.refs.contains_key(&wanted) {
        return wanted;
    }
    let mut candidate = format!("{}-{}", wanted, block_id);
    let mut n = 2;
    while manager.refs.contains_key(&candidate) {
        candidate = format!("{}-{}-{}", wanted, block_id, n);
        n += 1;
    }
    candidate
}
