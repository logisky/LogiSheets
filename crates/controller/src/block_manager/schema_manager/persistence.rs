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

use super::schema::{ColSchema, FieldEntry, RandomSchema, RowSchema, Schema};
use super::SchemaManager;

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
                    .map(|(name, entry)| SchemaFieldXml {
                        name: name.clone(),
                        axis_id: entry.field_axis_id as u32,
                        render_id: entry.render_id.clone(),
                        value_formula: entry.value_formula.clone(),
                        validation_formula: entry.validation_formula.clone(),
                        editability_formula: entry.editability_formula.clone(),
                    })
                    .collect(),
            }),
            Schema::ColSchema(s) => cols.push(ColSchemaXml {
                block_id: *block_id,
                name: s.name.clone(),
                key: s.key as u32,
                fields: s
                    .fields
                    .iter()
                    .map(|(name, entry)| SchemaFieldXml {
                        name: name.clone(),
                        axis_id: entry.field_axis_id as u32,
                        render_id: entry.render_id.clone(),
                        value_formula: entry.value_formula.clone(),
                        validation_formula: entry.validation_formula.clone(),
                        editability_formula: entry.editability_formula.clone(),
                    })
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
        let name = x.name.clone();
        let schema = RowSchema {
            fields: x
                .fields
                .into_iter()
                .map(|f| {
                    (
                        f.name,
                        FieldEntry::new(f.axis_id as ColId, f.render_id)
                            .with_value_formula(f.value_formula)
                            .with_validation_formula(f.validation_formula)
                            .with_editability_formula(f.editability_formula),
                    )
                })
                .collect(),
            name: x.name,
            key: x.key as RowId,
        };
        manager.refs.insert(name, (sheet_id, block_id));
        manager
            .schemas
            .insert((sheet_id, block_id), Schema::RowSchema(schema));
    }

    for x in cols {
        let block_id = x.block_id;
        let name = x.name.clone();
        let schema = ColSchema {
            fields: x
                .fields
                .into_iter()
                .map(|f| {
                    (
                        f.name,
                        FieldEntry::new(f.axis_id as RowId, f.render_id)
                            .with_value_formula(f.value_formula)
                            .with_validation_formula(f.validation_formula)
                            .with_editability_formula(f.editability_formula),
                    )
                })
                .collect(),
            name: x.name,
            key: x.key as ColId,
        };
        manager.refs.insert(name, (sheet_id, block_id));
        manager
            .schemas
            .insert((sheet_id, block_id), Schema::ColSchema(schema));
    }

    for x in randoms {
        let block_id = x.block_id;
        let name = x.name.clone();
        let schema = RandomSchema {
            key_field: x
                .key_fields
                .into_iter()
                .map(|kf| (kf.key, kf.row as RowId, kf.col as ColId, kf.render_id))
                .collect(),
            name: x.name,
        };
        manager.refs.insert(name, (sheet_id, block_id));
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
                        .with_value_formula(Some("=#KEY*2".to_string())),
                ),
                (
                    "name".to_string(),
                    FieldEntry::new(4, "render-name".to_string())
                        .with_validation_formula(Some("LEN(#PLACEHOLDER)>0".to_string()))
                        .with_editability_formula(Some("TRUE".to_string())),
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
                assert_eq!(s.fields[1].1.validation_formula.as_deref(), Some("LEN(#PLACEHOLDER)>0"));
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
                assert_eq!(s.key_field[0], ("k1".to_string(), 1, 2, "render-k1".to_string()));
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
