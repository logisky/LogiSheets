use logisheets_rs::{
    BasicError, BlockId, CellPosition, ColInfo, DiyCellId, Error, FillRange, SheetCoordinate,
    SheetId,
};
use wasm_bindgen::prelude::*;

use crate::controller::MANAGER;
use crate::controller::init;
use crate::handle_result;
use crate::rpc::Direction;

pub fn get_sheet_dimension(id: usize, sheet_id: SheetId) -> JsValue {
    init();
    let manager = MANAGER.get();
    let result = manager
        .get_workbook(&id)
        .unwrap()
        .get_sheet_by_id(sheet_id)
        .unwrap()
        .get_sheet_dimension();
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_all_fully_covered_blocks(
    id: usize,
    sheet_id: SheetId,
    row: usize,
    col: usize,
    row_cnt: usize,
    col_cnt: usize,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let result = ws.get_all_fully_covered_blocks(row, col, row + row_cnt - 1, col + col_cnt - 1);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_row_height(id: usize, sheet_id: SheetId, row_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let row_height = ws.get_row_height(row_idx);
    handle_result!(row_height);
    serde_wasm_bindgen::to_value(&row_height).unwrap()
}

pub fn get_col_width(id: usize, sheet_id: SheetId, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let col_width = ws.get_col_width(col_idx);
    handle_result!(col_width);
    serde_wasm_bindgen::to_value(&col_width).unwrap()
}

pub fn get_cell_info(id: usize, sheet_idx: usize, row: usize, col: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let cell = ws.get_cell_info(row, col);
    handle_result!(cell);
    serde_wasm_bindgen::to_value(&cell).unwrap()
}

// The enum option set of a cell's list data-validation (inline lists only),
// or null. Serialized as `string[] | null`. Used by douyoushu to prefill enum
// inputs from a workbook's existing dropdowns.
pub fn get_cell_list_validation(id: usize, sheet_idx: usize, row: usize, col: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let result = wb.get_cell_enum_options(sheet_idx, row, col);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_col_info(id: usize, sheet_idx: usize, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let col_info = ws
        .get_col_info(col_idx)
        .unwrap_or(ColInfo::default(col_idx));
    serde_wasm_bindgen::to_value(&col_info).unwrap()
}

pub fn get_value(id: usize, sheet_idx: usize, row_idx: usize, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let value = ws.get_value(row_idx, col_idx);
    handle_result!(value);
    serde_wasm_bindgen::to_value(&value).unwrap()
}

pub fn get_formula(id: usize, sheet_idx: usize, row_idx: usize, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let formula = ws.get_formula(row_idx, col_idx);
    handle_result!(formula);
    serde_wasm_bindgen::to_value(&formula).unwrap()
}

pub fn get_style(id: usize, sheet_idx: usize, row_idx: usize, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let style = ws.get_style(row_idx, col_idx);
    handle_result!(style);
    serde_wasm_bindgen::to_value(&style).unwrap()
}

pub fn get_display_window(
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    end_row: usize,
    start_col: usize,
    end_col: usize,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let window = ws.get_display_window(start_row, start_col, end_row, end_col);
    handle_result!(window);
    serde_wasm_bindgen::to_value(&window).unwrap()
}

pub fn get_display_window_with_start_point(
    id: usize,
    sheet_idx: usize,
    start_x: f64,
    start_y: f64,
    height: f64,
    width: f64,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let result = ws.get_display_window_response(start_x, start_y, width, height);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_display_window_within_cell(
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    height: f64,
    width: f64,
) -> JsValue {
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let cell_position = ws.get_cell_position(row, col);
    handle_result!(cell_position);
    let CellPosition { x, y } = cell_position;
    let start_x = x - width / 2.5;
    let start_y = y - height / 2.5;
    let result =
        get_display_window_with_start_point(id, sheet_idx, start_x, start_y, height, width);
    result
}

pub fn get_merged_cells(
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
    let r = ws.get_merged_cells(start_row, start_col, end_row, end_col);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_comments(id: usize, sheet_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
    let r = ws.get_comments();
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_cell_images(id: usize, sheet_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
    let r = ws.get_cell_images();
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_cell_position(id: usize, sheet_idx: usize, row: usize, col: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let result = manager
        .get_workbook(&id)
        .unwrap()
        .get_sheet_by_idx(sheet_idx)
        .unwrap()
        .get_cell_position(row, col);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_diy_cell_id_with_block_id(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row: usize,
    col: usize,
) -> Option<DiyCellId> {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id).unwrap();
    ws.get_diy_cell_id_with_block_id(&block_id, row, col)
}

pub fn lookup_appendix_upward(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_idx: usize,
    col_idx: usize,
    craft_id: String,
    tag: u8,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id).unwrap();
    let result = ws
        .lookup_appendix_upward(block_id, row_idx, col_idx, &craft_id, tag)
        .ok_or(Error::Basic(BasicError::NoAppendix));
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_cell_infos(
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
    let result = ws.get_cell_infos(start_row, start_col, end_row, end_col);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[allow(clippy::too_many_arguments)]
pub fn predict_fill(
    id: usize,
    sheet_idx: usize,
    src_start_row: usize,
    src_start_col: usize,
    src_end_row: usize,
    src_end_col: usize,
    dst_start_row: usize,
    dst_start_col: usize,
    dst_end_row: usize,
    dst_end_col: usize,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let src = FillRange {
        start_row: src_start_row,
        start_col: src_start_col,
        end_row: src_end_row,
        end_col: src_end_col,
    };
    let dst = FillRange {
        start_row: dst_start_row,
        start_col: dst_start_col,
        end_row: dst_end_row,
        end_col: dst_end_col,
    };
    let result = wb.predict_fill(sheet_idx, src, dst);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_cell_infos_except_window(
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
    window_start_row: usize,
    window_start_col: usize,
    window_end_row: usize,
    window_end_col: usize,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
    let result = ws.get_cell_infos_except_window(
        start_row,
        start_col,
        end_row,
        end_col,
        window_start_row,
        window_start_col,
        window_end_row,
        window_end_col,
    );
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_block_info(id: usize, sheet_id: SheetId, block_id: BlockId) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id).unwrap();
    let result = ws.get_block_info(block_id);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_all_blocks(id: usize, sheet_idx: Option<usize>, sheet_id: Option<SheetId>) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let result = wb.get_all_blocks(sheet_idx, sheet_id);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn save_checkpoint(id: usize, label: String, description: Option<String>) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let count = wb.save_checkpoint(label, description);
    serde_wasm_bindgen::to_value(&count).unwrap()
}

pub fn delete_checkpoint(id: usize, label: String) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let existed = wb.delete_checkpoint(&label);
    serde_wasm_bindgen::to_value(&existed).unwrap()
}

pub fn list_checkpoints(id: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    // Convert CheckpointMeta to the RPC DTO (drops the Status payload —
    // the manager's `list()` already only returns label + description).
    let metas: Vec<crate::rpc::CheckpointMetaDto> =
        wb.list_checkpoints().into_iter().map(Into::into).collect();
    serde_wasm_bindgen::to_value(&metas).unwrap()
}

pub fn get_reproducible_cell(id: usize, sheet_idx: usize, row: usize, col: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
    let result = ws.get_reproducible_cell(row, col);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_reproducible_cells(
    id: usize,
    sheet_idx: usize,
    coordinates: Vec<SheetCoordinate>,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
    let result = ws.get_reproducible_cells(coordinates);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_next_visible_cell(
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    direction: Direction,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();

    let result = match direction {
        Direction::Up => ws.get_next_upward_visible_cell(row, col),
        Direction::Down => ws.get_next_downward_visible_cell(row, col),
        Direction::Left => ws.get_next_leftward_visible_cell(row, col),
        Direction::Right => ws.get_next_rightward_visible_cell(row, col),
    };
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn get_data_boundary(
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    direction: Direction,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();

    let result = match direction {
        Direction::Up => ws.get_upward_data_boundary(row, col),
        Direction::Down => ws.get_downward_data_boundary(row, col),
        Direction::Left => ws.get_leftward_data_boundary(row, col),
        Direction::Right => ws.get_rightward_data_boundary(row, col),
    };
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}
