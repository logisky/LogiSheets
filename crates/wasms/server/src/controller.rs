use logisheets_base::{BlockId, ColId, RowId, SheetId};
use logisheets_controller::controller::style::{from_hex_str, PatternFill};
use logisheets_controller::edit_action::{
    Alignment, AsyncFuncResult, BlockInput, CellClear, CellFormatBrush, CellInput, CellStyleUpdate,
    CreateAppendix, CreateBlock, CreateDiyCell, CreateSheet, DeleteCols, DeleteColsInBlock,
    DeleteRows, DeleteRowsInBlock, DeleteSheet, EditAction, EditPayload, HorizontalAlignment,
    InsertCols, InsertColsInBlock, InsertRows, InsertRowsInBlock, LineFormatBrush, LineStyleUpdate,
    MergeCells, MoveBlock, PayloadsAction, SetColWidth, SetRowHeight, SheetRename,
    SplitMergedCells, StyleUpdateType, VerticalAlignment,
};
use logisheets_controller::{AsyncCalcResult, AsyncErr, RowInfo, SaveFileResult, Workbook};
use logisheets_workbook::prelude::{StBorderStyle, StPatternType, StUnderlineValues};
use singlyton::{Singleton, SingletonUninit};
use wasm_bindgen::prelude::*;
use xmlserde::XmlValue;

use crate::manager::Manager;

pub(crate) static INIT: Singleton<bool> = Singleton::new(false);
pub(crate) static MANAGER: SingletonUninit<Manager> = SingletonUninit::uninit();

#[macro_export]
macro_rules! handle_result {
    ($r:ident) => {
        if let Err(e) = $r {
            let e = logisheets_controller::ErrorMessage::from(e);
            return serde_wasm_bindgen::to_value(&e).unwrap();
        }
        let $r = $r.unwrap();
    };
}

pub fn init() {
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
    let action = EditAction::Payloads(PayloadsAction {
        payloads,
        undoable,
        init: false,
    });

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
pub fn get_sheet_count(id: usize) -> usize {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    wb.get_sheet_count()
}

#[wasm_bindgen]
pub fn get_all_sheet_info(id: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let result = wb.get_all_sheet_info();
    serde_wasm_bindgen::to_value(&result).unwrap()
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
pub fn set_line_font(
    id: usize,
    sheet_idx: usize,
    from: usize,
    to: usize,
    row: bool,
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
    let p = EditPayload::LineStyleUpdate(LineStyleUpdate {
        sheet_idx,
        from,
        to,
        row,
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
            set_alignment: None,
        },
    });
    MANAGER.get_mut().add_payload(id, p);
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
    let p = EditPayload::CellStyleUpdate(CellStyleUpdate {
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
            set_alignment: None,
        },
    });
    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn set_cell_alignment(
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    h_align: Option<String>,
    v_align: Option<String>,
) {
    let v: Option<VerticalAlignment> = if let Some(value) = v_align {
        serde_json::from_str(&format!("\"{}\"", value)).unwrap()
    } else {
        None
    };
    let h: Option<HorizontalAlignment> = if let Some(value) = h_align {
        serde_json::from_str(&&format!("\"{}\"", value)).unwrap()
    } else {
        None
    };
    let mut ty = StyleUpdateType::default();
    ty.set_alignment = Some(Alignment {
        vertical: v,
        horizontal: h,
    });
    let p = EditPayload::CellStyleUpdate(CellStyleUpdate {
        sheet_idx,
        row,
        col,
        ty,
    });

    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn set_line_alignment(
    id: usize,
    sheet_idx: usize,
    row: bool,
    from: usize,
    to: usize,
    h_align: Option<String>,
    v_align: Option<String>,
) {
    let v: Option<VerticalAlignment> = if let Some(v_align) = v_align {
        serde_json::from_str(&v_align).unwrap()
    } else {
        None
    };
    let h: Option<HorizontalAlignment> = if let Some(h_align) = h_align {
        serde_json::from_str(&h_align).unwrap()
    } else {
        None
    };
    let mut ty = StyleUpdateType::default();
    ty.set_alignment = Some(Alignment {
        vertical: v,
        horizontal: h,
    });
    let p = EditPayload::LineStyleUpdate(LineStyleUpdate {
        sheet_idx,
        row,
        from,
        to,
        ty,
    });
    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn set_line_border(
    id: usize,
    sheet_idx: usize,
    row: bool,
    line: usize,
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
    let p = EditPayload::LineStyleUpdate(LineStyleUpdate {
        sheet_idx,
        from: line,
        to: line,
        row,
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
            set_alignment: None,
        },
    });
    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn set_cell_border(
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
    let p = EditPayload::CellStyleUpdate(CellStyleUpdate {
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
            set_alignment: None,
        },
    });
    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn set_cell_format_brush(
    id: usize,
    src_sheet_idx: usize,
    src_row: usize,
    src_col: usize,
    dst_sheet_idx: usize,
    dst_row_start: usize,
    dst_col_start: usize,
    dst_row_end: usize,
    dst_col_end: usize,
) {
    let p = EditPayload::CellFormatBrush(CellFormatBrush {
        src_sheet_idx,
        dst_sheet_idx,
        src_row,
        src_col,
        dst_row_start,
        dst_col_start,
        dst_row_end,
        dst_col_end,
    });
    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn set_line_format_brush(
    id: usize,
    src_sheet_idx: usize,
    src_row: usize,
    src_col: usize,
    dst_sheet_idx: usize,
    row: bool,
    from: usize,
    to: usize,
) {
    let p = EditPayload::LineFormatBrush(LineFormatBrush {
        src_sheet_idx,
        dst_sheet_idx,
        src_row,
        src_col,
        row,
        from,
        to,
    });
    MANAGER.get_mut().add_payload(id, p);
}

#[wasm_bindgen]
pub fn set_line_pattern_fill(
    id: usize,
    sheet_idx: usize,
    row: bool,
    from: usize,
    to: usize,
    fg_color: Option<String>,
    bg_color: Option<String>,
    pattern: Option<String>,
) {
    init();
    let update = build_pattern_fill_style_update(fg_color, bg_color, pattern);
    let payload = EditPayload::LineStyleUpdate(LineStyleUpdate {
        sheet_idx,
        from,
        to,
        row,
        ty: update,
    });
    MANAGER.get_mut().add_payload(id, payload);
}

fn build_pattern_fill_style_update(
    fg_color: Option<String>,
    bg_color: Option<String>,
    pattern: Option<String>,
) -> StyleUpdateType {
    let fg = if let Some(f) = fg_color {
        Some(from_hex_str(f, 0.))
    } else {
        None
    };
    let bg = if let Some(b) = bg_color {
        Some(from_hex_str(b, 0.))
    } else {
        None
    };
    let pattern: Option<StPatternType> = if let Some(p) = pattern {
        serde_json::from_str(&format!("\"{}\"", p)).unwrap()
    } else {
        None
    };
    let pattern_fill = PatternFill {
        fg_color: fg,
        bg_color: bg,
        pattern_type: pattern,
    };
    let mut style_update = StyleUpdateType::default();
    style_update.set_pattern_fill = Some(pattern_fill);
    style_update
}

#[wasm_bindgen]
pub fn set_cell_pattern_fill(
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    fg_color: Option<String>,
    bg_color: Option<String>,
    pattern: Option<String>,
) {
    init();
    let style_update = build_pattern_fill_style_update(fg_color, bg_color, pattern);
    let payload = EditPayload::CellStyleUpdate(CellStyleUpdate {
        sheet_idx,
        row,
        col,
        ty: style_update,
    });
    MANAGER.get_mut().add_payload(id, payload);
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
pub fn merge_cells(
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
) {
    init();
    MANAGER.get_mut().add_payload(
        id,
        EditPayload::MergeCells(MergeCells {
            sheet_idx,
            start_row,
            start_col,
            end_row,
            end_col,
        }),
    );
}

#[wasm_bindgen]
pub fn split_merged_cells(id: usize, sheet_idx: usize, row: usize, col: usize) {
    init();
    MANAGER.get_mut().add_payload(
        id,
        EditPayload::SplitMergedCells(SplitMergedCells {
            sheet_idx,
            row,
            col,
        }),
    );
}

#[wasm_bindgen]
pub fn cell_clear(id: usize, sheet_idx: usize, row: usize, col: usize) {
    init();
    MANAGER.get_mut().add_payload(
        id,
        EditPayload::CellClear(CellClear {
            sheet_idx,
            row,
            col,
        }),
    );
}

#[wasm_bindgen]
pub fn set_row_height(id: usize, sheet_idx: usize, row: usize, height: f64) {
    init();
    let mut manager = MANAGER.get_mut();
    manager.add_payload(
        id,
        EditPayload::SetRowHeight(SetRowHeight {
            sheet_idx,
            row,
            height,
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
pub fn set_col_width(id: usize, sheet_idx: usize, col: usize, width: f64) {
    init();
    let mut manager = MANAGER.get_mut();
    manager.add_payload(
        id,
        EditPayload::SetColWidth(SetColWidth {
            sheet_idx,
            col,
            width,
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

#[wasm_bindgen]
pub fn check_formula(id: usize, f: String) -> bool {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.check_formula(f);
    match r {
        Ok(_) => true,
        Err(_) => false,
    }
}

#[wasm_bindgen]
pub fn calc_condition(id: usize, sheet_idx: usize, f: String) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.calc_condition(sheet_idx, f);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

#[wasm_bindgen]
pub fn check_bind_block(
    id: usize,
    sheet_idx: usize,
    block_id: usize,
    row_count: usize,
    col_count: usize,
) -> bool {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.check_bind_block(sheet_idx, block_id, row_count, col_count);
    match r {
        Ok(_) => true,
        Err(_) => false,
    }
}

#[wasm_bindgen]
pub fn get_available_block_id(id: usize, sheet_idx: usize) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.get_available_block_id(sheet_idx);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

#[wasm_bindgen]
pub fn get_sheet_id(id: usize, sheet_idx: usize) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.get_worksheet_id(sheet_idx);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

#[wasm_bindgen]
pub fn get_sheet_idx(id: usize, sheet_id: SheetId) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let r = wb.get_sheet_idx_by_id(sheet_id);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

#[wasm_bindgen]
pub fn get_block_values(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_ids: Vec<RowId>,
    col_ids: Vec<ColId>,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let r = wb.get_block_values(sheet_id, block_id, &row_ids, &col_ids);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

#[wasm_bindgen]
pub fn create_diy_cell(id: usize, sheet_idx: usize, row: usize, col: usize) {
    init();
    let mut manager = MANAGER.get_mut();
    let payload = CreateDiyCell {
        sheet_idx,
        row,
        col,
    };
    manager.add_payload(id, EditPayload::CreateDiyCell(payload));
}

#[wasm_bindgen]
pub fn create_appendix(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_idx: usize,
    col_idx: usize,
    craft_id: String,
    tag: u8,
    content: String,
) {
    init();
    let mut manager = MANAGER.get_mut();
    let payload = CreateAppendix {
        sheet_id,
        block_id,
        row_idx,
        col_idx,
        craft_id,
        tag,
        content,
    };
    manager.add_payload(id, EditPayload::CreateAppendix(payload));
}

#[wasm_bindgen]
pub fn get_block_row_id(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_idx: usize,
) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let r = ws.get_block_row_id(block_id, row_idx);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

#[wasm_bindgen]
pub fn get_block_col_id(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    col_idx: usize,
) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let r = ws.get_block_col_id(block_id, col_idx);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

#[wasm_bindgen]
pub fn get_display_window_for_block(id: usize, sheet_id: SheetId, block_id: BlockId) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let r = ws.get_display_window_for_block(block_id);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}
