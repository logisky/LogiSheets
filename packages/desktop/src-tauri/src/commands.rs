use std::sync::mpsc::{Sender, channel};
use std::sync::Mutex;
use std::thread;

use logisheets_rs::rpc::{Manager, Message, controller, ws};
use logisheets_rs::ErrorMessage;
use serde_json::Value;
use tauri::State;

// ---- Serialization edge (native mirror of the WASM `ok_to_js`/`res_to_js`) --
// Same historical wire shape: success -> bare value, error -> bare ErrorMessage;
// the JS SDK distinguishes them by shape.

fn ok_to_json<T: serde::Serialize>(v: &T) -> Value {
    serde_json::to_value(v).unwrap()
}

fn res_to_json<T: serde::Serialize>(r: Result<T, ErrorMessage>) -> Value {
    match r {
        Ok(v) => serde_json::to_value(&v).unwrap(),
        Err(e) => serde_json::to_value(&e).unwrap(),
    }
}

// ---- Engine actor -----------------------------------------------------------
// `Workbook` is `!Send`/`!Sync` (its persistent `imbl` structures share nodes
// via `Arc` around a `RefCell` cache), so the `Manager` can neither be shared
// nor moved across threads — a plain `Mutex<Manager>` in Tauri `State` does not
// compile. A single actor thread OWNS the `Manager`; commands post a job over a
// channel and block for the reply. (The browser hid this: `singlyton` is
// single-threaded and never requires Send/Sync.)

struct Job {
    msg: Message,
    book_id: Option<usize>,
    reply: Sender<Value>,
}

pub struct AppState {
    // `Sender` is `Send` but not `Sync`, so wrap it to make `AppState: Sync`.
    tx: Mutex<Sender<Job>>,
}

impl AppState {
    pub fn new() -> Self {
        let (tx, rx) = channel::<Job>();
        thread::spawn(move || {
            let mut mgr = Manager::default();
            while let Ok(Job { msg, book_id, reply }) = rx.recv() {
                // Runs on the actor thread; `mgr` is the owned Manager, so the
                // dispatch below is byte-identical to the WASM `handle` match.
                let v = if let Message::NewWorkbook = &msg {
                    ok_to_json(&controller::new_workbook(&mut mgr))
                } else {
                    let id = book_id.expect("book id");
    match msg {
        Message::NewWorkbook => unreachable!(),
        Message::GetSheetDimension(params) => {
            res_to_json(ws::get_sheet_dimension(&mgr, id, params.sheet_id))
        }
        Message::GetDependents(params) => res_to_json(ws::get_dependents(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::GetPrecedents(params) => res_to_json(ws::get_precedents(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetDisplayWindow(params) => res_to_json(ws::get_display_window(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.end_row,
            params.start_col,
            params.end_col,
        )),
        Message::GetCell(params) => res_to_json(ws::get_cell_info(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetCellListValidation(params) => ok_to_json(&ws::get_cell_list_validation(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetValue(params) => res_to_json(ws::get_value(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetFormula(params) => res_to_json(ws::get_formula(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetStyle(params) => res_to_json(ws::get_style(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetCells(params) => res_to_json(ws::get_cell_infos(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::PredictFill(params) => res_to_json(ws::predict_fill(
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
        Message::GetCellsExceptWindow(params) => res_to_json(ws::get_cell_infos_except_window(
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
        Message::GetReproducibleCells(params) => res_to_json(ws::get_reproducible_cells(
            &mgr,
            id,
            params.sheet_idx,
            params.coordinates,
        )),
        Message::GetReproducibleCell(params) => res_to_json(ws::get_reproducible_cell(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetCellPosition(params) => res_to_json(ws::get_cell_position(
            &mgr,
            id,
            params.sheet_idx,
            params.row,
            params.col,
        )),
        Message::GetRowHeight(params) => {
            res_to_json(ws::get_row_height(&mgr, id, params.sheet_id, params.row_idx))
        }
        Message::GetColWidth(params) => {
            res_to_json(ws::get_col_width(&mgr, id, params.sheet_id, params.col_idx))
        }
        Message::HandleTransaction(params) => {
            let effect = controller::handle_transaction(&mut mgr, id, params.transaction);
            // If the engine rejected the tx, surface the captured error string
            // (native logs to stderr; the browser edge logs to the console).
            if let logisheets_rs::StatusCode::Err(_) = effect.status {
                if let Some(msg) = logisheets_rs::take_last_error() {
                    eprintln!("[handle_transaction] engine error: {}", msg);
                }
            }
            ok_to_json(&effect)
        }
        Message::ToggleStatus(params) => {
            controller::toggle_status(&mut mgr, id, params.use_temp);
            Value::Null
        }
        Message::BatchGetCellInfoById(params) => {
            res_to_json(controller::batch_get_cell_info_by_id(&mut mgr, id, params.ids))
        }
        Message::BatchGetCellCoordinateWithSheetById(params) => res_to_json(
            controller::batch_get_cell_coordinate_with_sheet_by_id(&mut mgr, id, params.ids),
        ),
        Message::GetSheetNameByIdx(params) => {
            res_to_json(controller::get_sheet_name_by_idx(&mut mgr, id, params.idx))
        }
        Message::LoadWorkbook(params) => {
            ok_to_json(&controller::read_file(&mut mgr, id, params.name, &params.content))
        }
        Message::SaveWorkbook(params) => {
            ok_to_json(&controller::save_file(&mut mgr, id, params.app_data))
        }
        Message::GetCellId(params) => res_to_json(controller::get_cell_id(
            &mut mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
        )),
        Message::GetMergedCells(params) => ok_to_json(&ws::get_merged_cells(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::GetComments(params) => ok_to_json(&ws::get_comments(&mgr, id, params.sheet_idx)),
        Message::GetCellImages(params) => {
            ok_to_json(&ws::get_cell_images(&mgr, id, params.sheet_idx))
        }
        Message::GetCharts(params) => ok_to_json(&ws::get_charts(&mgr, id, params.sheet_idx)),
        Message::CalcCondition(params) => res_to_json(controller::calc_condition(
            &mut mgr,
            id,
            params.sheet_idx,
            params.condition,
        )),
        Message::GetCellIdByBlockRef(params) => res_to_json(controller::get_cell_id_by_block_ref(
            &mgr,
            id,
            params.ref_name,
            params.key,
            params.field,
        )),
        Message::ExportBlockData(params) => res_to_json(controller::export_block_data(
            &mgr,
            id,
            params.ref_name,
            params.key_filter,
            params.field_filter,
        )),
        Message::GetTempStatusChanges => res_to_json(controller::get_temp_status_changes(&mgr, id)),
        Message::GetBlockDisplayWindow(params) => res_to_json(
            controller::get_display_window_for_block(&mut mgr, id, params.sheet_id, params.block_id),
        ),
        Message::GetBlockRowId(params) => res_to_json(controller::get_block_row_id(
            &mut mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.row_idx,
        )),
        Message::GetBlockColId(params) => res_to_json(controller::get_block_col_id(
            &mut mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.col_idx,
        )),
        Message::GetSheetIdx(params) => {
            res_to_json(controller::get_sheet_idx(&mgr, id, params.sheet_id))
        }
        Message::GetSheetId(params) => {
            res_to_json(controller::get_sheet_id(&mut mgr, id, params.sheet_idx))
        }
        Message::GetBlockValues(params) => res_to_json(controller::get_block_values(
            &mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.row_ids,
            params.col_ids,
        )),
        Message::GetBlockSortOrder(params) => res_to_json(controller::get_block_sort_order(
            &mgr,
            id,
            params.sheet_idx,
            params.block_id,
            params.field,
            params.asc,
        )),
        Message::GetShadowCellId(params) => res_to_json(controller::get_shadow_cell_id(
            &mut mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.kind.unwrap_or_default(),
        )),
        Message::GetShadowCellIds(params) => res_to_json(controller::get_shadow_cell_ids(
            &mut mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.kind.unwrap_or_default(),
        )),
        Message::GetShadowInfoById(params) => {
            res_to_json(controller::get_shadow_info_by_id(&mut mgr, id, params.shadow_id))
        }
        Message::GetDiyCellIdWithBlockId(params) => ok_to_json(&ws::get_diy_cell_id_with_block_id(
            &mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.row,
            params.col,
        )),
        Message::LookupAppendixUpward(params) => res_to_json(ws::lookup_appendix_upward(
            &mgr,
            id,
            params.sheet_id,
            params.block_id,
            params.row,
            params.col,
            params.craft_id,
            params.tag,
        )),
        Message::GetNextVisibleCell(params) => res_to_json(ws::get_next_visible_cell(
            &mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.direction,
        )),
        Message::GetDataBoundary(params) => res_to_json(ws::get_data_boundary(
            &mgr,
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.direction,
        )),
        Message::GetDisplayUnitsOfFormula(params) => {
            res_to_json(controller::get_display_units_of_formula(&params.formula))
        }
        Message::GetRowInfo(params) => {
            res_to_json(controller::get_row_info(&mgr, id, params.sheet_idx, params.row_idx))
        }
        Message::GetAvailableBlockId(params) => {
            res_to_json(controller::get_available_block_id(&mut mgr, id, params.sheet_idx))
        }
        Message::CheckFormula(params) => {
            ok_to_json(&controller::check_formula(&mgr, id, params.formula))
        }
        Message::GetBlockInfo(params) => res_to_json(ws::get_block_info(
            &mgr,
            id,
            params.sheet_id,
            params.block_id as usize,
        )),
        Message::GetCellInfos(params) => res_to_json(ws::get_cell_infos(
            &mgr,
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        )),
        Message::Undo => ok_to_json(&controller::undo(&mut mgr, id)),
        Message::Redo => ok_to_json(&controller::redo(&mut mgr, id)),
        Message::CleanHistory => {
            controller::clean_history(&mut mgr, id);
            Value::Null
        }
        Message::GetAllBlockFields => res_to_json(controller::get_all_block_fields(&mut mgr, id)),
        Message::Release => {
            controller::release(&mut mgr, id);
            Value::Null
        }
        Message::GetSheetCount => ok_to_json(&controller::get_sheet_count(&mgr, id)),
        Message::GetAllSheetInfo => ok_to_json(&controller::get_all_sheet_info(&mgr, id)),
        Message::GetFormulaFunctionNames => {
            ok_to_json(&controller::get_formula_function_names(&mgr, id))
        }
        Message::GetAppData => ok_to_json(&controller::get_app_data(&mgr, id)),
        Message::CleanTempStatus => {
            controller::clean_temp_status(&mut mgr, id);
            Value::Null
        }
        Message::CommitTempStatus => ok_to_json(&controller::commit_temp_status(&mut mgr, id)),
        Message::CheckBindBlock(params) => ok_to_json(&controller::check_bind_block(
            &mut mgr,
            id,
            params.sheet_idx,
            params.block_id,
            params.row_count,
            params.col_count,
        )),
        Message::GetDisplayWindowWithStartPoint(params) => {
            res_to_json(ws::get_display_window_with_start_point(
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
            res_to_json(ws::get_display_window_within_cell(
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
            res_to_json(ws::get_col_info(&mgr, id, params.sheet_idx, params.col_idx))
        }
        Message::GetFullyCoveredBlocks(params) => res_to_json(ws::get_all_fully_covered_blocks(
            &mgr,
            id,
            params.sheet_id,
            params.row,
            params.col,
            params.row_cnt,
            params.col_cnt,
        )),
        Message::GetAllBlocks(params) => {
            res_to_json(ws::get_all_blocks(&mgr, id, params.sheet_idx, params.sheet_id))
        }
        Message::GetLinkableBlocks(params) => {
            res_to_json(ws::get_linkable_blocks(&mgr, id, params.sheet_idx, params.col_cnt))
        }
        Message::GetLinks(params) => res_to_json(ws::get_links(&mgr, id, params.sheet_idx)),
        Message::SaveCheckpoint(params) => ok_to_json(&ws::save_checkpoint(
            &mut mgr,
            id,
            params.label,
            params.description,
        )),
        Message::DeleteCheckpoint(params) => {
            ok_to_json(&ws::delete_checkpoint(&mut mgr, id, params.label))
        }
        Message::ListCheckpoints => ok_to_json(&ws::list_checkpoints(&mgr, id)),
    }
                };
                let _ = reply.send(v);
            }
        });
        AppState { tx: Mutex::new(tx) }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Native mirror of the browser `handle`: post the message to the engine actor
/// and block for its JSON reply. Tauri deserializes `msg` into `Message` for us.
#[tauri::command]
pub fn handle(msg: Message, book_id: Option<usize>, state: State<AppState>) -> Value {
    let (reply_tx, reply_rx) = channel();
    state
        .tx
        .lock()
        .unwrap()
        .send(Job { msg, book_id, reply: reply_tx })
        .expect("engine actor thread is not running");
    reply_rx.recv().expect("engine actor dropped the reply")
}
