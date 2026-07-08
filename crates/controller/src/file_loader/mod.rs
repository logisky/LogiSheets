mod external_links;
mod fetcher;
mod sheet;
mod sst;
mod styles;
mod utils;
mod vertex;

use logisheets_base::id_fetcher::SheetIdFetcherTrait;
use logisheets_workbook::prelude::*;
use sheet::{load_comments, load_persons, load_threaded_comments};

use crate::{
    controller::{Controller, status::Status},
    file_loader::{
        external_links::load_external_link,
        sheet::{load_cols, load_merge_cells, load_sheet_data, load_sheet_format_pr},
        styles::StyleLoader,
    },
    id_manager::SheetIdManager,
    image_manager::{CellImage, ImageManager},
    navigator::{BlockPlace, Navigator},
    settings::Settings,
    theme_manager::ThemeManager,
    utils::turn_indexed_color_to_rgb,
};
use logisheets_base::SheetId;
use std::sync::Arc;

use self::sheet::load_sheet_views;
pub struct SheetIdFetcher<'a> {
    pub sheet_id_manager: &'a mut SheetIdManager,
}

impl<'a> SheetIdFetcherTrait for SheetIdFetcher<'a> {
    fn fetch_sheet_id(&mut self, sheet_name: &str) -> logisheets_base::SheetId {
        self.sheet_id_manager.get_or_register_id(sheet_name)
    }
}

pub fn load_file(wb: Wb, book_name: String) -> Controller {
    let Status {
        mut navigator,
        mut container,
        mut sheet_id_manager,
        mut func_id_manager,
        mut text_id_manager,
        mut name_id_manager,
        mut external_links_manager,
        mut sheet_info_manager,
        mut style_manager,
        mut cell_attachment_manager,
        mut formula_manager,
        mut range_manager,
        mut cube_manager,
        mut ext_ref_manager,
        exclusive_manager,
        dirty_cells_next_round: dirty_cells,
        mut block_schema_manager,
        mut field_render_manager,
        mut image_manager,
        mut data_validation_manager,
    } = Status::default();
    let mut sheet_id_fetcher = SheetIdFetcher {
        sheet_id_manager: &mut sheet_id_manager,
    };
    if let Some(ers) = &wb.xl.workbook_part.external_references {
        ers.external_references.iter().for_each(|er| {
            let id = &er.id;
            if let Some(link) = wb.xl.external_links.get(id) {
                load_external_link(&mut external_links_manager, link, &mut sheet_id_fetcher);
            }
        })
    }
    let mut settings = Settings::default();
    if let Some(calc_pr) = &wb.xl.workbook_part.calc_pr {
        settings.calc_config.iter_limit = calc_pr.iterate_count as u16;
        settings.calc_config.error = calc_pr.iterate_delta as f32;
    }

    let Wb {
        xl,
        doc_props: _,
        logisheets,
    } = wb;

    // Register sheet names and their positions first
    xl.workbook_part.sheets.sheets.iter().for_each(|ct_sheet| {
        let sheet_name = &ct_sheet.name;
        let sheet_id = sheet_id_manager.get_or_register_id(sheet_name);
        navigator.add_sheet_id(&sheet_id);
        sheet_info_manager.pos.push_back(sheet_id);
        if ct_sheet.state != StSheetState::Visible {
            sheet_info_manager.hiddens.insert(sheet_id);
        }
    });
    let mut app_data = vec![];

    if let Some(logisheets) = logisheets {
        app_data = logisheets.apps;
        // Restore the workbook-wide FieldRenderManager (per-renderId
        // style + diy_render flags) before walking sheets, so cell load
        // and any downstream display calls see the populated formatters.
        // `numFmt` strings are replayed through `style_manager` to mint
        // fresh, valid style ids — the xlsx-side style table renumbers
        // entries on load, so the originally-saved StyleId wouldn't be
        // safe to reuse.
        crate::block_manager::field_manager::persistence::load_field_renders(
            &mut field_render_manager,
            &mut style_manager,
            logisheets.field_renders,
        );
        logisheets
            .sheets
            .into_iter()
            .enumerate()
            .for_each(|(idx, sheet_data)| {
                let logisheets_workbook::logisheets::Sheet {
                    block_ranges,
                    cell_appendices: _,
                    row_schemas,
                    col_schemas,
                    random_schemas,
                } = sheet_data;
                let sheet_id = sheet_info_manager.get_sheet_id(idx).unwrap();
                navigator.add_sheet_id(&sheet_id);
                // Restore schemas first so any downstream cell load that
                // queries `block_schema_manager` (e.g. for resolving block
                // ref names) sees the populated state.
                crate::block_manager::schema_manager::persistence::load_schemas_for_sheet(
                    &mut block_schema_manager,
                    sheet_id,
                    row_schemas,
                    col_schemas,
                    random_schemas,
                );
                block_ranges.into_iter().for_each(|block_range| {
                    let block_id = block_range.block_id;
                    let master_row = block_range.start_row;
                    let master_col = block_range.start_col;
                    let master_cell_id = navigator
                        .fetch_norm_cell_id(&sheet_id, master_row, master_col)
                        .unwrap();
                    let owner = block_range.owner.clone().unwrap_or_default();
                    let modify_policy = block_range
                        .modify_policy
                        .as_deref()
                        .map(crate::edit_action::ModifyPolicy::from_wire_str)
                        .unwrap_or_default();
                    let block_place = BlockPlace::new(
                        master_cell_id,
                        block_range.row_cnt as u32,
                        block_range.col_cnt as u32,
                        owner,
                        modify_policy,
                    );
                    let sheet_container = container.get_sheet_container_mut(sheet_id);
                    let row_infos = block_range.row_infos;
                    if row_infos.len() > 0 {
                        block_place.rows.iter().zip(row_infos.into_iter()).for_each(
                            |(row_id, info)| {
                                sheet_container
                                    .block_line_info_manager
                                    .row_manager
                                    .set_info(block_id, *row_id, info.into());
                            },
                        );
                    }
                    let col_infos = block_range.col_infos;
                    if col_infos.len() > 0 {
                        block_place.cols.iter().zip(col_infos.into_iter()).for_each(
                            |(col_id, info)| {
                                sheet_container
                                    .block_line_info_manager
                                    .col_manager
                                    .set_info(block_id, *col_id, info.into());
                            },
                        );
                    }
                    let sheet_nav = navigator.sheet_navs.get_mut(&sheet_id).unwrap();
                    sheet_nav.data.blocks.insert(block_id, block_place);
                });
            });
    }
    let mut style_loader = StyleLoader::new(&mut style_manager, &xl.styles.1);
    // Persons are workbook-scoped and referenced by threaded comments, so they
    // must be registered before any sheet's comments are loaded.
    if let Some(persons) = &xl.persons {
        load_persons(persons, &mut cell_attachment_manager);
    }
    // TODO: Here we should we `.into_iter()` to take the ownership logically
    // rather than call `.clone()` below.
    xl.workbook_part.sheets.sheets.iter().for_each(|ct_sheet| {
        let sheet_name = &ct_sheet.name;
        let sheet_id = sheet_id_manager.get_or_register_id(sheet_name);
        let id = &ct_sheet.id;
        if let Some(ws) = xl.worksheets.get(id) {
            // Threaded comments are the source of truth; fall back to the
            // legacy `commentsN.xml` only when no threaded part exists.
            if let Some(threaded) = &ws.threaded_comments {
                load_threaded_comments(
                    sheet_id,
                    threaded,
                    &mut navigator,
                    &mut cell_attachment_manager,
                );
            } else if let Some(comments) = &ws.comments {
                load_comments(
                    sheet_id,
                    comments,
                    &mut navigator,
                    &mut cell_attachment_manager,
                );
            }
            if let Some(cols) = &ws.worksheet_part.cols {
                load_cols(
                    sheet_id,
                    &cols.cols,
                    &mut container,
                    &mut style_loader,
                    &mut navigator,
                )
            }
            if let Some(merge_cells) = &ws.worksheet_part.merge_cells {
                load_merge_cells(
                    sheet_id,
                    merge_cells,
                    &mut navigator,
                    &mut cell_attachment_manager,
                )
            }
            if let Some(sheet_format_pr) = &ws.worksheet_part.sheet_format_pr {
                load_sheet_format_pr(&mut settings, sheet_id, sheet_format_pr)
            }
            if let Some(sheet_views) = &ws.worksheet_part.sheet_views {
                load_sheet_views(&mut settings, sheet_id, sheet_views);
            }
            if let Some(sheet_pr) = &ws.worksheet_part.sheet_pr {
                load_sheet_pr(&mut sheet_info_manager, sheet_id, sheet_pr);
            }
            load_sheet_data(
                sheet_id,
                &book_name,
                &ws.worksheet_part.sheet_data,
                &mut navigator,
                &mut sheet_id_manager,
                &mut sheet_info_manager,
                &mut text_id_manager,
                &mut func_id_manager,
                &mut name_id_manager,
                &mut external_links_manager,
                &mut container,
                &mut formula_manager,
                &mut range_manager,
                &mut cube_manager,
                &mut ext_ref_manager,
                &block_schema_manager,
                &mut style_loader,
                &xl,
            );
            if let Some(drawing) = &ws.drawing {
                load_cell_images(
                    sheet_id,
                    drawing,
                    &xl.medias,
                    &navigator,
                    &mut image_manager,
                );
            }
            // Excel data validation is stored verbatim per sheet for round-trip.
            if let Some(dv) = &ws.worksheet_part.data_validations {
                data_validation_manager.set_sheet(sheet_id, dv.clone());
            }
        }
    });
    let status = Status {
        navigator,
        formula_manager,
        container,
        sheet_id_manager,
        func_id_manager,
        text_id_manager,
        name_id_manager,
        external_links_manager,
        sheet_info_manager,
        style_manager,
        cell_attachment_manager,
        dirty_cells_next_round: dirty_cells,
        range_manager,
        cube_manager,
        ext_ref_manager,
        exclusive_manager,
        block_schema_manager,
        field_render_manager,
        image_manager,
        data_validation_manager,
    };
    if let Some(theme) = xl.theme {
        settings.theme = ThemeManager::from(theme.1);
    }
    Controller::from(status, book_name, settings, app_data)
}

/// Pull cell images out of a worksheet drawing part into the `ImageManager`.
/// Each `twoCellAnchor` picture is resolved through the drawing's rels to a
/// media file, and anchored to the `CellId` of its `from` marker so it moves
/// with the cell.
fn load_cell_images(
    sheet_id: SheetId,
    drawing: &WorksheetDrawing,
    medias: &[Media],
    navigator: &Navigator,
    image_manager: &mut ImageManager,
) {
    for anchor in drawing.content.two_cell_anchors.iter() {
        let (col, row) = anchor.anchor_cell();
        if col < 0 || row < 0 {
            continue;
        }
        let embed = match anchor.embed_rid() {
            Some(e) => e,
            None => continue,
        };
        let media_name = match drawing.media_name_of(embed) {
            Some(n) => n,
            None => continue,
        };
        let media = match medias.iter().find(|m| m.name == media_name) {
            Some(m) => m,
            None => continue,
        };
        let (id, format) = match media_name.rsplit_once('.') {
            Some((base, ext)) => (base.to_string(), ext.to_ascii_lowercase()),
            None => (media_name.clone(), String::from("png")),
        };
        if let Ok(cell_id) = navigator.fetch_cell_id(&sheet_id, row as usize, col as usize) {
            image_manager.insert(
                sheet_id,
                cell_id,
                CellImage {
                    id,
                    format,
                    data: Arc::new(media.data.clone()),
                },
            );
        }
    }
}

fn load_sheet_pr(
    sheet_info_manager: &mut crate::workbook::sheet_info_manager::SheetInfoManager,
    sheet_id: u16,
    sheet_pr: &CtSheetPr,
) {
    let color = &sheet_pr.tab_color;
    if let Some(color) = color {
        if let Some(rgb) = &color.rgb {
            sheet_info_manager.colors.insert(sheet_id, rgb.clone());
        }
        if let Some(index) = color.indexed {
            let rgb = turn_indexed_color_to_rgb(index);
            sheet_info_manager.colors.insert(sheet_id, rgb);
        }
    }
}
