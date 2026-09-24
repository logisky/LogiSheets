use logisheets_rs::ErrorMessage;
use logisheets_rs::rpc::{CLIENT_ERROR, Message, controller, ws};
use wasm_bindgen::prelude::*;

use crate::state;

// Serialization edge: `controller`/`ws` return typed Rust values, these
// adapters serialize them for the browser. A native transport (Tauri) has its
// own equivalents over the same logic functions.
//
// Nothing here may panic — a panic poisons the wasm instance, and every later
// call traps. Every failure leaves as an `ErrorMessage`.

// Every RPC result is plain data and serializes, with one exception:
// serde_wasm_bindgen (without the bigint option) refuses a u64/i64 beyond
// 2^53. That must not panic, so it is reported as an `ErrorMessage` instead —
// which itself is a string and a small integer and always serializes.
pub(crate) fn ok_to_js<T: serde::Serialize>(v: &T) -> JsValue {
    serde_wasm_bindgen::to_value(v).unwrap_or_else(serialize_failed)
}

pub(crate) fn res_to_js<T: serde::Serialize>(r: Result<T, ErrorMessage>) -> JsValue {
    // Untagged wire format: both are emitted bare, and the JS SDK tells them
    // apart by shape (`isErrorMessage`).
    match r {
        Ok(v) => ok_to_js(&v),
        Err(e) => ok_to_js(&e),
    }
}

fn serialize_failed(e: serde_wasm_bindgen::Error) -> JsValue {
    let msg = ErrorMessage {
        msg: format!("the result could not be sent to JavaScript: {e}"),
        // `Error::Serde`'s code.
        ty: 2,
    };
    serde_wasm_bindgen::to_value(&msg).unwrap_or(JsValue::NULL)
}

pub(crate) fn client_error<T: serde::Serialize>(msg: String) -> JsValue {
    res_to_js::<T>(Err(ErrorMessage {
        msg,
        ty: CLIENT_ERROR,
    }))
}

/// The `method` an unparseable request claimed, so a rejection can name it.
/// A unit variant arrives as a bare string, everything else as `{method, value}`.
fn requested_method(msg: &JsValue) -> String {
    if let Some(name) = msg.as_string() {
        return name;
    }
    js_sys::Reflect::get(msg, &JsValue::from_str("method"))
        .ok()
        .and_then(|m| m.as_string())
        .unwrap_or_else(|| "<no method field>".to_string())
}

/// The single RPC entry point. `msg` is a [`Message`] as JS (a bare method
/// name for a unit variant, otherwise `{method, value}`); `book_id` names the
/// workbook and is required by everything except `newWorkbook`, which returns
/// the id to use. Answers the method's result or an `ErrorMessage`, told apart
/// by shape on the JS side.
#[wasm_bindgen]
pub fn handle(msg: JsValue, book_id: Option<usize>) -> JsValue {
    state::init();
    let msg: Message = match serde_wasm_bindgen::from_value(msg.clone()) {
        Ok(m) => m,
        Err(e) => {
            return client_error::<()>(format!(
                "no RPC method {:?} takes these params: {e}",
                requested_method(&msg)
            ));
        }
    };

    // `newWorkbook` mints the book id, so it is the one message without one.
    let mut mgr = state::MANAGER.get_mut();
    if let Message::NewWorkbook = &msg {
        return ok_to_js(&controller::new_workbook(&mut mgr));
    }

    let id = match book_id {
        Some(id) => id,
        None => {
            return client_error::<()>(
                "this request needs a book id; call newWorkbook first and pass the id it returns"
                    .to_string(),
            );
        }
    };
    match msg {
        Message::NewWorkbook => ok_to_js(&controller::new_workbook(&mut mgr)),
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
        Message::GetCellListValidation(params) => res_to_js(ws::get_cell_list_validation(
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
        Message::GetRowHeight(params) => res_to_js(ws::get_row_height(
            &mgr,
            id,
            params.sheet_id,
            params.row_idx,
        )),
        Message::GetColWidth(params) => {
            res_to_js(ws::get_col_width(&mgr, id, params.sheet_id, params.col_idx))
        }
        Message::HandleTransaction(params) => {
            let result = controller::handle_transaction(&mut mgr, id, params.transaction);
            // The reason already travels on the effect, so every host gets it;
            // mirror it to the console for whoever is watching. Drain
            // `take_last_error` either way so it cannot leak into the next
            // transaction's report.
            let reason = match &result {
                Ok(effect) if matches!(effect.status, logisheets_rs::StatusCode::Err(_)) => effect
                    .error_message
                    .clone()
                    .or_else(logisheets_rs::take_last_error),
                Ok(_) => {
                    let _ = logisheets_rs::take_last_error();
                    None
                }
                Err(e) => {
                    let _ = logisheets_rs::take_last_error();
                    Some(e.msg.clone())
                }
            };
            if let Some(reason) = reason {
                web_sys::console::error_1(&format!("[handleTransaction] {reason}").into());
            }
            res_to_js(result)
        }
        Message::ToggleStatus(params) => {
            res_to_js(controller::toggle_status(&mut mgr, id, params.use_temp))
        }
        Message::BatchGetCellInfoById(params) => res_to_js(controller::batch_get_cell_info_by_id(
            &mut mgr, id, params.ids,
        )),
        Message::BatchGetCellCoordinateWithSheetById(params) => res_to_js(
            controller::batch_get_cell_coordinate_with_sheet_by_id(&mut mgr, id, params.ids),
        ),
        Message::GetSheetNameByIdx(params) => {
            res_to_js(controller::get_sheet_name_by_idx(&mut mgr, id, params.idx))
        }
        Message::LoadWorkbook(params) => res_to_js(controller::read_file(
            &mut mgr,
            id,
            params.name,
            &params.content,
        )),
        Message::SaveWorkbook(params) => res_to_js(controller::save_file(
            &mut mgr,
            id,
            params.app_data,
            params.resolve_block_refs.unwrap_or(false),
        )),
        Message::GetCellId(params) => res_to_js(controller::get_cell_id(
            &mut mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
        )),
        Message::GetMergedCells(params) => res_to_js(ws::get_merged_cells(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::GetComments(params) => res_to_js(ws::get_comments(&mgr, id, params.sheet_idx)),
        Message::GetCellImages(params) => {
            res_to_js(ws::get_cell_images(&mgr, id, params.sheet_idx))
        }
        Message::GetCharts(params) => res_to_js(ws::get_charts(&mgr, id, params.sheet_idx)),
        Message::GetConditionalFormattingRules(params) => res_to_js(
            ws::get_conditional_formatting_rules(&mgr, id, params.sheet_idx),
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
        Message::IsInTempMode => res_to_js(controller::is_in_temp_mode(&mgr, id)),
        Message::GetBlockDisplayWindow(params) => {
            res_to_js(controller::get_display_window_for_block(
                &mut mgr,
                id,
                params.sheet_id,
                params.block_id,
            ))
        }
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
        Message::PivotPlan(params) => res_to_js(controller::pivot_plan(
            &mgr,
            id,
            params.sheet_idx,
            params.block_id,
        )),
        Message::PivotExcelNote(params) => res_to_js(controller::pivot_excel_note(
            &mgr,
            id,
            params.sheet_idx,
            params.block_id,
        )),
        Message::PivotPlanFor(params) => res_to_js(controller::pivot_plan_for(
            &mgr,
            id,
            params.sheet_idx,
            params.source_block,
            params.spec,
        )),
        Message::MayModifyBlock(params) => res_to_js(controller::may_modify_block(
            &mgr,
            id,
            params.sheet_idx,
            params.block_id,
            params.op,
            params.actor,
        )),
        Message::CheckFieldValidation(params) => res_to_js(controller::check_field_validation(
            &mut mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
            params.proposed,
        )),
        Message::GetBlockModifyInfo(params) => res_to_js(controller::get_block_modify_info(
            &mgr,
            id,
            params.sheet_idx,
            params.block_id,
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
        Message::GetShadowInfoById(params) => res_to_js(controller::get_shadow_info_by_id(
            &mut mgr,
            id,
            params.shadow_id,
        )),
        Message::GetDiyCellIdWithBlockId(params) => res_to_js(ws::get_diy_cell_id_with_block_id(
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
        Message::GetRowInfo(params) => res_to_js(controller::get_row_info(
            &mgr,
            id,
            params.sheet_idx,
            params.row_idx,
        )),
        Message::GetAvailableBlockId(params) => res_to_js(controller::get_available_block_id(
            &mut mgr,
            id,
            params.sheet_idx,
        )),
        Message::CheckFormula(params) => {
            res_to_js(controller::check_formula(&mgr, id, params.formula))
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
        Message::Undo => res_to_js(controller::undo(&mut mgr, id)),
        Message::Redo => res_to_js(controller::redo(&mut mgr, id)),
        Message::CleanHistory => res_to_js(controller::clean_history(&mut mgr, id)),
        Message::GetAllBlockFields => res_to_js(controller::get_all_block_fields(&mut mgr, id)),
        Message::DuplicateBlockKeys => res_to_js(controller::duplicate_block_keys(&mgr, id)),
        Message::GetEnumSets => res_to_js(controller::get_enum_sets(&mgr, id)),
        Message::GetDefinedNames => res_to_js(controller::get_defined_names(&mgr, id)),
        Message::GetBlockOpForPayloads => {
            res_to_js(controller::get_block_op_for_payloads(&mgr, id))
        }
        Message::GetBlockOpPolicies(params) => res_to_js(controller::get_block_op_policies(
            &mgr,
            id,
            params.sheet_idx,
            params.block_id,
        )),
        Message::Release => {
            controller::release(&mut mgr, id);
            JsValue::NULL
        }
        Message::GetSheetCount => res_to_js(controller::get_sheet_count(&mgr, id)),
        Message::GetVersion => res_to_js(controller::get_version(&mgr, id)),
        Message::GetAllSheetInfo => res_to_js(controller::get_all_sheet_info(&mgr, id)),
        Message::GetFormulaFunctionNames => {
            res_to_js(controller::get_formula_function_names(&mgr, id))
        }
        Message::GetAppData => res_to_js(controller::get_app_data(&mgr, id)),
        Message::CleanupTempStatus => res_to_js(controller::clean_temp_status(&mut mgr, id)),
        Message::CommitTempStatus => res_to_js(controller::commit_temp_status(&mut mgr, id)),
        Message::CheckBindBlock(params) => res_to_js(controller::check_bind_block(
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
        Message::GetAllBlocks(params) => res_to_js(ws::get_all_blocks(
            &mgr,
            id,
            params.sheet_idx,
            params.sheet_id,
        )),
        Message::GetLinkableBlocks(params) => res_to_js(ws::get_linkable_blocks(
            &mgr,
            id,
            params.sheet_idx,
            params.col_cnt,
        )),
        Message::GetLinks(params) => res_to_js(ws::get_links(&mgr, id, params.sheet_idx)),
        Message::SaveCheckpoint(params) => res_to_js(ws::save_checkpoint(
            &mut mgr,
            id,
            params.label,
            params.description,
        )),
        Message::DeleteCheckpoint(params) => {
            res_to_js(ws::delete_checkpoint(&mut mgr, id, params.label))
        }
        Message::ListCheckpoints => res_to_js(ws::list_checkpoints(&mgr, id)),
    }
}
