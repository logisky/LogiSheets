//! Express a pivot block as a REAL OOXML pivot table, so Excel opens it as a
//! pivot rather than as a grid of numbers it cannot recalculate.
//!
//! Our pivots are already the same shape as Excel's: a source table, a row
//! dimension, a column dimension, one aggregated measure. What differs is the
//! machinery — ours is a block of generated `SUMIFS(BLOCKREFSB(..))` formulas,
//! and `BLOCKREFSB` is ours alone, so Excel shows the cached values until the
//! first recalculation and `#NAME?` after it. Declaring the pivot in Excel's
//! own vocabulary is what makes the file mean the same thing in both places.
//!
//! **The cache is pointed at, not copied.** A source block already saves as a
//! structured `<table>`, and OOXML lets a pivot cache name a table as its
//! source. So the cache definition carries the field NAMES and
//! `refreshOnLoad="1"`, and no records at all: Excel rebuilds the cache from
//! the table on open. One copy of the data, a smaller file, and — the reason
//! that matters most — the LAYOUT is left to Excel, so the row and column item
//! lists we would otherwise have to enumerate by hand cannot be subtly wrong.
//!
//! **The parts are built as XML and parsed back, not assembled field by
//! field.** These types carry dozens of schema-defaulted attributes, and the
//! thing that has to be right is the XML. Writing it out means the reviewable
//! artifact is the artifact, and the templates here are modelled on
//! `crates/workbook/examples/pivot_table.xml` — a pivot table Excel itself
//! wrote — rather than on a reading of the spec. That is where
//! `firstHeaderRow="1" firstDataRow="1" firstDataCol="1"` comes from: it is
//! what Excel emits for exactly this shape.
//!
//! **Not every pivot is expressible, and an inexpressible one gets no part.**
//! A pivot table Excel renders with DIFFERENT numbers than ours would be worse
//! than no pivot table at all, so [`representable`] refuses everything it
//! cannot map exactly, and such a block is saved as our own values alone.

use logisheets_workbook::prelude::{PivotCacheDefinition, PivotTableDefinition};
use xmlserde::xml_deserialize_from_str;

use crate::block_manager::schema_manager::field_type::{AggFunc, PivotSpec};

/// A pivot block's geometry. The block INCLUDES its header line, because the
/// schema declares one — so the range Excel is told about is the block's own.
pub struct PivotGeometry {
    pub start_row: usize,
    pub start_col: usize,
    pub row_cnt: usize,
    pub col_cnt: usize,
}

/// One field of the pivot block, only as much as expressibility depends on.
pub struct PivotFieldFacts {
    /// `Some("*")` for a hand-declared column spanning every column value — a
    /// row total. `None` for an ordinary derived column.
    pub col_value: Option<String>,
    /// A per-column measure or function override, which Excel has no place for
    /// without adding a values axis.
    pub has_override: bool,
}

/// Why a pivot could not be expressed. Not an error — the caller carries on
/// and saves the block without a pivot part.
#[derive(Debug, PartialEq, Eq)]
pub enum NotExpressible {
    /// Excel's pivot filters select ITEMS; ours are condition expressions
    /// (`>100`, `<>closed`) evaluated per record. There is no mapping.
    HasFilters,
    /// Our pivot `COUNT` counts matching RECORDS whatever the measure holds.
    /// Excel's nearest is `count`, which skips blanks — the same number only
    /// when the measure has none. Rather than emit a pivot that disagrees with
    /// ours on some data, we emit none. `COUNTA` maps exactly.
    CountIsApproximate,
    /// More than one number per group, or a column measuring something of its
    /// own. Excel expresses those by adding a values axis, which lays the
    /// table out differently from ours.
    MultipleMeasures,
    /// A field the recipe names is not on the source — the recipe is broken,
    /// and a pivot part would be too.
    UnknownField,
}

/// The `<dataField subtotal=…>` for an aggregate, or `None` when the mapping
/// would not be exact.
fn subtotal_of(func: AggFunc) -> Option<&'static str> {
    match func {
        AggFunc::Sum => Some("sum"),
        AggFunc::Average => Some("average"),
        AggFunc::Min => Some("min"),
        AggFunc::Max => Some("max"),
        // Excel's `count` counts non-empty values, which is what COUNTA means.
        AggFunc::CountA => Some("count"),
        AggFunc::Count => None,
    }
}

/// A pivot that maps exactly, with the source-field indices its axes use.
#[derive(Debug, PartialEq, Eq)]
pub struct Expressible {
    pub row_field: usize,
    pub col_field: Option<usize>,
    pub data_field: usize,
    pub subtotal: &'static str,
    /// Whether the pivot carries a row-total column, which is Excel's
    /// `rowGrandTotals`.
    pub grand_total: bool,
}

/// Whether this pivot can be expressed as an OOXML pivot table showing the
/// SAME numbers, and if so which source fields its axes point at.
pub fn representable(
    spec: &PivotSpec,
    source_fields: &[String],
    pivot_fields: &[PivotFieldFacts],
) -> Result<Expressible, NotExpressible> {
    if !spec.filters.is_empty() {
        return Err(NotExpressible::HasFilters);
    }
    let subtotal = subtotal_of(spec.func).ok_or(NotExpressible::CountIsApproximate)?;

    // A hand-declared column is expressible only as the grand total: exactly
    // one of them, spanning every column value, measuring the recipe's own
    // measure with the recipe's own function.
    let declared = pivot_fields
        .iter()
        .filter(|f| f.col_value.is_some())
        .collect::<Vec<_>>();
    if declared.len() > 1 || declared.iter().any(|f| f.has_override) {
        return Err(NotExpressible::MultipleMeasures);
    }

    let index_of = |name: &str| source_fields.iter().position(|f| f == name);
    Ok(Expressible {
        row_field: index_of(&spec.row_dim).ok_or(NotExpressible::UnknownField)?,
        data_field: index_of(&spec.measure).ok_or(NotExpressible::UnknownField)?,
        col_field: match &spec.col_dim {
            Some(c) => Some(index_of(c).ok_or(NotExpressible::UnknownField)?),
            None => None,
        },
        subtotal,
        grand_total: declared.len() == 1,
    })
}

const MAIN_NS: &str = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

fn attr_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// The cache definition: the source's field names and a pointer at the table
/// holding them. No records; `refreshOnLoad` has Excel build them.
pub fn cache_definition_xml(source_table: &str, source_fields: &[String]) -> String {
    let fields = source_fields
        .iter()
        .map(|name| {
            format!(
                "<cacheField name=\"{}\" numFmtId=\"0\"><sharedItems/></cacheField>",
                attr_escape(name)
            )
        })
        .collect::<String>();
    format!(
        "<pivotCacheDefinition xmlns=\"{ns}\" \
         xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" \
         refreshOnLoad=\"1\" refreshedBy=\"LogiSheets\" createdVersion=\"3\" \
         refreshedVersion=\"3\" minRefreshableVersion=\"3\" recordCount=\"0\" \
         saveData=\"0\">\
         <cacheSource type=\"worksheet\"><worksheetSource name=\"{table}\"/></cacheSource>\
         <cacheFields count=\"{count}\">{fields}</cacheFields>\
         </pivotCacheDefinition>",
        ns = MAIN_NS,
        table = attr_escape(source_table),
        count = source_fields.len(),
        fields = fields,
    )
}

/// The pivot table definition, covering the label row plus the block's rows.
pub fn table_definition_xml(
    name: &str,
    cache_id: u32,
    geometry: &PivotGeometry,
    source_field_cnt: usize,
    e: &Expressible,
) -> String {
    // The header line is the block's own first row now, so the pivot table's
    // range is exactly the block's. It used to reach one row higher, back when
    // the labels were a stray row above it — which is the thing that did not
    // travel when the block moved.
    let first_row = geometry.start_row;
    let last_row = geometry.start_row + geometry.row_cnt.saturating_sub(1);
    let last_col = geometry.start_col + geometry.col_cnt.saturating_sub(1);
    let reference = format!(
        "{}{}:{}{}",
        crate::sqref::col_to_letters(geometry.start_col),
        first_row + 1,
        crate::sqref::col_to_letters(last_col),
        last_row + 1
    );

    // `showAll="0"` on every field, as Excel writes. No `<items>`: with the
    // cache set to refresh on load, Excel rebuilds them, and a list we
    // enumerated could only disagree.
    let pivot_fields = (0..source_field_cnt)
        .map(|i| {
            if i == e.row_field {
                "<pivotField axis=\"axisRow\" showAll=\"0\"/>".to_string()
            } else if Some(i) == e.col_field {
                "<pivotField axis=\"axisCol\" showAll=\"0\"/>".to_string()
            } else if i == e.data_field {
                "<pivotField dataField=\"1\" showAll=\"0\"/>".to_string()
            } else {
                "<pivotField showAll=\"0\"/>".to_string()
            }
        })
        .collect::<String>();

    let col_fields = match e.col_field {
        Some(c) => format!("<colFields count=\"1\"><field x=\"{c}\"/></colFields>"),
        None => String::new(),
    };

    format!(
        "<pivotTableDefinition xmlns=\"{ns}\" name=\"{name}\" cacheId=\"{cache_id}\" \
         dataCaption=\"Values\" createdVersion=\"3\" updatedVersion=\"3\" \
         minRefreshableVersion=\"3\" useAutoFormatting=\"1\" itemPrintTitles=\"1\" \
         indent=\"0\" outline=\"1\" outlineData=\"1\" multipleFieldFilters=\"0\" \
         applyNumberFormats=\"0\" applyBorderFormats=\"0\" applyFontFormats=\"0\" \
         applyPatternFormats=\"0\" applyAlignmentFormats=\"0\" \
         applyWidthHeightFormats=\"1\" rowGrandTotals=\"{row_grand}\" \
         colGrandTotals=\"0\">\
         <location ref=\"{reference}\" firstHeaderRow=\"1\" firstDataRow=\"1\" \
         firstDataCol=\"1\"/>\
         <pivotFields count=\"{field_cnt}\">{pivot_fields}</pivotFields>\
         <rowFields count=\"1\"><field x=\"{row_field}\"/></rowFields>\
         {col_fields}\
         <dataFields count=\"1\"><dataField fld=\"{data_field}\" \
         subtotal=\"{subtotal}\" baseField=\"0\" baseItem=\"0\"/></dataFields>\
         </pivotTableDefinition>",
        ns = MAIN_NS,
        name = attr_escape(name),
        cache_id = cache_id,
        row_grand = if e.grand_total { 1 } else { 0 },
        reference = reference,
        field_cnt = source_field_cnt,
        pivot_fields = pivot_fields,
        row_field = e.row_field,
        col_fields = col_fields,
        data_field = e.data_field,
        subtotal = e.subtotal,
    )
}

/// Parse the two templates into the parts the writer takes.
///
/// Parsing our own XML back is not a formality: it is what proves the template
/// is well formed and schema-shaped before it reaches a file, and it is how
/// the writer's types get their schema defaults without this module restating
/// several dozen attributes it has no opinion about.
pub fn build(
    name: &str,
    cache_id: u32,
    geometry: &PivotGeometry,
    source_table: &str,
    source_fields: &[String],
    e: &Expressible,
) -> Option<(PivotCacheDefinition, PivotTableDefinition)> {
    let cache = xml_deserialize_from_str::<PivotCacheDefinition>(&cache_definition_xml(
        source_table,
        source_fields,
    ))
    .ok()?;
    let table = xml_deserialize_from_str::<PivotTableDefinition>(&table_definition_xml(
        name,
        cache_id,
        geometry,
        source_fields.len(),
        e,
    ))
    .ok()?;
    Some((cache, table))
}

/// Everything the saver needs for one pivot block, or `None` when this block
/// is not a pivot, or is one Excel cannot be shown faithfully.
///
/// Kept here rather than in the saver so the saver's loop stays a loop: the
/// lookups are all about what a pivot IS, which is this module's subject.
pub fn generate_for_block(
    sheet_id: logisheets_base::SheetId,
    block_id: logisheets_base::BlockId,
    geometry: &PivotGeometry,
    navigator: &crate::navigator::Navigator,
    schema: &crate::block_manager::schema_manager::SchemaManager,
    cache_id: u32,
) -> Option<(PivotCacheDefinition, PivotTableDefinition)> {
    let place = navigator.get_block_place(&sheet_id, &block_id).ok()?;
    let spec = place.pivot.as_ref()?;
    let source_block = place.analyzes?;

    let name = schema.fetch_block_ref_name(sheet_id, block_id)?;
    // The cache names the source's TABLE, so it has to be the same sanitised
    // name the table part was given.
    let source_table =
        super::workbook::excel_table_name(&schema.fetch_block_ref_name(sheet_id, source_block)?);
    let source_fields = schema.get_all_fields_by_block(sheet_id, source_block)?;

    // The pivot's own columns, read the way the display path reads them, so
    // "is this a declared column" has one answer in the codebase.
    let first_row = *place.rows.get(0)?;
    let pivot_fields: Vec<PivotFieldFacts> = place
        .cols
        .iter()
        .map(|col| {
            let cell = logisheets_base::BlockCellId {
                block_id,
                row: first_row,
                col: *col,
            };
            let view = schema.field_view_for_block_cell(sheet_id, &cell);
            let column = view.as_ref().and_then(|v| v.pivot_column);
            PivotFieldFacts {
                col_value: column.map(|c| c.col_value.clone().unwrap_or_else(|| "*".to_string())),
                has_override: column.is_some_and(|c| c.measure.is_some() || c.func.is_some()),
            }
        })
        .collect();

    let e = representable(spec, &source_fields, &pivot_fields).ok()?;
    build(&name, cache_id, geometry, &source_table, &source_fields, &e)
}

/// Whether this block's pivot could be written as an OOXML pivot table, asked
/// on its own.
///
/// The saver asks the same question when it decides whether to emit the parts.
/// This exists so a HOST can ask it too — before building something, not after
/// discovering the file degraded. Answering only at save time means the choice
/// is made by whoever wrote the recipe, without being told there was one.
pub fn expressibility(
    sheet_id: logisheets_base::SheetId,
    block_id: logisheets_base::BlockId,
    navigator: &crate::navigator::Navigator,
    schema: &crate::block_manager::schema_manager::SchemaManager,
) -> Option<Result<Expressible, NotExpressible>> {
    let place = navigator.get_block_place(&sheet_id, &block_id).ok()?;
    let spec = place.pivot.as_ref()?;
    let source_block = place.analyzes?;
    let source_fields = schema.get_all_fields_by_block(sheet_id, source_block)?;
    Some(representable(
        spec,
        &source_fields,
        &pivot_field_facts(sheet_id, block_id, place, schema),
    ))
}

/// The pivot's own columns, read the way the display path reads them, so "is
/// this a declared column" has one answer in the codebase.
fn pivot_field_facts(
    sheet_id: logisheets_base::SheetId,
    block_id: logisheets_base::BlockId,
    place: &crate::navigator::BlockPlace,
    schema: &crate::block_manager::schema_manager::SchemaManager,
) -> Vec<PivotFieldFacts> {
    let Some(first_row) = place.rows.get(0).copied() else {
        return Vec::new();
    };
    place
        .cols
        .iter()
        .map(|col| {
            let cell = logisheets_base::BlockCellId {
                block_id,
                row: first_row,
                col: *col,
            };
            let view = schema.field_view_for_block_cell(sheet_id, &cell);
            let column = view.as_ref().and_then(|v| v.pivot_column);
            PivotFieldFacts {
                col_value: column.map(|c| c.col_value.clone().unwrap_or_else(|| "*".to_string())),
                has_override: column.is_some_and(|c| c.measure.is_some() || c.func.is_some()),
            }
        })
        .collect()
}

impl NotExpressible {
    /// Why, in words a host can pass on — and what to do instead.
    pub fn reason(&self) -> &'static str {
        match self {
            NotExpressible::HasFilters => {
                "it filters records by condition, and Excel's pivot filters select \
                 items from a list. Drop the filters, or accept that Excel will \
                 show the numbers without a pivot object."
            }
            NotExpressible::CountIsApproximate => {
                "COUNT counts records whatever the measure holds, and Excel's \
                 nearest (`count`) skips blanks — the same number only when the \
                 measure has no gaps. Use COUNTA, which maps exactly."
            }
            NotExpressible::MultipleMeasures => {
                "it shows more than one number per group, which Excel lays out \
                 with a values axis and therefore differently from this table."
            }
            NotExpressible::UnknownField => {
                "its recipe names a field the source does not have — the pivot is \
                 broken, so there is nothing correct to express."
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block_manager::schema_manager::field_type::{DimOrder, PivotFilter};

    fn spec(func: AggFunc, col_dim: Option<&str>) -> PivotSpec {
        PivotSpec {
            row_dim: "region".into(),
            col_dim: col_dim.map(String::from),
            measure: "amt".into(),
            func,
            order: DimOrder::Ascending,
            order_values: vec![],
            filters: vec![],
        }
    }

    fn source() -> Vec<String> {
        ["id", "region", "quarter", "amt"]
            .iter()
            .map(|s| s.to_string())
            .collect()
    }

    fn derived(n: usize) -> Vec<PivotFieldFacts> {
        (0..n)
            .map(|_| PivotFieldFacts {
                col_value: None,
                has_override: false,
            })
            .collect()
    }

    #[test]
    fn a_plain_cross_tab_maps_onto_the_source_field_indices() {
        let e = representable(&spec(AggFunc::Sum, Some("quarter")), &source(), &derived(3))
            .expect("expressible");
        assert_eq!(e.row_field, 1, "region is the source's second field");
        assert_eq!(e.col_field, Some(2));
        assert_eq!(e.data_field, 3);
        assert_eq!(e.subtotal, "sum");
        assert!(!e.grand_total);
    }

    #[test]
    fn a_row_total_becomes_excels_grand_total() {
        // The one hand-declared column Excel already has a concept for.
        let mut fields = derived(2);
        fields.push(PivotFieldFacts {
            col_value: Some("*".into()),
            has_override: false,
        });
        let e = representable(&spec(AggFunc::Sum, Some("quarter")), &source(), &fields)
            .expect("expressible");
        assert!(e.grand_total);
    }

    #[test]
    fn filters_are_not_expressible() {
        // Ours are condition expressions per record; Excel's select items.
        let mut s = spec(AggFunc::Sum, Some("quarter"));
        s.filters = vec![PivotFilter {
            field: "region".into(),
            criteria: "<>North".into(),
        }];
        assert_eq!(
            representable(&s, &source(), &derived(3)),
            Err(NotExpressible::HasFilters)
        );
    }

    #[test]
    fn count_is_refused_because_it_would_not_agree() {
        // Excel's `count` skips blanks; our pivot COUNT counts records. Equal
        // only when the measure has no gaps, so a part here would sometimes
        // show a different number than the sheet it sits in.
        assert_eq!(
            representable(&spec(AggFunc::Count, None), &source(), &derived(1)),
            Err(NotExpressible::CountIsApproximate)
        );
        // COUNTA is exactly Excel's `count`.
        assert_eq!(
            representable(&spec(AggFunc::CountA, None), &source(), &derived(1))
                .expect("expressible")
                .subtotal,
            "count"
        );
    }

    #[test]
    fn a_second_measure_is_not_expressible() {
        let mut fields = derived(2);
        fields.push(PivotFieldFacts {
            col_value: Some("*".into()),
            has_override: true,
        });
        assert_eq!(
            representable(&spec(AggFunc::Sum, Some("quarter")), &source(), &fields),
            Err(NotExpressible::MultipleMeasures)
        );
    }

    #[test]
    fn a_recipe_naming_a_missing_field_is_not_expressible() {
        let mut s = spec(AggFunc::Sum, None);
        s.measure = "gone".into();
        assert_eq!(
            representable(&s, &source(), &derived(1)),
            Err(NotExpressible::UnknownField)
        );
    }

    #[test]
    fn the_table_covers_exactly_the_block() {
        // Excel's pivot owns its header row, and so does the block: the schema
        // declares which line holds the names, so the header is INSIDE. The
        // ref used to reach a row higher, back when the labels were a stray
        // row above the block — the row that stayed behind on a move.
        let e = representable(&spec(AggFunc::Sum, Some("quarter")), &source(), &derived(3))
            .expect("expressible");
        let xml = table_definition_xml(
            "sales_pivot",
            1,
            &PivotGeometry {
                start_row: 7,
                start_col: 0,
                row_cnt: 3,
                col_cnt: 3,
            },
            4,
            &e,
        );
        // The block owns rows 7..9, which is A8:C10 in A1 terms.
        assert!(xml.contains("ref=\"A8:C10\""), "{xml}");
    }

    #[test]
    fn both_parts_parse_back_into_the_writers_types() {
        // The templates are hand-written XML, so this is the check that they
        // are well formed and shaped the way the schema says before any of it
        // reaches a file.
        let e = representable(&spec(AggFunc::Sum, Some("quarter")), &source(), &derived(3))
            .expect("expressible");
        let (cache, table) = build(
            "sales_pivot",
            1,
            &PivotGeometry {
                start_row: 7,
                start_col: 0,
                row_cnt: 3,
                col_cnt: 3,
            },
            "sales",
            &source(),
            &e,
        )
        .expect("both parts parse");

        assert!(cache.refresh_on_load, "Excel rebuilds the cache itself");
        assert_eq!(cache.record_count, Some(0), "and we ship no records");
        assert_eq!(cache.cache_fields.count, 4);
        assert_eq!(
            cache
                .cache_source
                .worksheet_source
                .as_ref()
                .unwrap()
                .name
                .as_deref(),
            Some("sales"),
            "the cache names the source TABLE, not a range"
        );

        assert_eq!(table.name, "sales_pivot");
        assert_eq!(table.cache_id, 1);
        assert_eq!(table.row_fields.as_ref().unwrap().field[0].x, 1);
        assert_eq!(table.col_fields.as_ref().unwrap().field[0].x, 2);
        let data = &table.data_fields.as_ref().unwrap().data_field[0];
        assert_eq!(data.fld, 3);
        assert_eq!(table.pivot_fields.as_ref().unwrap().count, 4);
    }

    #[test]
    fn a_name_with_a_quote_in_it_cannot_break_the_xml() {
        // Ref names reach these templates as attribute values.
        let e =
            representable(&spec(AggFunc::Sum, None), &source(), &derived(1)).expect("expressible");
        let (_, table) = build(
            "we\"ird & <odd>",
            1,
            &PivotGeometry {
                start_row: 7,
                start_col: 0,
                row_cnt: 1,
                col_cnt: 2,
            },
            "sales",
            &source(),
            &e,
        )
        .expect("still parses");
        assert_eq!(table.name, "we\"ird & <odd>");
    }
}
