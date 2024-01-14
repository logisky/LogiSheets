use logisheets_controller::controller::display::{DisplayRequest, DisplayWindowWithStartPoint};
use logisheets_controller::edit_action::{
    AsyncFuncResult, BlockInput, CellInput, CreateBlock, CreateSheet, DeleteCols,
    DeleteColsInBlock, DeleteRows, DeleteRowsInBlock, DeleteSheet, EditAction, EditPayload,
    InsertCols, InsertColsInBlock, InsertRows, InsertRowsInBlock, MoveBlock, PayloadsAction,
    SheetRename, StyleUpdate, StyleUpdateType,
};
use logisheets_controller::{AsyncCalcResult, AsyncErr, RowInfo, SaveFileResult, Workbook};
use logisheets_controller::{ColInfo, ErrorMessage};
use logisheets_workbook::prelude::{StBorderStyle, StUnderlineValues};
use singlyton::{Singleton, SingletonUninit};
use wasm_bindgen::prelude::*;
use xmlserde::XmlValue;

use crate::manager::Manager;

static INIT: Singleton<bool> = Singleton::new(false);
static MANAGER: SingletonUninit<Manager> = SingletonUninit::uninit();

macro_rules! handle_result {
    ($r:ident) => {
        if let Err(e) = $r {
            let e = ErrorMessage::from(e);
            return serde_wasm_bindgen::to_value(&e).unwrap();
        }
        let $r = $r.unwrap();
    };
}

fn init() {
    if *INIT.get() {
        return;
    }
    MANAGER.init(Manager::default());
    let mut init = INIT.get_mut();
    *init = true;
}

#[wasm_bindgen]
pub fn new_workbook() -> usize {
    init();
    let mut manager = MANAGER.get_mut();
    let id = manager.new_workbook();
    id
}

#[wasm_bindgen]
pub fn read_file(id: usize, name: String, buf: &[u8]) -> u8 {
    init();
    let ctrl = Workbook::from_file(buf, name);
    match ctrl {
        Ok(c) => {
            let mut manager = MANAGER.get_mut();
            manager.replace_workbook(id, c);
            0
        }
        Err(_) => 1,
    }
}

#[wasm_bindgen]
pub fn save_file(id: usize) -> JsValue {
    init();
    let result = save_file_impl(id);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub fn save_file_impl(id: usize) -> SaveFileResult {
    let manager = MANAGER.get();
    let ctrl = manager.get_workbook(&id);
    if ctrl.is_none() {
        return SaveFileResult {
            code: 1,
            data: vec![],
        };
    }
    let ctrl = ctrl.unwrap();
    if let Ok(data) = ctrl.save() {
        SaveFileResult { data, code: 0 }
    } else {
        SaveFileResult {
            data: vec![],
            code: 1,
        }
    }
}

#[wasm_bindgen]
pub fn release(id: usize) {
    init();
    let mut manager = MANAGER.get_mut();
    manager.remove(id)
}

#[wasm_bindgen]
pub fn undo(id: usize) -> bool {
    init();
    let mut manager = MANAGER.get_mut();
    let ctrl = manager.get_mut_workbook(&id);
    if let Some(ctrl) = ctrl {
        ctrl.undo()
    } else {
        false
    }
}

#[wasm_bindgen]
pub fn redo(id: usize) -> bool {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id);
    if let Some(ctrl) = wb {
        ctrl.redo()
    } else {
        false
    }
}

#[wasm_bindgen]
pub fn transaction_start(id: usize) {
    init();
    MANAGER.get_mut().clean_payloads(id);
}

#[wasm_bindgen]
/// The JSON format of `ActionEffect`.
pub fn transaction_end(id: usize, undoable: bool) -> JsValue {
    init();
    let payloads = MANAGER.get_mut().get_payloads(&id);
    let action = EditAction::Payloads(PayloadsAction { payloads, undoable });

    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let action_effect = wb.handle_action(action);
    serde_wasm_bindgen::to_value(&action_effect).unwrap()
}

/// Input: AsyncFuncResult
/// Output: ActionAffect
#[wasm_bindgen]
pub fn input_async_result(id: usize, result: JsValue) -> JsValue {
    init();
    let r: AsyncFuncResult = serde_wasm_bindgen::from_value(result).unwrap();
    let values = r
        .values
        .into_iter()
        .map(|v| parse_async_value(v))
        .collect::<Vec<_>>();
    let tasks = r.tasks;
    let result = MANAGER
        .get_mut()
        .get_mut_workbook(&id)
        .unwrap()
        .handle_async_calc_results(tasks, values);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
/// logisheets_controller::DisplayResponse
pub fn get_patches(id: usize, sheet_idx: u32, version: u32) -> JsValue {
    init();
    let manager = MANAGER.get();
    let response = manager
        .get_workbook(&id)
        .unwrap()
        .get_display_response(DisplayRequest {
            sheet_idx: sheet_idx as usize,
            version,
        });
    let res = serde_wasm_bindgen::to_value(&response);
    match res {
        Ok(r) => r,
        Err(err) => {
            #[allow(unused_unsafe)]
            unsafe {
                web_sys::console::log_1(&err.to_string().into())
            };
            panic!()
        }
    }
}

#[wasm_bindgen]
pub fn get_sheet_count(id: usize) -> usize {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    wb.get_sheet_count()
}

#[wasm_bindgen]
pub fn get_row_info(id: usize, sheet_idx: usize, row_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let row_info = ws
        .get_row_info(row_idx)
        .unwrap_or(RowInfo::default(row_idx));
    serde_wasm_bindgen::to_value(&row_info).unwrap()
}

#[wasm_bindgen]
pub fn get_row_height(id: usize, sheet_idx: usize, row_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let row_height = ws.get_row_height(row_idx);
    handle_result!(row_height);
    serde_wasm_bindgen::to_value(&row_height).unwrap()
}

#[wasm_bindgen]
pub fn get_col_width(id: usize, sheet_idx: usize, col_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let col_width = ws.get_col_width(col_idx);
    handle_result!(col_width);
    serde_wasm_bindgen::to_value(&col_width).unwrap()
}

#[wasm_bindgen]
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

#[wasm_bindgen]
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

#[wasm_bindgen]
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

#[wasm_bindgen]
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

#[wasm_bindgen]
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

#[wasm_bindgen]
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

#[wasm_bindgen]
pub fn get_display_window_with_start_point(
    id: usize,
    sheet_idx: usize,
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let mut start_row = 0;
    let mut end_row = 0;
    let mut start_col = 0;
    let mut end_col = 0;
    let mut start_point_x = 0_f64;
    let mut start_point_y = 0_f64;

    let mut curr_idx = 0;
    let mut curr = 0_f64;
    let mut last_value = 0_f64;
    let mut s_flag = false;
    let mut e_flag = false;
    while !s_flag || !e_flag {
        if !s_flag && curr >= start_y {
            start_row = if curr_idx > 0 { curr_idx - 1 } else { curr_idx };
            s_flag = true;
            start_point_y = curr - last_value;
        }

        if !e_flag && curr >= end_y {
            end_row = curr_idx + 1;
            e_flag = true;
        }
        let h = ws.get_row_height(curr_idx);
        handle_result!(h);
        last_value = h;
        curr += h;
        curr_idx += 1;
    }
    let mut curr_idx = 0;
    let mut curr = 0_f64;
    let mut last_value = 0_f64;
    let mut s_flag = false;
    let mut e_flag = false;
    while !s_flag || !e_flag {
        if !s_flag && curr >= start_x {
            start_col = if curr_idx > 0 { curr_idx - 1 } else { curr_idx };
            s_flag = true;
            start_point_x = curr - last_value;
        }

        if !e_flag && curr >= end_x {
            end_col = curr_idx + 1;
            e_flag = true;
        }
        let w = ws.get_col_width(curr_idx);
        handle_result!(w);
        last_value = w;
        curr += w;
        curr_idx += 1;
    }
    let window = ws.get_display_window(start_row, start_col, end_row, end_col);
    handle_result!(window);
    let result = DisplayWindowWithStartPoint {
        window,
        start_x: start_point_x,
        start_y: start_point_y,
    };
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn set_font(
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    bold: Option<bool>,
    italic: Option<bool>,
    name: Option<String>,
    underline: Option<String>,
    color: Option<String>,
    size: Option<f64>,
    outline: Option<bool>,
    shadow: Option<bool>,
    strike: Option<bool>,
    condense: Option<bool>,
) {
    let p = EditPayload::StyleUpdate(StyleUpdate {
        sheet_idx,
        row,
        col,
        ty: StyleUpdateType {
            set_font_bold: bold,
            set_font_italic: italic,
            set_font_underline: underline.map(|s| StUnderlineValues::deserialize(&s).unwrap()),
            set_font_color: color,
            set_font_size: size,
            set_font_name: name,
            set_font_outline: outline,
            set_font_shadow: shadow,
            set_font_strike: strike,
            set_font_condense: condense,
            set_left_border_color: None,
            set_right_border_color: None,
            set_top_border_color: None,
            set_bottom_border_color: None,
            set_left_border_style: None,
            set_right_border_style: None,
            set_top_border_style: None,
            set_bottom_border_style: None,
            set_border_giagonal_up: None,
            set_border_giagonal_down: None,
            set_border_outline: None,
            set_pattern_fill: None,
        },
    });
    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn set_border(
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    left_color: Option<String>,
    right_color: Option<String>,
    top_color: Option<String>,
    bottom_color: Option<String>,
    left_border_type: Option<String>,
    right_border_type: Option<String>,
    top_border_type: Option<String>,
    bottom_border_type: Option<String>,
    outline: Option<bool>,
    diagonal_up: Option<bool>,
    diagonal_down: Option<bool>,
) {
    let p = EditPayload::StyleUpdate(StyleUpdate {
        sheet_idx,
        row,
        col,
        ty: StyleUpdateType {
            set_font_bold: None,
            set_font_italic: None,
            set_font_underline: None,
            set_font_color: None,
            set_font_size: None,
            set_font_name: None,
            set_font_outline: None,
            set_font_shadow: None,
            set_font_strike: None,
            set_font_condense: None,
            set_left_border_color: left_color,
            set_right_border_color: right_color,
            set_top_border_color: top_color,
            set_bottom_border_color: bottom_color,
            set_left_border_style: left_border_type
                .map(|b| StBorderStyle::deserialize(&b).unwrap()),
            set_right_border_style: right_border_type
                .map(|b| StBorderStyle::deserialize(&b).unwrap()),
            set_top_border_style: top_border_type.map(|b| StBorderStyle::deserialize(&b).unwrap()),
            set_bottom_border_style: bottom_border_type
                .map(|b| StBorderStyle::deserialize(&b).unwrap()),
            set_border_giagonal_up: diagonal_up,
            set_border_giagonal_down: diagonal_down,
            set_border_outline: outline,
            set_pattern_fill: None,
        },
    });
    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn cell_input(id: usize, sheet_idx: usize, row: usize, col: usize, content: String) {
    init();
    MANAGER.get_mut().add_payload(
        id,
        EditPayload::CellInput(CellInput {
            sheet_idx,
            row,
            col,
            content,
        }),
    );
}

#[wasm_bindgen]
pub fn row_insert(id: usize, sheet_idx: usize, start: usize, count: usize) {
    init();
    let mut manager = MANAGER.get_mut();
    manager.add_payload(
        id,
        EditPayload::InsertRows(InsertRows {
            sheet_idx,
            start,
            count,
        }),
    );
}

#[wasm_bindgen]
pub fn row_delete(id: usize, sheet_idx: usize, start: usize, count: usize) {
    init();
    let mut manager = MANAGER.get_mut();
    manager.add_payload(
        id,
        EditPayload::DeleteRows(DeleteRows {
            sheet_idx,
            start,
            count,
        }),
    );
}

#[wasm_bindgen]
pub fn col_insert(id: usize, sheet_idx: usize, start: usize, count: usize) {
    init();
    let mut manager = MANAGER.get_mut();
    manager.add_payload(
        id,
        EditPayload::InsertCols(InsertCols {
            sheet_idx,
            start,
            count,
        }),
    );
}

#[wasm_bindgen]
pub fn col_delete(id: usize, sheet_idx: usize, start: usize, count: usize) {
    init();
    let mut manager = MANAGER.get_mut();
    manager.add_payload(
        id,
        EditPayload::DeleteCols(DeleteCols {
            sheet_idx,
            start,
            count,
        }),
    );
}

#[wasm_bindgen]
pub fn create_block(
    id: usize,
    sheet_idx: usize,
    block_id: usize,
    master_row: usize,
    master_col: usize,
    row_cnt: usize,
    col_cnt: usize,
) {
    init();
    let b = CreateBlock {
        sheet_idx,
        master_row,
        master_col,
        row_cnt,
        col_cnt,
        id: block_id,
    };
    let mut manager = MANAGER.get_mut();
    manager.add_payload(id, EditPayload::CreateBlock(b));
}

#[wasm_bindgen]
pub fn move_block(id: usize, sheet_idx: usize, block_id: usize, row: usize, col: usize) {
    init();
    let m = MoveBlock {
        sheet_idx,
        id: block_id,
        new_master_row: row,
        new_master_col: col,
    };
    let mut manager = MANAGER.get_mut();
    manager.add_payload(id, EditPayload::MoveBlock(m));
}

#[wasm_bindgen]
pub fn block_input(
    id: usize,
    sheet_idx: usize,
    block_id: usize,
    row: usize,
    col: usize,
    input: String,
) {
    init();
    let bi = BlockInput {
        sheet_idx,
        block_id,
        row,
        col,
        input,
    };
    let mut manager = MANAGER.get_mut();
    manager.add_payload(id, EditPayload::BlockInput(bi));
}

#[wasm_bindgen]
pub fn block_line_shift(
    id: usize,
    sheet_idx: usize,
    block_id: usize,
    start: usize,
    cnt: usize,
    horizontal: bool,
    insert: bool,
) {
    init();
    let p = if horizontal && insert {
        EditPayload::InsertRowsInBlock(InsertRowsInBlock {
            sheet_idx,
            block_id,
            start,
            cnt,
        })
    } else if !horizontal && insert {
        EditPayload::InsertColsInBlock(InsertColsInBlock {
            sheet_idx,
            block_id,
            start,
            cnt,
        })
    } else if horizontal && !insert {
        EditPayload::DeleteRowsInBlock(DeleteRowsInBlock {
            sheet_idx,
            block_id,
            start,
            cnt,
        })
    } else {
        EditPayload::DeleteColsInBlock(DeleteColsInBlock {
            sheet_idx,
            block_id,
            start,
            cnt,
        })
    };
    let mut manager = MANAGER.get_mut();
    manager.add_payload(id, p);
}

#[wasm_bindgen]
pub fn sheet_rename_by_name(id: usize, old_name: String, new_name: String) {
    init();
    let p = SheetRename {
        idx: None,
        old_name: Some(old_name),
        new_name,
    };
    let mut manager = MANAGER.get_mut();
    manager.add_payload(id, EditPayload::SheetRename(p));
}

#[wasm_bindgen]
pub fn sheet_rename_by_idx(id: usize, idx: usize, new_name: String) {
    init();
    let p = SheetRename {
        idx: Some(idx),
        old_name: None,
        new_name,
    };
    let mut manager = MANAGER.get_mut();
    manager.add_payload(id, EditPayload::SheetRename(p));
}

#[wasm_bindgen]
pub fn create_sheet(id: usize, idx: usize, name: String) {
    init();
    let p = CreateSheet {
        idx,
        new_name: name,
    };
    let mut manager = MANAGER.get_mut();
    manager.add_payload(id, EditPayload::CreateSheet(p));
}

#[wasm_bindgen]
pub fn delete_sheet(id: usize, idx: usize) {
    init();
    let p = DeleteSheet { idx };
    let mut manager = MANAGER.get_mut();
    manager.add_payload(id, EditPayload::DeleteSheet(p));
}

fn parse_async_value(s: String) -> AsyncCalcResult {
    match s.as_str() {
        "#TIMEOUT!" => Err(AsyncErr::TimeOut),
        "#ARGERR!" => Err(AsyncErr::ArgErr),
        "#NOTFOUND" => Err(AsyncErr::NotFound),
        _ => Ok(s),
    }
}
