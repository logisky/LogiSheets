use logisheets_rs::ErrorMessage;
use logisheets_rs::rpc::{Message, controller, ws};
use wasm_bindgen::prelude::*;

use crate::state;

// ============================================================================
// Serialization edge. The logic functions in `controller`/`ws` return typed
// Rust values (`Result<T, ErrorMessage>` or `T`); these adapters serialize them
// for the browser (`JsValue`). A native transport (Tauri) provides its own
// equivalents while calling the exact same logic functions.
// ============================================================================

fn ok_to_js<T: serde::Serialize>(v: &T) -> JsValue {
    serde_wasm_bindgen::to_value(v).unwrap()
}

fn res_to_js<T: serde::Serialize>(r: Result<T, ErrorMessage>) -> JsValue {
    match r {
        // Preserve the historical wire format: on success the value is emitted
        // bare, on failure the `ErrorMessage` is emitted bare (NOT a tagged
        // `Result`). The JS SDK distinguishes them by shape.
        Ok(v) => serde_wasm_bindgen::to_value(&v).unwrap(),
        Err(e) => serde_wasm_bindgen::to_value(&e).unwrap(),
    }
}

#[wasm_bindgen]
pub fn handle(msg: JsValue, book_id: Option<usize>) -> JsValue {
    state::init();
    // A malformed or unknown message must NOT panic. A panic here poisons the
    // whole wasm instance — every subsequent call traps with `unreachable`, so
    // one bad request from a client would take the engine down for good. Return
    // a bare `ErrorMessage` instead (the same wire shape the logic functions use
    // on failure; the JS SDK distinguishes success/error by shape).
    let msg: Message = match serde_wasm_bindgen::from_value(msg) {
        Ok(m) => m,
        Err(e) => {
            return res_to_js::<()>(Err(ErrorMessage {
                msg: format!("invalid request message: {e}"),
                ty: 6,
            }));
        }
    };

    // Handle messages that don't require a book_id
    if let Message::NewWorkbook = &msg {
        let mut mgr = state::MANAGER.get_mut();
        return ok_to_js(&controller::new_workbook(&mut mgr));
    }

    // Every remaining message needs a book id; a missing one is a client error,
    // not a reason to panic.
    let id = match book_id {
        Some(id) => id,
        None => {
            return res_to_js::<()>(Err(ErrorMessage {
                msg: "missing book id".to_string(),
                ty: 6,
            }));
        }
    };
    let mut mgr = state::MANAGER.get_mut();
    match msg {
        Message::NewWorkbook => unreachable!(),
        Message::GetSheetDimension(params) => {
            res_to_js(ws::get_sheet_dimension(&mgr, id, params.sheet_id))
        }
        Message::GetDependents(params) => res_to_js(ws::get_dependents(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::GetPrecedents(params) => res_to_js(ws::get_precedents(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetDisplayWindow(params) => res_to_js(ws::get_display_window(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.end_row,
            params.start_col,
            params.end_col,
        )),
        Message::GetCell(params) => res_to_js(ws::get_cell_info(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetCellListValidation(params) => ok_to_js(&ws::get_cell_list_validation(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetValue(params) => res_to_js(ws::get_value(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetFormula(params) => res_to_js(ws::get_formula(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetStyle(params) => res_to_js(ws::get_style(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetCells(params) => res_to_js(ws::get_cell_infos(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::PredictFill(params) => res_to_js(ws::predict_fill(
            &mgr,
            id,
            params.sheet_idx,
            params.src_start_row,
            params.src_start_col,
            params.src_end_row,
            params.src_end_col,
            params.dst_start_row,
            params.dst_start_col,
            params.dst_end_row,
            params.dst_end_col,
        )),
        Message::GetCellsExceptWindow(params) => res_to_js(ws::get_cell_infos_except_window(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
            params.window_start_row,
            params.window_start_col,
            params.window_end_row,
            params.window_end_col,
        )),
        Message::GetReproducibleCells(params) => res_to_js(ws::get_reproducible_cells(
            &mgr,
            id,
            params.sheet_idx,
            params.coordinates,
        )),
        Message::GetReproducibleCell(params) => res_to_js(ws::get_reproducible_cell(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetCellPosition(params) => res_to_js(ws::get_cell_position(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetRowHeight(params) => {
            res_to_js(ws::get_row_height(&mgr, id, params.sheet_id, params.row_idx))
        }
        Message::GetColWidth(params) => {
            res_to_js(ws::get_col_width(&mgr, id, params.sheet_id, params.col_idx))
        }
        Message::HandleTransaction(params) => {
            let effect = controller::handle_transaction(&mut mgr, id, params.transaction);
            // The reason now travels on the effect itself (`error_message`), so
            // every host gets it. Still mirror it to the browser console, where
            // it is the thing a developer actually reads, and drain
            // `take_last_error` either way so a rejection can't leak into the
            // next transaction's report.
            if let logisheets_rs::StatusCode::Err(_) = effect.status {
                let msg = effect
                    .error_message
                    .clone()
                    .or_else(logisheets_rs::take_last_error);
                if let Some(msg) = msg {
                    web_sys::console::error_1(
                        &format!("[handle_transaction] engine error: {}", msg).into(),
                    );
                }
            } else {
                let _ = logisheets_rs::take_last_error();
            }
            ok_to_js(&effect)
        }
        Message::ToggleStatus(params) => {
            controller::toggle_status(&mut mgr, id, params.use_temp);
            JsValue::NULL
        }
        Message::BatchGetCellInfoById(params) => {
            res_to_js(controller::batch_get_cell_info_by_id(&mut mgr, id, params.ids))
        }
        Message::BatchGetCellCoordinateWithSheetById(params) => res_to_js(
            controller::batch_get_cell_coordinate_with_sheet_by_id(&mut mgr, id, params.ids),
        ),
        Message::GetSheetNameByIdx(params) => {
            res_to_js(controller::get_sheet_name_by_idx(&mut mgr, id, params.idx))
        }
        Message::LoadWorkbook(params) => {
            ok_to_js(&controller::read_file(&mut mgr, id, params.name, &params.content))
        }
        Message::SaveWorkbook(params) => {
            ok_to_js(&controller::save_file(
                &mut mgr,
                id,
                params.app_data,
                params.resolve_block_refs.unwrap_or(false),
            ))
        }
        Message::GetCellId(params) => res_to_js(controller::get_cell_id(
            &mut mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
        )),
        Message::GetMergedCells(params) => ok_to_js(&ws::get_merged_cells(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::GetComments(params) => ok_to_js(&ws::get_comments(&mgr, id, params.sheet_idx)),
        Message::GetCellImages(params) => {
            ok_to_js(&ws::get_cell_images(&mgr, id, params.sheet_idx))
        }
        Message::GetCharts(params) => ok_to_js(&ws::get_charts(&mgr, id, params.sheet_idx)),
        Message::GetConditionalFormattingRules(params) => ok_to_js(
            &ws::get_conditional_formatting_rules(&mgr, id, params.sheet_idx),
        ),
        Message::CalcCondition(params) => res_to_js(controller::calc_condition(
            &mut mgr,
            id,
            params.sheet_idx,
            params.condition,
        )),
        Message::GetCellIdByBlockRef(params) => res_to_js(controller::get_cell_id_by_block_ref(
            &mgr,
            id,
            params.ref_name,
            params.key,
            params.field,
        )),
        Message::ExportBlockData(params) => res_to_js(controller::export_block_data(
            &mgr,
            id,
            params.ref_name,
            params.key_filter,
            params.field_filter,
        )),
        Message::GetTempStatusChanges => res_to_js(controller::get_temp_status_changes(&mgr, id)),
        Message::GetBlockDisplayWindow(params) => res_to_js(
            controller::get_display_window_for_block(&mut mgr, id, params.sheet_id, params.block_id),
        ),
        Message::GetBlockRowId(params) => res_to_js(controller::get_block_row_id(
            &mut mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.row_idx,
        )),
        Message::GetBlockColId(params) => res_to_js(controller::get_block_col_id(
            &mut mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.col_idx,
        )),
        Message::GetSheetIdx(params) => {
            res_to_js(controller::get_sheet_idx(&mgr, id, params.sheet_id))
        }
        Message::GetSheetId(params) => {
            res_to_js(controller::get_sheet_id(&mut mgr, id, params.sheet_idx))
        }
        Message::GetBlockValues(params) => res_to_js(controller::get_block_values(
            &mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.row_ids,
            params.col_ids,
        )),
        Message::GetBlockSortOrder(params) => res_to_js(controller::get_block_sort_order(
            &mgr,
            id,
            params.sheet_idx,
            params.block_id,
            params.field,
            params.asc,
        )),
        Message::GetShadowCellId(params) => res_to_js(controller::get_shadow_cell_id(
            &mut mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.kind.unwrap_or_default(),
        )),
        Message::GetShadowCellIds(params) => res_to_js(controller::get_shadow_cell_ids(
            &mut mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.kind.unwrap_or_default(),
        )),
        Message::GetShadowInfoById(params) => {
            res_to_js(controller::get_shadow_info_by_id(&mut mgr, id, params.shadow_id))
        }
        Message::GetDiyCellIdWithBlockId(params) => ok_to_js(&ws::get_diy_cell_id_with_block_id(
            &mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.row,
            params.col,
        )),
        Message::LookupAppendixUpward(params) => res_to_js(ws::lookup_appendix_upward(
            &mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.row,
            params.col,
            params.craft_id,
            params.tag,
        )),
        Message::GetNextVisibleCell(params) => res_to_js(ws::get_next_visible_cell(
            &mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.direction,
        )),
        Message::GetDataBoundary(params) => res_to_js(ws::get_data_boundary(
            &mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.direction,
        )),
        Message::GetDisplayUnitsOfFormula(params) => {
            res_to_js(controller::get_display_units_of_formula(&params.formula))
        }
        Message::GetRowInfo(params) => {
            res_to_js(controller::get_row_info(&mgr, id, params.sheet_idx, params.row_idx))
        }
        Message::GetAvailableBlockId(params) => {
            res_to_js(controller::get_available_block_id(&mut mgr, id, params.sheet_idx))
        }
        Message::CheckFormula(params) => {
            ok_to_js(&controller::check_formula(&mgr, id, params.formula))
        }
        Message::GetBlockInfo(params) => res_to_js(ws::get_block_info(
            &mgr,
            id,
            params.sheet_id,
            params.block_id as usize,
        )),
        Message::GetCellInfos(params) => res_to_js(ws::get_cell_infos(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::Undo => ok_to_js(&controller::undo(&mut mgr, id)),
        Message::Redo => ok_to_js(&controller::redo(&mut mgr, id)),
        Message::CleanHistory => {
            controller::clean_history(&mut mgr, id);
            JsValue::NULL
        }
        Message::GetAllBlockFields => res_to_js(controller::get_all_block_fields(&mut mgr, id)),
        Message::Release => {
            controller::release(&mut mgr, id);
            JsValue::NULL
        }
        Message::GetSheetCount => ok_to_js(&controller::get_sheet_count(&mgr, id)),
        Message::GetVersion => ok_to_js(&controller::get_version(&mgr, id)),
        Message::GetAllSheetInfo => ok_to_js(&controller::get_all_sheet_info(&mgr, id)),
        Message::GetFormulaFunctionNames => {
            ok_to_js(&controller::get_formula_function_names(&mgr, id))
        }
        Message::GetAppData => ok_to_js(&controller::get_app_data(&mgr, id)),
        Message::CleanTempStatus => {
            controller::clean_temp_status(&mut mgr, id);
            JsValue::NULL
        }
        Message::CommitTempStatus => ok_to_js(&controller::commit_temp_status(&mut mgr, id)),
        Message::CheckBindBlock(params) => ok_to_js(&controller::check_bind_block(
            &mut mgr,
            id,
            params.sheet_idx,
            params.block_id,
            params.row_count,
            params.col_count,
        )),
        Message::GetDisplayWindowWithStartPoint(params) => {
            res_to_js(ws::get_display_window_with_start_point(
                &mgr,
                id,
                params.sheet_idx,
                params.start_x,
                params.start_y,
                params.height,
                params.width,
            ))
        }
        Message::GetDisplayWindowWithinCell(params) => {
            res_to_js(ws::get_display_window_within_cell(
                &mgr,
                id,
                params.sheet_idx,
                params.row,
                params.col,
                params.height,
                params.width,
            ))
        }
        Message::GetColInfo(params) => {
            res_to_js(ws::get_col_info(&mgr, id, params.sheet_idx, params.col_idx))
        }
        Message::GetFullyCoveredBlocks(params) => res_to_js(ws::get_all_fully_covered_blocks(
            &mgr,
            id,
            params.sheet_id,
            params.row,
            params.col,
            params.row_cnt,
            params.col_cnt,
        )),
        Message::GetAllBlocks(params) => {
            res_to_js(ws::get_all_blocks(&mgr, id, params.sheet_idx, params.sheet_id))
        }
        Message::GetLinkableBlocks(params) => {
            res_to_js(ws::get_linkable_blocks(&mgr, id, params.sheet_idx, params.col_cnt))
        }
        Message::GetLinks(params) => res_to_js(ws::get_links(&mgr, id, params.sheet_idx)),
        Message::SaveCheckpoint(params) => ok_to_js(&ws::save_checkpoint(
            &mut mgr,
            id,
            params.label,
            params.description,
        )),
        Message::DeleteCheckpoint(params) => {
            ok_to_js(&ws::delete_checkpoint(&mut mgr, id, params.label))
        }
        Message::ListCheckpoints => ok_to_js(&ws::list_checkpoints(&mgr, id)),
    }
}
