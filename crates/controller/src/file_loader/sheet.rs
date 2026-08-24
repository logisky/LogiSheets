use logisheets_base::{CellId, CellValue, SheetId};
use logisheets_workbook::prelude::*;

use crate::{
    block_manager::schema_manager::SchemaManager,
    cell::Cell,
    cell_attachments::{
        CellAttachmentsManager,
        comment::{CommentNote, Mention, PersonInput},
    },
    connectors::FormulaConnector,
    container::{DataContainer, col_info_manager::ColInfo, row_info_manager::RowInfo},
    cube_manager::CubeManager,
    ext_book_manager::ExtBooksManager,
    ext_ref_manager::ExtRefManager,
    formula_manager::FormulaManager,
    id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
    range_manager::RangeManager,
    settings::Settings,
    sid_assigner::ShadowIdAssigner,
    workbook::sheet_info_manager::SheetInfoManager,
};

use super::{
    styles::StyleLoader,
    utils::{parse_cell, parse_range},
    vertex::{load_normal_formula, load_shared_formulas},
};

pub fn load_cols(
    sheet_id: SheetId,
    cols: &Vec<CtCol>,
    container: &mut DataContainer,
    style_loader: &mut StyleLoader,
    navigator: &mut Navigator,
) {
    cols.iter().for_each(|col| {
        let min = col.min - 1;
        let max = col.max - 1;
        let col_style_id = if col.style > 0 {
            style_loader.load_xf(col.style)
        } else {
            0
        };
        (min..max + 1).into_iter().for_each(|col_idx| {
            let col_id = navigator
                .fetch_col_id(&sheet_id, col_idx as usize)
                .unwrap_or(0);
            let col_info = ColInfo {
                best_fit: col.best_fit,
                collapsed: col.collapsed,
                custom_width: col.custom_width,
                hidden: col.hidden,
                outline_level: col.outline_level as u8,
                style: col_style_id,
                width: col.width,
            };
            container.set_col_info(sheet_id, col_id, col_info);
        });
    });
}

pub fn load_merge_cells(
    sheet_id: SheetId,
    merge_cells: &CtMergeCells,
    navigator: &mut Navigator,
    cell_attachment_manager: &mut CellAttachmentsManager,
) {
    merge_cells.merge_cells.iter().for_each(|mc| {
        let r = &mc.reference;
        if let Some(((start_row, start_col), (end_row, end_col))) = parse_range(&r) {
            let start_id = navigator.fetch_cell_id(&sheet_id, start_row, start_col);
            let end_id = navigator.fetch_cell_id(&sheet_id, end_row, end_col);
            match (start_id, end_id) {
                (Ok(start), Ok(end)) => match (start, end) {
                    (CellId::NormalCell(s), CellId::NormalCell(e)) => {
                        cell_attachment_manager
                            .merge_cells
                            .add_merge_cell(sheet_id, s, e);
                    }
                    _ => {}
                },
                _ => {}
            }
        }
    })
}

/// Register the workbook-level person list, preserving each person's on-disk
/// GUID so threaded-comment `personId` / `mentionpersonId` references resolve.
pub fn load_persons(persons: &Persons, cell_attachment_manager: &mut CellAttachmentsManager) {
    for p in persons.persons.iter() {
        cell_attachment_manager.comments.persons.register_with_guid(
            p.id.clone(),
            PersonInput {
                display_name: p.display_name.clone(),
                user_id: p.user_id.clone(),
                provider_id: p.provider_id.clone(),
            },
        );
    }
}

/// Load threaded comments (the source of truth). Persons must have been loaded
/// first via [`load_persons`]; any unknown `personId` is tolerated by
/// registering a placeholder person keyed on the raw GUID.
pub fn load_threaded_comments(
    sheet_id: SheetId,
    threaded: &ThreadedComments,
    navigator: &mut Navigator,
    cell_attachment_manager: &mut CellAttachmentsManager,
) {
    for c in threaded.comments.iter() {
        let Some((row, col)) = parse_cell(&c.reference) else {
            continue;
        };
        let Ok(cell_id) = navigator.fetch_cell_id(&sheet_id, row, col) else {
            continue;
        };
        let person = resolve_person_by_guid(cell_attachment_manager, &c.person_id);
        let mentions = c
            .mentions
            .as_ref()
            .map(|ms| {
                ms.mention
                    .iter()
                    .map(|m| Mention {
                        person: resolve_person_by_guid(
                            cell_attachment_manager,
                            &m.mention_person_id,
                        ),
                        start: m.start_index as usize,
                        len: m.length as usize,
                        mention_id: m.mention_id.clone(),
                    })
                    .collect()
            })
            .unwrap_or_default();
        let note = CommentNote {
            id: c.id.clone(),
            person,
            dt: c.dt.clone(),
            text: c.text.as_ref().map(|t| t.value.clone()).unwrap_or_default(),
            parent: c.parent_id.clone(),
            mentions,
            resolved: c.done,
        };
        cell_attachment_manager
            .comments
            .add_note(sheet_id, cell_id, note);
    }
}

fn resolve_person_by_guid(
    cell_attachment_manager: &mut CellAttachmentsManager,
    guid: &str,
) -> logisheets_base::PersonId {
    if let Some(id) = cell_attachment_manager.comments.persons.get_by_guid(guid) {
        return id;
    }
    cell_attachment_manager.comments.persons.register_with_guid(
        guid.to_string(),
        PersonInput {
            display_name: String::new(),
            user_id: None,
            provider_id: None,
        },
    )
}

/// Legacy `commentsN.xml` fallback used only when a sheet has no threaded
/// comments. Each legacy comment becomes a single root note authored by an
/// ad-hoc person (name only — legacy comments carry no directory identity).
pub fn load_comments(
    sheet_id: SheetId,
    comments: &Comments,
    navigator: &mut Navigator,
    cell_attachment_manager: &mut CellAttachmentsManager,
) {
    let authors = comments
        .authors
        .authors
        .iter()
        .map(|plain_text| plain_text.value.to_string())
        .collect::<Vec<_>>();
    for c in comments.comment_list.comments.iter() {
        let Some((row, col)) = parse_cell(&c.reference) else {
            continue;
        };
        let Ok(cell_id) = navigator.fetch_cell_id(&sheet_id, row, col) else {
            continue;
        };
        let text = rst_to_plain_text(&c.text);
        let author_name = authors
            .get(c.author_id as usize)
            .cloned()
            .unwrap_or_default();
        let person = cell_attachment_manager
            .comments
            .persons
            .get_or_register(PersonInput {
                display_name: author_name,
                user_id: None,
                provider_id: None,
            });
        let note = CommentNote {
            id: c
                .guid
                .clone()
                .unwrap_or_else(|| format!("{{{}}}", uuid::Uuid::new_v4())),
            person,
            dt: String::new(),
            text,
            parent: None,
            mentions: imbl::Vector::new(),
            resolved: false,
        };
        cell_attachment_manager
            .comments
            .add_note(sheet_id, cell_id, note);
    }
}

pub fn load_sheet_data(
    sheet_id: SheetId,
    book_name: &str,
    sheet_data: &CtSheetData,
    navigator: &mut Navigator,
    sheet_id_manager: &mut SheetIdManager,
    sheet_pos_manager: &mut SheetInfoManager,
    text_id_manager: &mut TextIdManager,
    func_id_manager: &mut FuncIdManager,
    name_id_manager: &mut NameIdManager,
    ext_books_manager: &mut ExtBooksManager,
    container: &mut DataContainer,
    formula_manager: &mut FormulaManager,
    range_manager: &mut RangeManager,
    cube_manager: &mut CubeManager,
    ext_ref_manager: &mut ExtRefManager,
    block_schema_manager: &SchemaManager,
    style_loader: &mut StyleLoader,
    xl: &Xl,
    // Formula cells the file gives us no value for. See the insert below.
    dirty: &mut imbl::HashSet<(SheetId, CellId)>,
) {
    navigator.add_sheet_id(&sheet_id);

    let mut base_curr_idx = 0;
    let mut offset = 0;
    sheet_data.rows.iter().for_each(|row| {
        let style_id = style_loader.load_xf(row.s);
        if let Some(idx) = row.r {
            let r = if idx > 0 { idx - 1 } else { 0 };
            base_curr_idx = r;
            offset = 0;
        }

        let row_info = RowInfo {
            collapsed: row.collapsed,
            custom_format: row.custom_format,
            custom_height: row.custom_height,
            hidden: row.hidden,
            ht: row.ht,
            outline_level: row.outline_level,
            style: style_id,
        };
        let idx = base_curr_idx + offset;
        let id = navigator.fetch_row_id(&sheet_id, idx as usize).unwrap();
        container.set_row_info(sheet_id, id, row_info);

        offset += 1;

        row.cells.iter().for_each(|ct_cell| {
            if let Some(r) = &ct_cell.r {
                if let Some((row, col)) = parse_cell(r) {
                    let cv = CellValue::from_cell(ct_cell, |idx| {
                        let rst = xl.sst.as_ref().unwrap().1.si.get(idx).unwrap();
                        let string = rst_to_plain_text(rst);
                        text_id_manager.get_or_register_id(&string)
                    });
                    let id = navigator.fetch_cell_id(&sheet_id, row, col).unwrap();
                    let style_id = style_loader.load_xf(ct_cell.s);
                    // A formula whose value element is absent or empty has
                    // never been computed by anyone: openpyxl and everything
                    // built on it write `<f>…</f><v/>`, and such a file also
                    // asks for a full recalculation through
                    // `calcPr@fullCalcOnLoad`. Nothing in the load path used to
                    // mark anything dirty, so those cells simply stayed blank —
                    // which went unnoticed because our own saver writes cached
                    // values, making a save-and-reload of our own files look
                    // like it worked when it was only reading the numbers back.
                    let uncomputed = matches!(cv, CellValue::Blank);
                    let cell = Cell {
                        value: cv,
                        style: style_id,
                    };
                    container.add_cell(sheet_id, id, cell);
                    if let Some(formula) = &ct_cell.f {
                        if uncomputed && formula.formula.is_some() {
                            dirty.insert((sheet_id, id));
                        }
                        let mut connector = FormulaConnector {
                            book_name,
                            sheet_pos_manager,
                            sheet_id_manager,
                            text_id_manager,
                            func_id_manager,
                            name_id_manager,
                            id_navigator: &mut navigator.clone(),
                            idx_navigator: navigator,
                            external_links_manager: ext_books_manager,
                            range_manager,
                            cube_manager,
                            ext_ref_manager,
                            block_schema_manager,
                            container,
                            sid_assigner: &mut ShadowIdAssigner::new(),
                        };
                        if let Some(f) = &formula.formula {
                            if let Some(reference) = &formula.reference {
                                if let Some(((row_start, col_start), (row_end, col_end))) =
                                    parse_range(reference)
                                {
                                    load_shared_formulas(
                                        formula_manager,
                                        sheet_id,
                                        row_start,
                                        col_start,
                                        row_start,
                                        col_start,
                                        row_end,
                                        col_end,
                                        f,
                                        &mut connector,
                                    )
                                } else if let Some((row_idx, col_idx)) = parse_cell(reference) {
                                    load_normal_formula(
                                        formula_manager,
                                        sheet_id,
                                        row_idx,
                                        col_idx,
                                        f,
                                        &mut connector,
                                    )
                                }
                            } else {
                                load_normal_formula(
                                    formula_manager,
                                    sheet_id,
                                    row,
                                    col,
                                    f,
                                    &mut connector,
                                )
                            }
                        }
                    }
                }
            }
        })
    });
}

pub fn load_sheet_format_pr(
    settings: &mut Settings,
    sheet_id: SheetId,
    sheet_format_pr: &CtSheetFormatPr,
) {
    settings
        .sheet_format_pr
        .insert(sheet_id, sheet_format_pr.clone());
}

pub fn load_sheet_views(settings: &mut Settings, sheet_id: SheetId, sheet_views: &CtSheetViews) {
    settings.sheet_views.insert(sheet_id, sheet_views.clone());
}

/// Capture the worksheet OOXML parts the controller does not model, so they
/// survive open→save (see `PreservedWorksheetParts`). Only stores an entry when
/// at least one part is present, to avoid empty rows for freshly-created sheets.
pub fn load_preserved_parts(
    settings: &mut Settings,
    sheet_id: SheetId,
    wp: &WorksheetPart,
    tables: &[logisheets_workbook::workbook::TablePart],
    pivot_tables: &[logisheets_workbook::workbook::PivotTablePart],
    unknown_parts: &[logisheets_workbook::workbook::UnknownPart],
) {
    let parts = crate::settings::PreservedWorksheetParts {
        sheet_calc_pr: wp.sheet_calc_pr.clone(),
        sheet_protection: wp.sheet_protection.clone(),
        protected_ranges: wp.protected_ranges.clone(),
        scenarios: wp.scenarios.clone(),
        auto_filter: wp.auto_filter.clone(),
        sort_state: wp.sort_state.clone(),
        data_consolidate: wp.data_consolidate.clone(),
        custom_sheet_views: wp.custom_sheet_views.clone(),
        phonetic_pr: wp.phonetic_pr.clone(),
        conditional_formatting: wp.conditional_formatting.clone(),
        hyperlinks: wp.hyperlinks.clone(),
        print_options: wp.print_options.clone(),
        page_margins: wp.page_margins.clone(),
        page_setup: wp.page_setup.clone(),
        header_footer: wp.header_footer.clone(),
        row_breaks: wp.row_breaks.clone(),
        col_breaks: wp.col_breaks.clone(),
        custom_properties: wp.custom_properties.clone(),
        cell_watches: wp.cell_watches.clone(),
        ignored_errors: wp.ignored_errors.clone(),
        smart_tags: wp.smart_tags.clone(),
        controls: wp.controls.clone(),
        web_publish_items: wp.web_publish_items.clone(),
        // Both halves of a structured table: the `<tableParts>` reference and
        // the `tableN.xml` parts it points at. Keeping only the reference would
        // dangle — which is why this was dropped before the parts were carried
        // too. The table is ALSO adopted as a block on load; preserving these
        // is what lets Excel still see a table on the way back out.
        table_parts: wp.table_parts.clone(),
        tables: tables.to_vec(),
        // The engine has no model for a pivot table, so it travels whole.
        pivot_tables: pivot_tables.to_vec(),
        unknown_parts: unknown_parts.to_vec(),
    };
    settings.preserved_parts.insert(sheet_id, parts);
}

fn rst_to_plain_text(rst: &CtRst) -> String {
    match &rst.t {
        Some(p) => p.value.to_string(),
        None => {
            let mut result = String::from("");
            rst.r.iter().for_each(|relt| {
                let s = relt.t.value.to_string();
                result.push_str(s.as_str());
            });
            result
        }
    }
}
