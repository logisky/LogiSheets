use std::vec;

use itertools::Itertools;
use logisheets_base::SheetId;
use logisheets_parser::unparse::{CellShift, Stringify};
use logisheets_workbook::{
    logisheets::{BlockLineInfo, BlockRange},
    prelude::{
        Comments, CtAuthors, CtCell, CtCol, CtColor, CtCols, CtComment, CtCommentList, CtFormula,
        CtMention, CtMentions, CtMergeCell, CtMergeCells, CtRow, CtRst, CtSheet, CtSheetData,
        CtSheetPr, CtThreadedComment, PlainTextString, StCellFormulaType, StSheetState,
        ThreadedComments, WorksheetPart,
    },
    workbook::Worksheet,
};

use crate::{
    cell_attachments::CellAttachmentsManager,
    container::SheetDataContainer,
    file_saver::utils::{SortedSet, convert_string_to_plain_text_string, unparse_cell},
    formula_manager::FormulaManager,
    id_manager::SheetIdManager,
    navigator::SheetNav,
    settings::Settings,
    workbook::sheet_info_manager::SheetInfoManager,
};

use super::{SaverTrait, error::SaveError};

pub fn save_sheets<S: SaverTrait>(
    sheet_id: SheetId,
    sheet_data_container: &SheetDataContainer,
    formula_manager: &FormulaManager,
    attachment_manager: &CellAttachmentsManager,
    sheet_info_manager: &SheetInfoManager,
    sheet_name_manager: &SheetIdManager,
    sheet_nav: &SheetNav,
    settings: &Settings,
    saver: &mut S,
) -> Result<(usize, CtSheet, Worksheet, Vec<BlockRange>), SaveError> {
    let pos = sheet_info_manager
        .get_sheet_idx(&sheet_id)
        .ok_or(SaveError::SheetIdPosError(sheet_id))?;
    let worksheet = save_worksheet(
        sheet_id,
        sheet_data_container,
        formula_manager,
        attachment_manager,
        settings,
        sheet_info_manager,
        saver,
    );
    let sheet_name = sheet_name_manager
        .get_string(&sheet_id)
        .ok_or(SaveError::SheetNameError(sheet_id))?;
    let id = saver.fetch_part_id();
    let is_hidden = sheet_info_manager.is_hidden(&sheet_id);
    let ct_sheet = CtSheet {
        name: sheet_name,
        // Excel's own identifier, kept as it arrived. Writing the position here
        // renumbered a workbook's sheets on every save.
        sheet_id: settings
            .sheet_ooxml_ids
            .get(&sheet_id)
            .copied()
            .unwrap_or(pos as u32 + 1),
        state: if is_hidden {
            StSheetState::Hidden
        } else {
            StSheetState::Visible
        },
        id,
    };
    let block_ranges = sheet_nav
        .data
        .blocks
        .iter()
        .flat_map(|(block_id, block)| {
            let master = block.master;
            // Only the annotated lines are written, so each one carries its own
            // position along the block's axis. Without it the loader can only
            // zip positionally, which puts a lone column-2 annotation on column
            // 0 — a block is rarely annotated end to end.
            let row_infos = block
                .rows
                .iter()
                .enumerate()
                .filter_map(|(line, row_id)| {
                    let info = sheet_data_container
                        .block_line_info_manager
                        .get_row_info(*block_id, *row_id)?;
                    Some(BlockLineInfo {
                        line: Some(line as u32),
                        style: info.style,
                        name: info.name.clone(),
                        field_id: info.field_id.clone(),
                        diy_render: info.diy_render,
                    })
                })
                .collect::<Vec<_>>();
            let col_infos = block
                .cols
                .iter()
                .enumerate()
                .filter_map(|(line, col_id)| {
                    let info = sheet_data_container
                        .block_line_info_manager
                        .get_col_info(*block_id, *col_id)?;
                    Some(BlockLineInfo {
                        line: Some(line as u32),
                        style: info.style,
                        name: info.name.clone(),
                        field_id: info.field_id.clone(),
                        diy_render: info.diy_render,
                    })
                })
                .collect::<Vec<_>>();
            if let Ok((row_idx, col_idx)) = saver.fetch_normal_cell_index(&sheet_id, &master) {
                let owner = if block.owner.is_empty() {
                    None
                } else {
                    Some(block.owner.clone())
                };
                let modify_policy = match block.modify_policy {
                    crate::edit_action::ModifyPolicy::All => None,
                    ref p => Some(p.as_wire_str().to_string()),
                };
                Some(BlockRange {
                    block_id: *block_id,
                    start_row: row_idx,
                    start_col: col_idx,
                    row_cnt: block.rows.len(),
                    col_cnt: block.cols.len(),
                    owner,
                    modify_policy,
                    row_infos,
                    col_infos,
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    Ok((pos, ct_sheet, worksheet, block_ranges))
}

fn save_worksheet<S: SaverTrait>(
    sheet_id: SheetId,
    sheet_data_container: &SheetDataContainer,
    formula_manager: &FormulaManager,
    attachment_manager: &CellAttachmentsManager,
    settings: &Settings,
    sheet_info_manager: &SheetInfoManager,
    saver: &mut S,
) -> Worksheet {
    let worksheet_part = save_worksheet_part(
        sheet_id,
        sheet_data_container,
        formula_manager,
        attachment_manager,
        settings,
        sheet_info_manager,
        saver,
    );
    let comments = save_comments(sheet_id, attachment_manager, saver);
    let threaded_comments = save_threaded_comments(sheet_id, attachment_manager, saver);
    Worksheet {
        worksheet_part,
        comments,
        threaded_comments,
        // Cell images are attached later in `save_workbook`, which has the
        // navigator and image manager needed to resolve cell positions.
        drawing: None,
        // No model for a pivot table either, so it goes back exactly as it
        // arrived. Dropping it used to take the pivot out of the workbook while
        // leaving the cache it read from behind — half a feature is worse than
        // either whole one.
        unknown_parts: settings
            .preserved_parts
            .get(&sheet_id)
            .map(|p| p.unknown_parts.clone())
            .unwrap_or_default(),
        pivot_tables: settings
            .preserved_parts
            .get(&sheet_id)
            .map(|p| p.pivot_tables.clone())
            .unwrap_or_default(),
        // Structured tables are handed back as they came in, so a file that
        // arrived with an Excel table still has one after a save. The engine
        // adopts them as blocks on load; that does not have to cost the
        // ListObject on the way out.
        tables: settings
            .preserved_parts
            .get(&sheet_id)
            .map(|p| p.tables.clone())
            .unwrap_or_default(),
    }
}

fn save_worksheet_part<S: SaverTrait>(
    sheet_id: SheetId,
    sheet_data_container: &SheetDataContainer,
    formula_manager: &FormulaManager,
    attachment_manager: &CellAttachmentsManager,
    settings: &Settings,
    sheet_info_manager: &SheetInfoManager,
    saver: &mut S,
) -> WorksheetPart {
    let cols = save_cols(sheet_id, sheet_data_container, saver);
    let sheet_data = save_sheet_data(sheet_id, sheet_data_container, formula_manager, saver);
    let merge_cells = save_merge_cells(sheet_id, attachment_manager, saver);
    let sheet_pr = save_sheet_pr(sheet_id, sheet_info_manager, saver);
    let sheet_format_pr = settings.sheet_format_pr.get(&sheet_id).map(|e| e.clone());
    let sheet_views = settings.sheet_views.get(&sheet_id).map(|e| e.clone());
    // Re-emit the unmodeled worksheet parts captured at load (conditional
    // formatting, hyperlinks, filters, page setup, protection, table parts, ...)
    // so open→save preserves them instead of dropping them.
    let preserved = settings.preserved_parts.get(&sheet_id);
    WorksheetPart {
        cols,
        sheet_data,
        sheet_pr,
        dimension: None,
        sheet_views,
        sheet_format_pr,
        sheet_calc_pr: preserved.and_then(|p| p.sheet_calc_pr.clone()),
        sheet_protection: preserved.and_then(|p| p.sheet_protection.clone()),
        protected_ranges: preserved.and_then(|p| p.protected_ranges.clone()),
        scenarios: preserved.and_then(|p| p.scenarios.clone()),
        auto_filter: preserved.and_then(|p| p.auto_filter.clone()),
        sort_state: preserved.and_then(|p| p.sort_state.clone()),
        data_consolidate: preserved.and_then(|p| p.data_consolidate.clone()),
        custom_sheet_views: preserved.and_then(|p| p.custom_sheet_views.clone()),
        merge_cells: merge_cells,
        phonetic_pr: preserved.and_then(|p| p.phonetic_pr.clone()),
        conditional_formatting: preserved
            .map(|p| p.conditional_formatting.clone())
            .unwrap_or_default(),
        // Set later from the DataValidationManager (see file_saver/workbook.rs).
        data_validations: None,
        hyperlinks: preserved.and_then(|p| p.hyperlinks.clone()),
        print_options: preserved.and_then(|p| p.print_options.clone()),
        page_margins: preserved.and_then(|p| p.page_margins.clone()),
        page_setup: preserved.and_then(|p| p.page_setup.clone()),
        header_footer: preserved.and_then(|p| p.header_footer.clone()),
        row_breaks: preserved.and_then(|p| p.row_breaks.clone()),
        col_breaks: preserved.and_then(|p| p.col_breaks.clone()),
        custom_properties: preserved.and_then(|p| p.custom_properties.clone()),
        cell_watches: preserved.and_then(|p| p.cell_watches.clone()),
        ignored_errors: preserved.and_then(|p| p.ignored_errors.clone()),
        smart_tags: preserved.and_then(|p| p.smart_tags.clone()),
        // Set later from the image/chart managers (see file_saver/workbook.rs).
        drawing: None,
        drawing_hf: None,
        picture: None,
        controls: preserved.and_then(|p| p.controls.clone()),
        web_publish_items: preserved.and_then(|p| p.web_publish_items.clone()),
        table_parts: preserved.and_then(|p| p.table_parts.clone()),
    }
}

fn save_sheet_pr<S: SaverTrait>(
    sheet_id: u16,
    sheet_info_manager: &SheetInfoManager,
    _saver: &mut S,
) -> Option<CtSheetPr> {
    let color = sheet_info_manager.get_color(&sheet_id)?;
    Some(CtSheetPr {
        tab_color: Some(CtColor {
            auto: None,
            indexed: None,
            rgb: Some(color),
            theme: None,
            tint: 0.,
        }),
        outline_pr: None,
        page_setup_pr: None,
        sync_horizontal: false,
        sync_vertical: false,
        sync_ref: None,
        transition_evaluation: false,
        transition_entry: false,
        published: true,
        code_name: None,
        filter_mode: false,
        enable_format_conditions_calculation: true,
    })
}

/// Legacy `commentsN.xml` mirror. Threaded comments are the source of truth,
/// but we still emit a legacy comment (author + text of each thread's root
/// note) so that pre-2018 readers see something. Excel marks these mirrors with
/// an author of `tc={guid}`; we do the same.
fn save_comments<S: SaverTrait>(
    sheet_id: SheetId,
    attachment_manager: &CellAttachmentsManager,
    saver: &mut S,
) -> Option<Comments> {
    let comments = &attachment_manager.comments;
    let mut author_sorted_set: SortedSet<String> = SortedSet::new();
    let sheet_comments = comments
        .data
        .get(&sheet_id)?
        .threads
        .iter()
        .filter_map(|(cell_id, thread)| {
            // Only the root note is mirrored to the legacy comment.
            let root = thread.iter().find(|n| n.parent.is_none())?;
            let author = format!("tc={}", root.id);
            let author_id = author_sorted_set.insert(author) as u32;
            let comment_plain_text = convert_string_to_plain_text_string(root.text.clone());
            let (row, col) = saver.fetch_cell_idx(&sheet_id, cell_id).ok()?;
            let reference = unparse_cell(row, col);
            Some(CtComment {
                text: CtRst {
                    t: Some(comment_plain_text),
                    r: vec![],
                    r_ph: vec![],
                    phonetic_pr: None,
                },
                comment_pr: None,
                reference,
                author_id,
                shape_id: None,
                guid: Some(root.id.clone()),
            })
        })
        .collect::<Vec<_>>();
    if sheet_comments.is_empty() {
        return None;
    }
    let authors = author_sorted_set
        .to_vec()
        .into_iter()
        .map(|e| convert_string_to_plain_text_string(e))
        .collect::<Vec<_>>();
    Some(Comments {
        authors: CtAuthors { authors },
        comment_list: CtCommentList {
            comments: sheet_comments,
        },
    })
}

/// Threaded comments (`threadedCommentN.xml`) — the source of truth. `personId`
/// / `mentionpersonId` reference the workbook-level `xl/persons/person.xml`
/// written from the same [`PersonManager`].
fn save_threaded_comments<S: SaverTrait>(
    sheet_id: SheetId,
    attachment_manager: &CellAttachmentsManager,
    saver: &mut S,
) -> Option<ThreadedComments> {
    let comments = &attachment_manager.comments;
    let sheet = comments.data.get(&sheet_id)?;
    let mut out: Vec<CtThreadedComment> = vec![];
    for (cell_id, thread) in sheet.threads.iter() {
        let Ok((row, col)) = saver.fetch_cell_idx(&sheet_id, cell_id) else {
            continue;
        };
        let reference = unparse_cell(row, col);
        for note in thread.iter() {
            let person_id = comments
                .persons
                .get(&note.person)
                .map(|p| p.guid.clone())
                .unwrap_or_default();
            let mentions = if note.mentions.is_empty() {
                None
            } else {
                Some(CtMentions {
                    mention: note
                        .mentions
                        .iter()
                        .map(|m| CtMention {
                            mention_person_id: comments
                                .persons
                                .get(&m.person)
                                .map(|p| p.guid.clone())
                                .unwrap_or_default(),
                            mention_id: m.mention_id.clone(),
                            start_index: m.start as u32,
                            length: m.len as u32,
                        })
                        .collect(),
                })
            };
            out.push(CtThreadedComment {
                text: Some(PlainTextString {
                    value: note.text.clone(),
                    space: None,
                }),
                mentions,
                reference: reference.clone(),
                dt: note.dt.clone(),
                person_id,
                id: note.id.clone(),
                parent_id: note.parent.clone(),
                done: note.resolved,
            });
        }
    }
    if out.is_empty() {
        return None;
    }
    Some(ThreadedComments { comments: out })
}

fn save_merge_cells<S: SaverTrait>(
    sheet_id: SheetId,
    attachments: &CellAttachmentsManager,
    saver: &mut S,
) -> Option<CtMergeCells> {
    let merge_cells = attachments
        .merge_cells
        .data
        .get(&sheet_id)?
        .iter()
        .flat_map(|(k, v)| {
            let (start_row, start_col) = saver.fetch_normal_cell_index(&sheet_id, k).ok()?;
            let (end_row, end_col) = saver.fetch_normal_cell_index(&sheet_id, v).ok()?;
            let start_str = unparse_cell(start_row, start_col);
            let end_str = unparse_cell(end_row, end_col);
            let r = format!("{}:{}", start_str, end_str);
            Some(CtMergeCell { reference: r })
        })
        .collect::<Vec<_>>();
    if merge_cells.is_empty() {
        None
    } else {
        Some(CtMergeCells {
            count: merge_cells.len() as u32,
            merge_cells,
        })
    }
}

fn save_cols<S: SaverTrait>(
    sheet_id: SheetId,
    sheet_data_container: &SheetDataContainer,
    saver: &mut S,
) -> Option<CtCols> {
    let col_infos = sheet_data_container
        .col_info
        .get_all_col_info()
        .into_iter()
        .map(|(id, info)| {
            let idx = saver.fetch_col_idx(&sheet_id, &id).unwrap();
            (idx, info)
        })
        .sorted_by_key(|a| a.0)
        .map(|(idx, col_info)| CtCol {
            min: idx as u32 + 1,
            max: idx as u32 + 1,
            width: col_info.width,
            style: col_info.style,
            hidden: col_info.hidden,
            best_fit: col_info.best_fit,
            custom_width: col_info.custom_width,
            phonetic: false,
            outline_level: col_info.outline_level as u32,
            collapsed: col_info.collapsed,
        })
        .collect::<Vec<_>>();

    if col_infos.is_empty() {
        None
    } else {
        Some(CtCols { cols: col_infos })
    }
}

fn save_sheet_data<S: SaverTrait>(
    sheet_id: SheetId,
    sheet_data_container: &SheetDataContainer,
    formula_manager: &FormulaManager,
    saver: &mut S,
) -> CtSheetData {
    let rows = sheet_data_container
        .cells
        .clone()
        .into_iter()
        .map(|(id, cell)| {
            let (r, c) = saver.fetch_cell_index(&sheet_id, &id).ok()?;
            let (v, t) = cell.value.to_ct_value();
            let f = formula_manager
                .formulas
                .get(&(sheet_id, id))
                .and_then(|node| {
                    let f = node.unparse(saver, sheet_id, CellShift::ZERO).unwrap();
                    Some(CtFormula {
                        formula: Some(f),
                        t: StCellFormulaType::Normal, // we only support normal formula for now
                        aca: false,
                        reference: None,
                        dt_2d: false,
                        del1: false,
                        del2: false,
                        r1: None,
                        r2: None,
                        ca: false, // todo
                        si: None,
                        bx: false,
                    })
                });
            let reference = unparse_cell(r, c);
            let ct_cell = CtCell {
                f,
                v,
                is: None,
                r: Some(reference),
                s: cell.style,
                t,
                cm: 0,
                vm: 0,
                ph: false,
            };
            Some(((r, c), ct_cell))
        })
        .flatten()
        .sorted_by_key(|((r, _), _)| *r)
        .group_by(|((row, _), _)| *row)
        .into_iter()
        .map(|(row, group)| {
            let cells = group
                .sorted_by_key(|((_, col), _)| *col)
                .map(|((_, _), c)| c)
                .collect::<Vec<_>>();
            (row, cells)
        })
        .map(|(row_idx, cells)| {
            let row_id = saver.fetch_row_id(sheet_id, row_idx);
            if let Some(row_info) = sheet_data_container.row_info.get_row_info(row_id) {
                let s = if row_info.custom_format {
                    row_info.style + 1
                } else {
                    0
                };
                CtRow {
                    cells,
                    r: Some(1 + row_idx as u32),
                    spans: None, // TODO: clearfy this one
                    s,
                    custom_format: row_info.custom_format,
                    ht: row_info.ht,
                    hidden: row_info.hidden,
                    custom_height: row_info.custom_height,
                    outline_level: row_info.outline_level,
                    collapsed: row_info.collapsed,
                    thick_top: false,
                    thick_bot: false,
                    ph: false,
                }
            } else {
                CtRow {
                    cells,
                    r: Some(1 + row_idx as u32),
                    spans: None,
                    s: 0,
                    custom_format: false,
                    ht: None,
                    hidden: false,
                    custom_height: false,
                    outline_level: 0,
                    collapsed: false,
                    thick_top: false,
                    thick_bot: false,
                    ph: false,
                }
            }
        })
        .collect::<Vec<_>>();

    if rows.is_empty() {
        return CtSheetData { rows };
    }
    // We have collected cells and grouped them by rows, here we will find the
    // empty row and keep the row number continuous.
    let mut new_rows: Vec<CtRow> = Vec::with_capacity(rows.last().unwrap().r.unwrap() as usize);
    let mut next = 1;
    rows.into_iter().for_each(|mut row| {
        // safe to unwrap
        let r = row.r.unwrap();
        let mut skip = false;
        while next < r {
            // `next` is a 1-based row NUMBER; row info is keyed by row id, and
            // the two are unrelated. Looking one up with the other handed these
            // gap rows a different row's height, style and hidden flag — an
            // empty hidden row came back visible wearing someone else's format.
            let row_id = saver.fetch_row_id(sheet_id, next as usize - 1);
            let row_info = sheet_data_container.row_info.get_row_info(row_id);
            if let Some(info) = row_info {
                let i = CtRow {
                    cells: vec![],
                    r: None,
                    spans: None,
                    // Same convention as the cell-bearing branch above: the
                    // style index is only meaningful when custom_format is set,
                    // and it is stored one lower than it is written.
                    s: if info.custom_format { info.style + 1 } else { 0 },
                    custom_format: info.custom_format,
                    ht: info.ht,
                    hidden: info.hidden,
                    custom_height: info.custom_height,
                    outline_level: info.outline_level,
                    collapsed: info.collapsed,
                    thick_top: false,
                    thick_bot: false,
                    ph: false,
                };
                new_rows.push(i);
                next += 1;
            } else {
                next = r;
                skip = true;
            };
        }
        if !skip {
            row.r = None; // keep a smaller size
        }
        new_rows.push(row);
        next += 1;
    });

    CtSheetData { rows: new_rows }
}
