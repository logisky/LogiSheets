use itertools::Itertools;
use logisheets_base::NormalRange;
use logisheets_workbook::{
    logisheets::{AppData, CellAppendix, LinkRangeXml, LogiSheetsData, Sheet},
    prelude::{ChartAnchor, ChartAnchorExtent, PassthroughPart},
    prelude::{
        CtConditionalFormatting, CtExternalReference, CtExternalReferences, CtPerson, CtSheet,
        CtSheets, Persons, WorkbookPart,
    },
    workbook::{Media, Wb, Worksheet, WorksheetDrawing, Xl},
};
use std::collections::HashMap;

use crate::{
    block_manager::{
        field_manager::{FieldRenderManager, persistence::field_renders_to_xml},
        schema_manager::{SchemaManager, persistence::schemas_to_xml},
    },
    cell_attachments::CellAttachmentsManager,
    container::DataContainer,
    data_validation_manager::DataValidationManager,
    ext_book_manager::ExtBooksManager,
    file_saver::{
        external_links::save_external_link, styles::save_sheet_style, worksheet::save_sheets,
    },
    formula_manager::FormulaManager,
    id_manager::{SheetIdManager, TextIdManager},
    image_manager::ImageManager,
    navigator::Navigator,
    settings::Settings,
    style_manager::StyleManager,
    theme_manager::ThemeManager,
    workbook::sheet_info_manager::SheetInfoManager,
};

use super::{SaverTrait, error::SaveError, sst::save_sst};

pub fn save_workbook<S: SaverTrait>(
    data_container: &DataContainer,
    formula_manager: &FormulaManager,
    attachment_manager: &CellAttachmentsManager,
    sheet_pos_manager: &SheetInfoManager,
    sheet_id_manager: &SheetIdManager,
    style_manager: &StyleManager,
    ext_book_manager: &ExtBooksManager,
    theme_manager: &ThemeManager,
    text_id_manager: &TextIdManager,
    navigator: &Navigator,
    settings: &Settings,
    app_data: Vec<AppData>,
    block_schema_manager: &SchemaManager,
    field_render_manager: &FieldRenderManager,
    image_manager: &ImageManager,
    chart_manager: &crate::chart_manager::ChartManager,
    data_validation_manager: &DataValidationManager,
    conditional_formatting_manager: &crate::conditional_formatting_manager::ConditionalFormattingManager,
    range_manager: &crate::range_manager::RangeManager,
    exclusive_manager: &crate::exclusive::ExclusiveManager,
    saver: &mut S,
) -> Result<Wb, SaveError> {
    let mut worksheets: HashMap<String, Worksheet> = HashMap::new();
    let mut ct_sheets: Vec<CtSheet> = vec![];
    let mut sheets: Vec<Sheet> = vec![];
    // Accumulated across all sheets: image bytes go to xl/media/ with globally
    // unique names; each sheet's drawing references them by relationship.
    let mut medias: Vec<Media> = vec![];
    let mut media_counter: usize = 0;
    // Table `displayName`s and ids have to be unique across the WORKBOOK, not
    // per sheet; Excel repairs a file where they collide. Two different block
    // ref names can sanitise to the same identifier, so the counter and the
    // taken-set live out here.
    let mut table_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut table_id_counter: u32 = 0;

    // In sheet ORDER, not hash order. `get_all_ids` walks a hash map, so which
    // sheet was handed `rId1` changed from one save to the next — the file stayed
    // internally consistent, but the output was not reproducible, and a
    // preserved part that keeps the relationship id it arrived with has to be
    // able to trust that minted ids are assigned predictably.
    let mut ordered_sheet_ids = sheet_id_manager.get_all_ids();
    ordered_sheet_ids.sort_by_key(|id| sheet_pos_manager.get_sheet_idx(id).unwrap_or(usize::MAX));
    ordered_sheet_ids
        .into_iter()
        .flat_map(|id| {
            let default_container = crate::container::SheetDataContainer::default();
            let sheet_data_container = data_container
                .get_sheet_container(id)
                .unwrap_or(&default_container);
            let sheet_nav = navigator
                .sheet_navs
                .get(&id)
                .ok_or(SaveError::SheetIdPosError(id))?;
            save_sheets(
                id,
                sheet_data_container,
                formula_manager,
                attachment_manager,
                sheet_pos_manager,
                sheet_id_manager,
                sheet_nav,
                settings,
                saver,
            )
        })
        .sorted_by_key(|a| a.0)
        .for_each(|(sheet_pos, ct_sheet, mut worksheet, block_ranges)| {
            // The tuple's first element is the sheet *position* (usize),
            // not the `SheetId`. Resolve the id from the position manager
            // so `schemas_to_xml` can filter by stable id.
            let sheet_id = sheet_pos_manager
                .get_sheet_id(sheet_pos)
                .expect("sheet position has a registered sheet id");

            // A structured table that arrived with the file was adopted as a
            // block, and the block may have grown or shrunk since. The
            // preserved `tableN.xml` still carries the range it had on the way
            // in, so re-point it at where its block is now — a stale `ref` is
            // how Excel ends up showing a table that stops one row short of its
            // own data.
            for tp in worksheet.tables.iter_mut() {
                let Some(range) = block_ranges.iter().find(|r| {
                    block_schema_manager
                        .fetch_block_ref_name(sheet_id, r.block_id)
                        .is_some_and(|n| n == tp.table.display_name)
                }) else {
                    continue;
                };
                let header = tp.table.header_row_count as usize;
                let totals = tp.table.totals_row_count as usize;
                let r0 = range.start_row.saturating_sub(header);
                let r1 = range.start_row + range.row_cnt - 1 + totals;
                let c1 = range.start_col + range.col_cnt - 1;
                let a1 = format!(
                    "{}{}:{}{}",
                    crate::sqref::col_to_letters(range.start_col),
                    r0 + 1,
                    crate::sqref::col_to_letters(c1),
                    r1 + 1
                );
                if let Some(af) = tp.table.auto_filter.as_mut() {
                    af.reference = a1.clone();
                }
                tp.table.reference = a1;
            }

            // Every other block becomes a table too, so a person opening the
            // file in Excel gets a real ListObject — filters, structured
            // references, styling — over the same rows the agent addresses by
            // name. Reloading here restores the block from `logisheets/data.xml`
            // (ref name, field rules, key column), and the table is recognised
            // as the same region rather than converted a second time; that
            // coexistence is what makes this safe.
            //
            // `headerRowCount` is 0 because a block's field names live in its
            // schema, not in a row of cells. This is the same shape Excel itself
            // writes for a table created with "My table has headers" unchecked:
            // the column names live in the table definition.
            {
                let mut used_rids: std::collections::HashSet<String> = worksheet
                    .tables
                    .iter()
                    .map(|t| t.rel_id.clone())
                    .collect();
                // A table preserved from the input already covers its block.
                let already_tabled: std::collections::HashSet<String> = worksheet
                    .tables
                    .iter()
                    .map(|t| t.table.display_name.clone())
                    .collect();
                for t in worksheet.tables.iter() {
                    table_names.insert(t.table.display_name.clone());
                    table_id_counter = table_id_counter.max(t.table.id);
                }
                for range in block_ranges.iter() {
                    let Some(ref_name) = block_schema_manager
                        .fetch_block_ref_name(sheet_id, range.block_id)
                    else {
                        continue; // no schema: nothing to name a table after
                    };
                    let base = excel_table_name(&ref_name);
                    if already_tabled.contains(&base) {
                        continue;
                    }
                    // Suffix rather than skip on a collision: a block silently
                    // missing its table is harder to notice than one named
                    // `sales_2`.
                    let mut display_name = base.clone();
                    let mut suffix = 2;
                    while table_names.contains(&display_name) {
                        display_name = format!("{}_{}", base, suffix);
                        suffix += 1;
                    }
                    let fields = block_schema_manager
                        .get_all_fields_by_block(sheet_id, range.block_id)
                        .unwrap_or_default();
                    if fields.is_empty() || range.row_cnt == 0 {
                        continue;
                    }
                    let mut rid_n = 1;
                    let rel_id = loop {
                        let candidate = format!("rIdTable{}", rid_n);
                        if used_rids.insert(candidate.clone()) {
                            break candidate;
                        }
                        rid_n += 1;
                    };
                    let a1 = format!(
                        "{}{}:{}{}",
                        crate::sqref::col_to_letters(range.start_col),
                        range.start_row + 1,
                        crate::sqref::col_to_letters(range.start_col + range.col_cnt - 1),
                        range.start_row + range.row_cnt
                    );
                    table_id_counter += 1;
                    table_names.insert(display_name.clone());
                    worksheet.tables.push(logisheets_workbook::workbook::TablePart {
                        rel_id,
                        table: block_to_table(table_id_counter, &display_name, &a1, &fields),
                    });
                }
                // The sheet's `<tableParts>` has to list every one of them, the
                // preserved and the synthesised alike, or the parts are orphaned.
                if worksheet.tables.is_empty() {
                    worksheet.worksheet_part.table_parts = None;
                } else {
                    worksheet.worksheet_part.table_parts = Some(logisheets_workbook::prelude::CtTableParts {
                        count: worksheet.tables.len() as u32,
                        parts: worksheet
                            .tables
                            .iter()
                            .map(|t| logisheets_workbook::prelude::CtTablePart {
                                id: t.rel_id.clone(),
                            })
                            .collect(),
                    });
                }
            }

            // Attach cell images as a SpreadsheetDrawingML part. Each image's
            // stable CellId is resolved to a (row, col) position; images on
            // deleted cells (no position) are dropped.
            let mut cell_images: Vec<(i32, i32, String)> = vec![];
            for (cell_id, img) in image_manager.images_of_sheet(sheet_id) {
                if let Ok((row, col)) = navigator.fetch_cell_idx(&sheet_id, &cell_id) {
                    media_counter += 1;
                    let media_name = format!("image{}.{}", media_counter, img.format);
                    cell_images.push((col as i32, row as i32, media_name.clone()));
                    medias.push(Media {
                        name: media_name,
                        data: (*img.data).clone(),
                    });
                }
            }
            // Charts: resolve each anchor's stable CellIds back to (row, col)
            // and collect the chart parts (deduped) to re-emit. Charts and
            // images share one drawing part.
            let mut chart_anchors: Vec<ChartAnchor> = vec![];
            let mut chart_parts: Vec<PassthroughPart> = vec![];
            let mut seen_parts: std::collections::HashSet<String> =
                std::collections::HashSet::new();
            for chart in chart_manager.charts_of_sheet(sheet_id) {
                let Ok((fr, fc)) = navigator.fetch_cell_idx(&sheet_id, &chart.from.cell) else {
                    continue;
                };
                // A chart goes back out under the anchor kind it came in with.
                let extent = match &chart.extent {
                    crate::chart_manager::ChartExtent::ToCell(m) => {
                        let Ok((tr, tc)) = navigator.fetch_cell_idx(&sheet_id, &m.cell) else {
                            continue;
                        };
                        ChartAnchorExtent::ToCell {
                            col: tc as i32,
                            row: tr as i32,
                            col_off: m.col_off,
                            row_off: m.row_off,
                        }
                    }
                    crate::chart_manager::ChartExtent::Size { cx, cy } => {
                        ChartAnchorExtent::Size { cx: *cx, cy: *cy }
                    }
                };
                chart_anchors.push(ChartAnchor {
                    from_col: fc as i32,
                    from_row: fr as i32,
                    from_col_off: chart.from.col_off,
                    from_row_off: chart.from.row_off,
                    extent,
                    chart_path: chart.part_path.clone(),
                    name: format!("Chart {}", chart.id),
                });
                for p in chart.raw.iter() {
                    if seen_parts.insert(p.path.clone()) {
                        chart_parts.push(p.clone());
                    }
                }
            }

            if !cell_images.is_empty() || !chart_anchors.is_empty() {
                worksheet.drawing = Some(WorksheetDrawing::build(
                    &cell_images,
                    chart_anchors,
                    chart_parts,
                ));
            }

            // Round-trip Excel data validation, stored verbatim per sheet.
            worksheet.worksheet_part.data_validations =
                data_validation_manager.get_sheet(sheet_id).cloned();

            // Conditional formatting: the modeled rules render their `sqref`
            // from the current positions of their anchor ids, so a rule whose
            // rows moved is written out at its new location. Elements that
            // could not be modeled at load stay in `preserved_parts` and are
            // already on `worksheet_part`; the modeled ones go in front.
            let mut modeled = conditional_formatting_manager_to_xml(
                conditional_formatting_manager,
                navigator,
                sheet_id,
            );
            modeled.extend(
                std::mem::take(&mut worksheet.worksheet_part.conditional_formatting).into_iter(),
            );
            worksheet.worksheet_part.conditional_formatting = modeled;

            worksheets.insert(ct_sheet.id.clone(), worksheet);
            ct_sheets.push(ct_sheet);
            let (row_schemas, col_schemas, random_schemas) =
                schemas_to_xml(block_schema_manager, sheet_id);
            // Range links: source rectangle (facade) + target block (id + sheet).
            let link_ranges: Vec<LinkRangeXml> = range_manager
                .get_sheet_manager_assert(&sheet_id)
                .map(|m| {
                    m.links
                        .iter()
                        .filter_map(|(source, (tgt_sheet, target))| {
                            let (s0, s1) = match source {
                                NormalRange::Single(c) => (*c, *c),
                                NormalRange::AddrRange(a, b) => (*a, *b),
                                _ => return None,
                            };
                            let (start_row, start_col) =
                                navigator.fetch_normal_cell_idx(&sheet_id, &s0).ok()?;
                            let (end_row, end_col) =
                                navigator.fetch_normal_cell_idx(&sheet_id, &s1).ok()?;
                            let block_sheet_idx = sheet_pos_manager.get_sheet_idx(tgt_sheet)?;
                            Some(LinkRangeXml {
                                block_id: target.block_id(),
                                block_sheet_idx,
                                start_row,
                                start_col,
                                end_row,
                                end_col,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            // Craft metadata on block cells, addressed the way it is held in
            // memory: by block id and a block-relative offset. Resolving the
            // BlockCellId's row/col ids to offsets here is what makes the
            // record survive the block moving between saves.
            let mut cell_appendices = Vec::new();
            if let Some(nav) = navigator.sheet_navs.get(&sheet_id) {
                for (cell, list) in exclusive_manager.appendix_manager.iter_sheet(sheet_id) {
                    let Some(bp) = nav.data.blocks.get(&cell.block_id) else {
                        continue;
                    };
                    let Some((row_idx, col_idx)) = bp.get_inner_idx(cell.row, cell.col) else {
                        continue;
                    };
                    for a in list.iter() {
                        cell_appendices.push(CellAppendix {
                            block_id: cell.block_id,
                            row_idx: row_idx as u32,
                            col_idx: col_idx as u32,
                            craft_id: a.craft_id.clone(),
                            craft_tag: a.tag as u32,
                            content: a.content.clone(),
                        });
                    }
                }
            }
            // `iter_sheet` walks a hash map, so without this the element order
            // changed from one save to the next. A stable sort by cell keeps
            // each cell's own stack in push order, which is the order the
            // craft that wrote them will read them back in.
            cell_appendices.sort_by_key(|a| (a.block_id, a.row_idx, a.col_idx));

            // field_renders_to_xml is invoked once at the end, below —
            // it's workbook-global, not per sheet.
            let sheet = Sheet {
                block_ranges,
                cell_appendices,
                row_schemas,
                col_schemas,
                random_schemas,
                link_ranges,
            };
            sheets.push(sheet);
        });
    let ct_sheets = CtSheets { sheets: ct_sheets };
    let styles = save_sheet_style(style_manager, saver);
    let style_id = saver.fetch_part_id();
    let (external_links, ct_references) = {
        let mut result = HashMap::new();
        let links = save_external_link(ext_book_manager, saver);
        let mut ct_references = Vec::with_capacity(links.len());
        links.into_iter().for_each(|link| {
            let id = saver.fetch_part_id();
            ct_references.push(CtExternalReference { id: id.clone() });
            result.insert(id, link);
        });
        (result, ct_references)
    };
    let theme = {
        if theme_manager.theme.is_none() {
            None
        } else {
            let t = theme_manager.clone().theme.unwrap();
            Some((saver.fetch_part_id(), t))
        }
    };
    let sst_part = save_sst(text_id_manager);
    let sst = if let Some(part) = sst_part {
        let id = saver.fetch_part_id();
        Some((id, part))
    } else {
        None
    };
    let persons = save_persons(attachment_manager);
    let workbook = Wb {
        unknown_parts: settings.unknown_package_parts.clone(),
        xl: Xl {
            workbook_part: get_workbook(ct_sheets, ct_references, settings),
            styles: (style_id, styles),
            sst,
            worksheets,
            external_links,
            theme,
            persons,
            medias,
            // The engine does not yet model pivot caches; none emitted on save.
            pivot_caches: settings.pivot_caches.clone(),
            unknown_parts: settings.unknown_workbook_parts.clone(),
        },
        // As they arrived, not `default()`: overwriting a file should not strip
        // its author and creation time.
        doc_props: settings.doc_props.clone(),
        logisheets: Some(LogiSheetsData {
            sheets,
            apps: app_data,
            field_renders: field_renders_to_xml(field_render_manager, style_manager),
        }),
    };
    Ok(workbook)
}

/// Serialize the workbook-level person registry to `xl/persons/person.xml`.
/// Returns `None` when no persons exist (so no part / rel is emitted).
fn save_persons(attachment_manager: &CellAttachmentsManager) -> Option<Persons> {
    let persons = attachment_manager
        .comments
        .persons
        .iter()
        .map(|(_, p)| CtPerson {
            display_name: p.display_name.clone(),
            id: p.guid.clone(),
            user_id: p.user_id.clone(),
            provider_id: p.provider_id.clone(),
        })
        .collect::<Vec<_>>();
    if persons.is_empty() {
        None
    } else {
        Some(Persons { persons })
    }
}

fn get_workbook(
    ct_sheets: CtSheets,
    ext_references: Vec<CtExternalReference>,
    settings: &Settings,
) -> WorkbookPart {
    let external_references = if ext_references.is_empty() {
        None
    } else {
        Some(CtExternalReferences {
            external_references: ext_references,
        })
    };
    // Hand back what came in for everything the controller does not model.
    let kept = &settings.preserved_workbook;
    WorkbookPart {
        file_version: kept.file_version.clone(),
        file_sharing: kept.file_sharing.clone(),
        workbook_pr: kept.workbook_pr.clone(),
        workbook_protection: kept.workbook_protection.clone(),
        book_views: kept.book_views.clone(),
        sheets: ct_sheets,
        function_groups: kept.function_groups.clone(),
        external_references,
        defined_names: kept.defined_names.clone(),
        calc_pr: None,
        ole_size: kept.ole_size.clone(),
        custom_workbook_views: kept.custom_workbook_views.clone(),
        pivot_caches: kept.pivot_caches.clone(),
        smart_tag_pr: kept.smart_tag_pr.clone(),
        smart_tag_types: kept.smart_tag_types.clone(),
        web_publishing: kept.web_publishing.clone(),
        file_recovery_pr: kept.file_recovery_pr.clone(),
        web_publish_objects: None,
        conformance: None,
    }
}

/// Render a sheet's modeled conditional formatting back to OOXML. A block whose
/// every range lost its anchors (the rows/columns were deleted) yields no
/// element — matching Excel, where deleting the covered rows removes the rule.
fn conditional_formatting_manager_to_xml(
    manager: &crate::conditional_formatting_manager::ConditionalFormattingManager,
    navigator: &Navigator,
    sheet_id: logisheets_base::SheetId,
) -> Vec<CtConditionalFormatting> {
    let Some(blocks) = manager.get_sheet(sheet_id) else {
        return Vec::new();
    };
    blocks
        .iter()
        .filter_map(|b| {
            let sqref = crate::conditional_formatting_manager::resolve::ranges_to_sqref(
                navigator, sheet_id, &b.ranges,
            );
            if sqref.is_empty() || b.rules.is_empty() {
                return None;
            }
            Some(CtConditionalFormatting {
                cf_rules: b.rules.iter().map(|r| r.rule.clone()).collect(),
                pviot: b.pivot,
                sqref,
            })
        })
        .collect()
}


/// A block ref name as an Excel table `displayName`. Excel requires an
/// identifier: letters, digits and underscores only, not starting with a digit,
/// and never something that could be read as a cell reference. Agent-chosen ref
/// names are none of those things by construction, so they are transliterated
/// rather than rejected.
fn excel_table_name(ref_name: &str) -> String {
    let mut out = String::with_capacity(ref_name.len());
    for ch in ref_name.chars() {
        if ch.is_alphanumeric() || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        return String::from("Block");
    }
    // Must not start with a digit, and must not look like `A1` / `R1C1`.
    let starts_bad = out.chars().next().is_some_and(|c| c.is_ascii_digit());
    let looks_like_ref = {
        let letters: String = out.chars().take_while(|c| c.is_ascii_alphabetic()).collect();
        let rest: String = out.chars().skip(letters.len()).collect();
        !letters.is_empty()
            && letters.len() <= 3
            && !rest.is_empty()
            && rest.chars().all(|c| c.is_ascii_digit())
    };
    if starts_bad || looks_like_ref {
        format!("_{}", out)
    } else {
        out
    }
}

/// A minimal `<table>` over a block: its rows, its fields as column names, no
/// header row. Styling is left to Excel's default so nothing is invented.
fn block_to_table(
    id: u32,
    display_name: &str,
    reference: &str,
    fields: &[String],
) -> logisheets_workbook::prelude::Table {
    use logisheets_workbook::prelude::{CtTableColumn, CtTableColumns, Table};
    Table {
        auto_filter: None,
        sort_state: None,
        table_columns: CtTableColumns {
            count: fields.len() as u32,
            table_column: fields
                .iter()
                .enumerate()
                .map(|(i, name)| CtTableColumn {
                    calculated_column_formula: None,
                    totals_row_formula: None,
                    xml_column_pr: None,
                    ext_lst: None,
                    id: i as u32 + 1,
                    unique_name: None,
                    name: name.clone(),
                    totals_row_function: None,
                    totals_row_label: None,
                    query_table_field_id: None,
                    header_row_dxf_id: None,
                    data_dxf_id: None,
                    totals_row_dxf_id: None,
                    header_row_cell_style: None,
                    data_cell_style: None,
                    totals_row_cell_style: None,
                })
                .collect(),
        },
        table_style_info: None,
        ext_lst: None,
        id,
        name: None,
        display_name: display_name.to_string(),
        comment: None,
        reference: reference.to_string(),
        table_type: None,
        header_row_count: 0,
        insert_row: false,
        insert_row_shift: false,
        totals_row_count: 0,
        totals_row_shown: true,
        published: false,
        header_row_dxf_id: None,
        data_dxf_id: None,
        totals_row_dxf_id: None,
        header_row_border_dxf_id: None,
        table_border_dxf_id: None,
        totals_row_border_dxf_id: None,
        header_row_cell_style: None,
        data_cell_style: None,
        totals_row_cell_style: None,
        connection_id: None,
    }
}
