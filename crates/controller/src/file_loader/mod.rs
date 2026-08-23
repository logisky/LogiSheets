mod external_links;
mod sheet;
mod sst;
mod styles;
mod utils;
mod vertex;

use logisheets_base::id_fetcher::SheetIdFetcherTrait;
use logisheets_workbook::prelude::*;
use sheet::{load_comments, load_persons, load_threaded_comments};

use crate::{
    chart_manager::{Chart, ChartManager, ChartMarker},
    connectors::FormulaConnector,
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
    sid_assigner::ShadowIdAssigner,
    theme_manager::ThemeManager,
    utils::turn_indexed_color_to_rgb,
};
use logisheets_base::SheetId;
use std::sync::Arc;

use self::sheet::{load_preserved_parts, load_sheet_views};
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
        conditional_formatting_manager,
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
        dirty_cells_next_round: mut dirty_cells,
        mut block_schema_manager,
        mut field_render_manager,
        mut image_manager,
        mut chart_manager,
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

    // Everything in `workbook.xml` the controller has no opinion about, kept so
    // a save does not silently delete it. A defined name matters most of these:
    // a formula can reference one, so dropping it turns a working workbook into
    // one full of `#NAME?`.
    {
        let p = &wb.xl.workbook_part;
        settings.preserved_workbook = crate::settings::PreservedWorkbookParts {
            file_version: p.file_version.clone(),
            file_sharing: p.file_sharing.clone(),
            workbook_pr: p.workbook_pr.clone(),
            workbook_protection: p.workbook_protection.clone(),
            book_views: p.book_views.clone(),
            function_groups: p.function_groups.clone(),
            defined_names: p.defined_names.clone(),
            ole_size: p.ole_size.clone(),
            custom_workbook_views: p.custom_workbook_views.clone(),
            pivot_caches: p.pivot_caches.clone(),
            smart_tag_pr: p.smart_tag_pr.clone(),
            smart_tag_types: p.smart_tag_types.clone(),
            web_publishing: p.web_publishing.clone(),
            file_recovery_pr: p.file_recovery_pr.clone(),
        };
    }

    let Wb {
        xl,
        doc_props,
        logisheets,
    } = wb;
    // Authorship and timestamps arrived with the file; the saver used to write
    // `default()` over them.
    settings.doc_props = doc_props;

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
        // Links are restored AFTER all sheets' blocks load — a cross-sheet link's
        // target block may live on a sheet loaded later. Collect (source sheet,
        // link) here, resolve below.
        let mut pending_links: Vec<(SheetId, logisheets_workbook::logisheets::LinkRangeXml)> =
            vec![];
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
                    link_ranges,
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
                // Defer link restoration until every sheet's blocks exist.
                link_ranges
                    .into_iter()
                    .for_each(|lr| pending_links.push((sheet_id, lr)));
            });
        // All blocks on all sheets now exist — restore each link. The source range
        // is on its own sheet; the target block may be on another (`block_sheet_idx`).
        for (src_sheet, lr) in pending_links {
            let tgt_sheet = match sheet_info_manager.get_sheet_id(lr.block_sheet_idx) {
                Some(id) => id,
                None => continue,
            };
            let (rows, cols) = match navigator.get_block_size(&tgt_sheet, &lr.block_id) {
                Ok(v) => v,
                Err(_) => continue,
            };
            if rows == 0 || cols == 0 {
                continue;
            }
            if let (Ok(s0), Ok(s1), Ok(b0), Ok(b1)) = (
                navigator.fetch_norm_cell_id(&src_sheet, lr.start_row, lr.start_col),
                navigator.fetch_norm_cell_id(&src_sheet, lr.end_row, lr.end_col),
                navigator.fetch_block_cell_id(&tgt_sheet, &lr.block_id, 0, 0),
                navigator.fetch_block_cell_id(&tgt_sheet, &lr.block_id, rows - 1, cols - 1),
            ) {
                range_manager.add_link(
                    &src_sheet,
                    logisheets_base::NormalRange::AddrRange(s0, s1),
                    tgt_sheet,
                    logisheets_base::BlockRange::AddrRange(b0, b1),
                );
            }
        }
    }
    // `<dxfs>` is captured before the per-cell style walk: it is a flat,
    // position-indexed list (dxfId) that conditional formatting and table
    // styles reference, not something the xf walk can reach.
    style_manager.dxf_manager =
        crate::style_manager::dxf_manager::DxfManager::from_ct_dxfs(xl.styles.1.dxfs.as_ref());
    let mut style_loader = StyleLoader::new(&mut style_manager, &xl.styles.1);
    // Persons are workbook-scoped and referenced by threaded comments, so they
    // must be registered before any sheet's comments are loaded.
    if let Some(persons) = &xl.persons {
        load_persons(persons, &mut cell_attachment_manager);
    }
    // Structured tables (`<table>` parts) aren't modeled by the engine; we turn
    // each into a form block after the load finishes (see `convert_tables_to_blocks`).
    // Collect the conversion specs during the sheet walk, where the OOXML table
    // metadata is in scope.
    let mut pending_tables: Vec<TableConvertSpec> = Vec::new();
    // TODO: Here we should we `.into_iter()` to take the ownership logically
    // rather than call `.clone()` below.
    xl.workbook_part
        .sheets
        .sheets
        .iter()
        .enumerate()
        .for_each(|(sheet_idx, ct_sheet)| {
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
                    &mut dirty_cells,
                );
                if let Some(drawing) = &ws.drawing {
                    load_cell_images(
                        sheet_id,
                        drawing,
                        &xl.medias,
                        &navigator,
                        &mut image_manager,
                    );
                    load_charts(sheet_id, drawing, &navigator, &mut chart_manager);
                }
                // Excel data validation is stored verbatim per sheet for round-trip.
                if let Some(dv) = &ws.worksheet_part.data_validations {
                    data_validation_manager.set_sheet(sheet_id, dv.clone());
                }
                // Unmodeled worksheet parts (conditional formatting, hyperlinks,
                // filters, page setup, protection, ...) are preserved verbatim so
                // open→save doesn't drop them. `<tableParts>` is intentionally NOT
                // preserved: we convert every `<table>` into a block below and never
                // author a `tableN.xml`, so a retained reference would dangle.
                load_preserved_parts(&mut settings, sheet_id, &ws.worksheet_part, &ws.tables);
                // Queue each structured table for table→block conversion (done
                // after the load completes, once the container holds every cell).
                for tp in ws.tables.iter() {
                    if let Some(spec) = table_part_to_spec(sheet_idx, &tp.table) {
                        pending_tables.push(spec);
                    }
                }
            }
        });

    // Range→member-cell dependency edges aren't laid down during the
    // incremental load (`add_ast_node` records only the formula→range edge, and
    // a formula can reference cells that load later). Now that every cell and
    // range is registered, rebuild them so range formulas (e.g. `=SUM(A1:B2)`)
    // recompute when a member cell changes — mirroring the live input path.
    {
        let mut sid = ShadowIdAssigner::new();
        let connector = FormulaConnector {
            book_name: book_name.as_str(),
            sheet_pos_manager: &mut sheet_info_manager,
            sheet_id_manager: &mut sheet_id_manager,
            text_id_manager: &mut text_id_manager,
            func_id_manager: &mut func_id_manager,
            range_manager: &mut range_manager,
            cube_manager: &mut cube_manager,
            ext_ref_manager: &mut ext_ref_manager,
            name_id_manager: &mut name_id_manager,
            id_navigator: &navigator,
            idx_navigator: &navigator,
            external_links_manager: &mut external_links_manager,
            block_schema_manager: &block_schema_manager,
            container: &container,
            sid_assigner: &mut sid,
        };
        formula_manager.rebuild_range_deps(&connector);
    }

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
        chart_manager,
        data_validation_manager,
        conditional_formatting_manager,
    };
    if let Some(theme) = xl.theme {
        settings.theme = ThemeManager::from(theme.1);
    }
    let mut controller = Controller::from(status, book_name, settings, app_data);
    convert_tables_to_blocks(&mut controller, pending_tables);
    // Must run last: `sqref` is resolved against the navigator, and blocks only
    // exist once the table conversion above has run — a rule covering a
    // converted table has to anchor on block cell ids, not the normal cell ids
    // those coordinates had mid-load.
    model_conditional_formatting(&mut controller);
    controller
}

/// Move each sheet's `<conditionalFormatting>` out of the verbatim passthrough
/// and into the manager, resolving every `sqref` rectangle to the stable ids
/// that let it track row/column edits.
///
/// An element whose `sqref` resolves to nothing (malformed, or referring to a
/// sheet region that no longer exists) is left in `preserved_parts` so it still
/// round-trips as raw XML — modeling what we can must never lose what we can't.
fn model_conditional_formatting(controller: &mut Controller) {
    use crate::conditional_formatting_manager::{CfBlock, CfRule, resolve::resolve_sqref};

    let sheet_ids: Vec<_> = controller
        .settings
        .preserved_parts
        .keys()
        .cloned()
        .collect();
    for sheet_id in sheet_ids {
        let raw = match controller.settings.preserved_parts.get_mut(&sheet_id) {
            Some(p) if !p.conditional_formatting.is_empty() => {
                std::mem::take(&mut p.conditional_formatting)
            }
            _ => continue,
        };
        // Resolve first (immutable borrow of the navigator), then mint ids
        // (mutable borrow of the manager) — the two can't overlap.
        let mut resolved = Vec::new();
        let mut unmodeled = Vec::new();
        for cf in raw {
            let ranges = resolve_sqref(&controller.status.navigator, sheet_id, &cf.sqref);
            if ranges.is_empty() || cf.cf_rules.is_empty() {
                unmodeled.push(cf);
                continue;
            }
            resolved.push((ranges, cf.cf_rules, cf.pviot));
        }
        let manager = &mut controller.status.conditional_formatting_manager;
        let mut blocks = imbl::Vector::new();
        for (ranges, rules, pivot) in resolved {
            blocks.push_back(CfBlock {
                ranges,
                rules: rules
                    .into_iter()
                    .map(|rule| CfRule {
                        id: manager.mint_rule_id(),
                        rule,
                    })
                    .collect(),
                pivot,
            });
        }
        manager.set_sheet(sheet_id, blocks);
        if let Some(p) = controller.settings.preserved_parts.get_mut(&sheet_id) {
            p.conditional_formatting = unmodeled;
        }
    }
}

/// A structured OOXML table queued for conversion into a form block. Positions
/// are 0-based; the region already EXCLUDES the header row(s) (which supply the
/// field names) and any totals row(s).
struct TableConvertSpec {
    sheet_idx: usize,
    /// The table's `displayName`. Excel keeps these unique per workbook and
    /// identifier-shaped, so it makes a far better ref name than a serial
    /// number — `BLOCKREF("Sales","north","q1")` works on a file nobody
    /// prepared, which is the whole point of adopting the table at all.
    name: String,
    master_row: usize,
    master_col: usize,
    row_cnt: usize,
    col_cnt: usize,
    /// Field names, one per column, taken from the table's column headers
    /// (blank/missing names fall back to `Field N`).
    field_names: Vec<String>,
}

/// Turn one OOXML `<table>` into a conversion spec: parse its `ref` range, drop
/// the header and totals rows, and pull the column names. Returns `None` when
/// the table has no data rows or an unparseable reference.
fn table_part_to_spec(
    sheet_idx: usize,
    table: &logisheets_workbook::prelude::Table,
) -> Option<TableConvertSpec> {
    let rect = crate::data_validation_manager::parse_sqref(&table.reference)
        .into_iter()
        .next()?;
    // A whole-row/col ref (open bound) isn't a real table region.
    if rect.r1 == usize::MAX || rect.c1 == usize::MAX {
        return None;
    }
    let header = table.header_row_count as usize;
    let totals = table.totals_row_count as usize;
    let master_row = rect.r0 + header;
    if rect.r1 < master_row {
        return None;
    }
    let rows_incl_totals = rect.r1 - master_row + 1;
    if rows_incl_totals <= totals {
        return None; // header/totals only — nothing to record.
    }
    let row_cnt = rows_incl_totals - totals;
    let col_cnt = rect.c1 - rect.c0 + 1;
    if row_cnt == 0 || col_cnt == 0 {
        return None;
    }
    let mut field_names: Vec<String> = table
        .table_columns
        .table_column
        .iter()
        .map(|c| c.name.clone())
        .collect();
    field_names.resize(col_cnt, String::new());
    for (i, name) in field_names.iter_mut().enumerate() {
        if name.trim().is_empty() {
            *name = format!("Field {}", i + 1);
        }
    }
    Some(TableConvertSpec {
        sheet_idx,
        name: table.display_name.clone(),
        master_row,
        master_col: rect.c0,
        row_cnt,
        col_cnt,
        field_names,
    })
}

/// Realize each queued table as a form block: `ConvertBlock` keeps the region's
/// existing cell values while re-homing them into the block, then
/// `BindFormSchema` attaches a schema whose ref name is the table's own
/// `displayName` (or `unspecified-<blockId>` when that is missing or already
/// taken) and whose fields are the table's column headers (all "unspecified" type —
/// the host renders them as plain cells). A failure on one table is skipped so
/// the rest of the workbook still loads.
fn convert_tables_to_blocks(controller: &mut Controller, specs: Vec<TableConvertSpec>) {
    use crate::edit_action::{
        BindFormSchema, ConvertBlock, EditAction, EditPayload, PayloadsAction,
    };
    for spec in specs {
        let sheet_id = match controller
            .status
            .sheet_info_manager
            .get_sheet_id(spec.sheet_idx)
        {
            Some(id) => id,
            None => continue,
        };
        let block_id = match controller
            .status
            .navigator
            .get_available_block_id(&sheet_id)
        {
            Ok(id) => id,
            Err(_) => continue,
        };
        // Prefer the table's own name; fall back to the serial form when it is
        // empty or already taken (ref names address blocks, so they must be
        // unique).
        let taken = controller
            .status
            .block_schema_manager
            .refs
            .contains_key(&spec.name);
        let ref_name = if spec.name.trim().is_empty() || taken {
            format!("unspecified-{}", block_id)
        } else {
            spec.name.clone()
        };
        let render_ids: Vec<String> = (0..spec.col_cnt)
            .map(|c| format!("{}-{}", ref_name, c))
            .collect();
        let payloads = vec![
            EditPayload::ConvertBlock(ConvertBlock {
                sheet_idx: spec.sheet_idx,
                id: block_id,
                master_row: spec.master_row,
                master_col: spec.master_col,
                row_cnt: spec.row_cnt,
                col_cnt: spec.col_cnt,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name,
                sheet_idx: spec.sheet_idx,
                block_id,
                field_from: 0,
                key_idx: 0,
                fields: spec.field_names,
                render_ids,
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
        ];
        controller.handle_action(EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: false,
            init: false,
        }));
    }
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

/// Pull charts out of a worksheet drawing into the `ChartManager`. Chart
/// `graphicFrame` anchors are paired with CHART parts by document order (exact
/// for the common single-chart case; multiple charts rely on Excel emitting
/// anchors and parts in matching order). Each chart is anchored by the CellIds
/// of its from/to markers so it shifts with row/column edits.
fn load_charts(
    sheet_id: SheetId,
    drawing: &WorksheetDrawing,
    navigator: &Navigator,
    chart_manager: &mut ChartManager,
) {
    let chart_parts: Vec<&PassthroughPart> = drawing
        .chart_parts
        .iter()
        .filter(|p| p.rtype == logisheets_workbook::rtypes::CHART)
        .collect();
    if chart_parts.is_empty() {
        return;
    }
    let anchors: Vec<&CtTwoCellAnchor> = drawing
        .content
        .two_cell_anchors
        .iter()
        .filter(|a| a.graphic_frame.is_some())
        .collect();

    // The whole chart part tree (chart XML + style/color satellites) is kept
    // together for lossless save; shared across the sheet's charts for now.
    let raw = Arc::new(drawing.chart_parts.clone());

    for (i, part) in chart_parts.iter().enumerate() {
        let data = match parse_chart(&part.data) {
            Some(d) => d,
            None => continue,
        };
        let anchor = match anchors.get(i) {
            Some(a) => *a,
            None => continue,
        };
        // Access marker fields directly rather than naming the marker type:
        // `CtMarker` is ambiguous through the workbook prelude glob (both
        // `complex_types` and `drawing_part` export one), but the concrete
        // field access off the anchor is unambiguous.
        let from = match chart_marker(
            sheet_id,
            anchor.from.col.v,
            anchor.from.row.v,
            anchor.from.col_off.v,
            anchor.from.row_off.v,
            navigator,
        ) {
            Some(m) => m,
            None => continue,
        };
        let to = match chart_marker(
            sheet_id,
            anchor.to.col.v,
            anchor.to.row.v,
            anchor.to.col_off.v,
            anchor.to.row_off.v,
            navigator,
        ) {
            Some(m) => m,
            None => continue,
        };
        let id = part
            .path
            .rsplit('/')
            .next()
            .and_then(|f| f.strip_suffix(".xml"))
            .unwrap_or("chart")
            .to_string();
        chart_manager.add(
            sheet_id,
            Chart {
                id,
                from,
                to,
                part_path: part.path.clone(),
                data,
                raw: raw.clone(),
            },
        );
    }
}

fn chart_marker(
    sheet_id: SheetId,
    col: i32,
    row: i32,
    col_off: i64,
    row_off: i64,
    navigator: &Navigator,
) -> Option<ChartMarker> {
    if col < 0 || row < 0 {
        return None;
    }
    let cell = navigator
        .fetch_cell_id(&sheet_id, row as usize, col as usize)
        .ok()?;
    Some(ChartMarker {
        cell,
        col_off,
        row_off,
    })
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
