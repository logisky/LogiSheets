use logisheets_base::SheetId;
use logisheets_controller::controller::display::CellPosition;
use logisheets_controller::ColInfo;
use wasm_bindgen::prelude::*;

use crate::controller::init;
use crate::controller::MANAGER;
use crate::handle_result;

#[wasm_bindgen]
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

#[wasm_bindgen]
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

#[wasm_bindgen]
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

#[wasm_bindgen]
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

#[wasm_bindgen]
pub fn get_cell_info(id: usize, sheet_id: SheetId, row: usize, col: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let cell = ws.get_cell_info(row, col);
    handle_result!(cell);
    serde_wasm_bindgen::to_value(&cell).unwrap()
}

#[wasm_bindgen]
pub fn get_cell_info_with_sheet_id(id: usize, sheet_id: usize, row: usize, col: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id as u16);
    handle_result!(ws);
    let cell = ws.get_cell_info(row, col);
    handle_result!(cell);
    serde_wasm_bindgen::to_value(&cell).unwrap()
}

#[wasm_bindgen]
pub fn get_col_info(id: usize, sheet_id: SheetId, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let col_info = ws
        .get_col_info(col_idx)
        .unwrap_or(ColInfo::default(col_idx));
    serde_wasm_bindgen::to_value(&col_info).unwrap()
}

#[wasm_bindgen]
pub fn get_value(id: usize, sheet_id: SheetId, row_idx: usize, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let value = ws.get_value(row_idx, col_idx);
    handle_result!(value);
    serde_wasm_bindgen::to_value(&value).unwrap()
}

#[wasm_bindgen]
pub fn get_formula(id: usize, sheet_id: SheetId, row_idx: usize, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let formula = ws.get_formula(row_idx, col_idx);
    handle_result!(formula);
    serde_wasm_bindgen::to_value(&formula).unwrap()
}

#[wasm_bindgen]
pub fn get_style(id: usize, sheet_id: SheetId, row_idx: usize, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let style = ws.get_style(row_idx, col_idx);
    handle_result!(style);
    serde_wasm_bindgen::to_value(&style).unwrap()
}

#[wasm_bindgen]
pub fn get_display_window(
    id: usize,
    sheet_id: SheetId,
    start_row: usize,
    end_row: usize,
    start_col: usize,
    end_col: usize,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let window = ws.get_display_window(start_row, start_col, end_row, end_col);
    handle_result!(window);
    serde_wasm_bindgen::to_value(&window).unwrap()
}

#[wasm_bindgen]
pub fn get_display_window_with_start_point(
    id: usize,
    sheet_id: SheetId,
    start_x: f64,
    start_y: f64,
    height: f64,
    width: f64,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let result = ws.get_display_window_response(start_x, start_y, width, height);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn get_display_window_within_cell(
    id: usize,
    sheet_id: SheetId,
    row: usize,
    col: usize,
    height: f64,
    width: f64,
) -> JsValue {
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let cell_position = ws.get_cell_position(row, col);
    handle_result!(cell_position);
    let CellPosition { x, y } = cell_position;
    let start_x = x - width / 2.5;
    let start_y = y - height / 2.5;
    let result = get_display_window_with_start_point(id, sheet_id, start_x, start_y, height, width);
    result
}

#[wasm_bindgen]
pub fn get_merged_cells(
    id: usize,
    sheet_id: SheetId,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id).unwrap();
    let r = ws.get_merged_cells(start_row, start_col, end_row, end_col);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

#[wasm_bindgen]
pub fn get_cell_position(id: usize, sheet_id: SheetId, row: usize, col: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let result = manager
        .get_workbook(&id)
        .unwrap()
        .get_sheet_by_id(sheet_id)
        .unwrap()
        .get_cell_position(row, col);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}
