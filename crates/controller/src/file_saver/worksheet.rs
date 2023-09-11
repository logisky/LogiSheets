use std::vec;

use itertools::Itertools;
use logisheets_base::SheetId;
use logisheets_parser::unparse::Stringify;
use logisheets_workbook::{
    prelude::{
        Comments, CtAuthors, CtCell, CtCol, CtCols, CtComment, CtCommentList, CtFormula,
        CtMergeCell, CtMergeCells, CtRow, CtRst, CtSheet, CtSheetData, StCellFormulaType,
        StSheetState, WorksheetPart,
    },
    workbook::Worksheet,
};

use crate::{
    cell_attachments::CellAttachmentsManager,
    container::SheetDataContainer,
    file_saver::utils::{convert_string_to_plain_text_string, unparse_cell, SortedSet},
    formula_manager::FormulaManager,
    id_manager::SheetIdManager,
    settings::Settings,
    workbook::sheet_pos_manager::SheetPosManager,
};

use super::{error::SaveError, SaverTrait};

pub fn save_sheets<S: SaverTrait>(
    sheet_id: SheetId,
    sheet_data_container: &SheetDataContainer,
    formula_manager: &FormulaManager,
    attachment_manager: &CellAttachmentsManager,
    sheet_pos_manager: &SheetPosManager,
    sheet_name_manager: &SheetIdManager,
    settings: &Settings,
    saver: &mut S,
) -> Result<(usize, CtSheet, Worksheet), SaveError> {
    let pos = sheet_pos_manager
        .get_sheet_idx(&sheet_id)
        .ok_or(SaveError::SheetIdPosError(sheet_id))?;
    let worksheet = save_worksheet(
        sheet_id,
        sheet_data_container,
        formula_manager,
        attachment_manager,
        settings,
        saver,
    );
    let sheet_name = sheet_name_manager
        .get_string(&sheet_id)
        .ok_or(SaveError::SheetNameError(sheet_id))?;
    let id = saver.fetch_part_id();
    let is_hidden = sheet_pos_manager.is_hidden(&sheet_id);
    let ct_sheet = CtSheet {
        name: sheet_name,
        sheet_id: pos as u32,
        state: if is_hidden {
            StSheetState::Hidden
        } else {
            StSheetState::Visible
        },
        id,
    };
    Ok((pos, ct_sheet, worksheet))
}

fn save_worksheet<S: SaverTrait>(
    sheet_id: SheetId,
    sheet_data_container: &SheetDataContainer,
    formula_manager: &FormulaManager,
    attachment_manager: &CellAttachmentsManager,
    settings: &Settings,
    saver: &mut S,
) -> Worksheet {
    let worksheet_part = save_worksheet_part(
        sheet_id,
        sheet_data_container,
        formula_manager,
        attachment_manager,
        settings,
        saver,
    );
    let comments = save_comments(sheet_id, attachment_manager, saver);
    Worksheet {
        worksheet_part,
        comments,
    }
}

fn save_worksheet_part<S: SaverTrait>(
    sheet_id: SheetId,
    sheet_data_container: &SheetDataContainer,
    formula_manager: &FormulaManager,
    attachment_manager: &CellAttachmentsManager,
    settings: &Settings,
    saver: &mut S,
) -> WorksheetPart {
    let cols = save_cols(sheet_id, sheet_data_container, saver);
    let sheet_data = save_sheet_data(sheet_id, sheet_data_container, formula_manager, saver);
    let merge_cells = save_merge_cells(sheet_id, attachment_manager, saver);
    let sheet_format_pr = settings.sheet_format_pr.get(&sheet_id).map(|e| e.clone());
    let sheet_views = settings.sheet_views.get(&sheet_id).map(|e| e.clone());
    WorksheetPart {
        cols,
        sheet_data,
        sheet_pr: None,
        dimension: None,
        sheet_views,
        sheet_format_pr,
        sheet_calc_pr: None,
        sheet_protection: None,
        protected_ranges: None,
        scenarios: None,
        auto_filter: None,
        sort_state: None,
        data_consolidate: None,
        custom_sheet_views: None,
        merge_cells: merge_cells,
        phonetic_pr: None,
        conditional_formatting: vec![],
        data_validations: None,
        hyperlinks: None,
        print_options: None,
        page_margins: None,
        page_setup: None,
        header_footer: None,
        row_breaks: None,
        col_breaks: None,
        custom_properties: None,
        cell_watches: None,
        ignored_errors: None,
        smart_tags: None,
        drawing: None,
        drawing_hf: None,
        picture: None,
        controls: None,
        web_publish_items: None,
        table_parts: None,
    }
}

fn save_comments<S: SaverTrait>(
    sheet_id: SheetId,
    attachment_manager: &CellAttachmentsManager,
    saver: &mut S,
) -> Option<Comments> {
    let mut author_sorted_set: SortedSet<String> = SortedSet::new();
    let sheet_comments = attachment_manager
        .comments
        .data
        .get(&sheet_id)?
        .comments
        .iter()
        .map(|(cell_id, comment)| {
            let author_id = comment.author;
            let author = attachment_manager
                .comments
                .authors
                .get_string(&author_id)
                .unwrap_or_default();
            let author_id = author_sorted_set.insert(author) as u32;
            let comment_plain_text = convert_string_to_plain_text_string(comment.text.clone());
            let (row, col) = saver.fetch_cell_idx(&sheet_id, cell_id).unwrap();
            let reference = unparse_cell(row, col);
            CtComment {
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
                guid: Some(format!("{}", uuid::Uuid::new_v4())),
            }
        })
        .collect::<Vec<_>>();
    let authors = author_sorted_set
        .to_vec()
        .into_iter()
        .map(|e| convert_string_to_plain_text_string(e))
        .collect::<Vec<_>>();
    let comments = Comments {
        authors: CtAuthors { authors },
        comment_list: CtCommentList {
            comments: sheet_comments,
        },
    };

    Some(comments)
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
            let (r, c) = saver.fetch_cell_index(&sheet_id, &id).unwrap();
            let (v, t) = cell.value.to_ct_value();
            let f = formula_manager
                .formulas
                .get(&(sheet_id, id))
                .and_then(|node| {
                    let f = node.unparse(saver, sheet_id).unwrap();
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
                CtRow {
                    cells,
                    r: Some(row_idx as u32),
                    spans: None, // TODO: clearfy this one
                    s: row_info.style,
                    custom_format: row_info.custom_format,
                    ht: row_info.ht,
                    hidden: row_info.hidden,
                    custom_height: false,
                    outline_level: row_info.outline_level,
                    collapsed: row_info.collapsed,
                    thick_top: false,
                    thick_bot: false,
                    ph: false,
                }
            } else {
                CtRow {
                    cells,
                    r: Some(row_idx as u32),
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
    let mut next = 0;
    rows.into_iter().for_each(|mut row| {
        // safe to unwrap
        let r = row.r.unwrap();
        let mut skip = false;
        while next < r {
            let row_info = sheet_data_container.row_info.get_row_info(next);
            if let Some(info) = row_info {
                let i = CtRow {
                    cells: vec![],
                    r: None,
                    spans: None,
                    s: info.style,
                    custom_format: info.custom_format,
                    ht: info.ht,
                    hidden: info.hidden,
                    custom_height: info.custom_format,
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
