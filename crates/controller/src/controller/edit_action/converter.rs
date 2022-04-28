use logisheets_base::{BlockId, CellValue, TextId};

use super::style_payload::{StyleUpdate, StyleUpdateType};
use super::{
    CellInput, ColShift, CreateBlock, EditPayload, LineShiftInBlock, MoveBlock, RowShift,
    SetColWidth, SetRowHeight,
};
use crate::container::DataContainer;
use crate::id_manager::TextIdManager;
use crate::navigator::Navigator;
use crate::payloads::sheet_process::style::{CellStylePayload, FontPayloadType};
use crate::payloads::sheet_process::{
    BlockDeleteColsPayload, BlockDeleteRowsPayload, BlockInsertColsPayload, BlockInsertRowsPayload,
    BlockPayload, CellChange, CellPayload, ColInfoUpdate, CreateBlock as EditCreateBlock,
    Direction, FormulaPayload, LineInfoUpdate, LinePayload, LineShift, MoveBlock as EditMoveBlock,
    RowInfoUpdate, SheetPayload, SheetProcess, ShiftPayload, ShiftType,
};
use crate::payloads::sheet_shift::SheetRenamePayload;
use crate::payloads::Process;
use crate::workbook::sheet_pos_manager::SheetPosManager;

pub struct Converter<'a> {
    pub sheet_pos_manager: &'a SheetPosManager,
    pub navigator: &'a mut Navigator,
    pub container: &'a mut DataContainer,
    pub text_id_manager: &'a mut TextIdManager,
}

impl<'a> Converter<'a> {
    pub fn convert_edit_payloads(&mut self, payloads: Vec<EditPayload>) -> Vec<Process> {
        let mut res = Vec::<Process>::with_capacity(payloads.len());
        payloads.into_iter().for_each(|c| {
            let proc = match c {
                EditPayload::CellInput(c) => self.convert_cell_input(c),
                EditPayload::RowShift(rs) => self.convert_row_shift(rs),
                EditPayload::ColShift(cs) => self.convert_col_shift(cs),
                EditPayload::StyleUpdate(su) => self.convert_style_update(su),
                EditPayload::CreateBlock(cb) => self.convert_create_block(cb),
                EditPayload::MoveBlock(mb) => self.convert_move_block(mb),
                EditPayload::LineShiftInBlock(input) => self.convert_line_shift_in_block(input),
                EditPayload::BlockInput(_) => todo!(),
                EditPayload::BlockStyleUpdate(_) => todo!(),
                EditPayload::SheetRename(sheet_rename) => {
                    Some(Process::SheetRename(SheetRenamePayload {
                        old_name: sheet_rename.old_name,
                        new_name: sheet_rename.new_name,
                    }))
                }
                EditPayload::SetColWidth(scw) => self.convert_set_col_width(scw),
                EditPayload::SetRowHeight(srh) => self.convert_set_row_height(srh),
                EditPayload::SetVisible(_) => todo!(),
            };
            match proc {
                Some(p) => {
                    res.push(p);
                }
                None => (),
            }
        });
        res
    }

    fn convert_set_row_height(&mut self, srh: SetRowHeight) -> Option<Process> {
        let sheet_id = self.sheet_pos_manager.get_sheet_id(srh.sheet_idx)?;
        let line_payload = LinePayload {
            idx: srh.row,
            change: LineInfoUpdate::Row(RowInfoUpdate::Height(srh.height)),
        };
        let sp = SheetProcess {
            sheet_id,
            payload: SheetPayload::Line(line_payload),
        };
        Some(Process::Sheet(sp))
    }

    fn convert_set_col_width(&mut self, scw: SetColWidth) -> Option<Process> {
        let sheet_id = self.sheet_pos_manager.get_sheet_id(scw.sheet_idx)?;
        let line_payload = LinePayload {
            idx: scw.col,
            change: LineInfoUpdate::Col(ColInfoUpdate::Width(scw.width)),
        };
        let sp = SheetProcess {
            sheet_id,
            payload: SheetPayload::Line(line_payload),
        };
        Some(Process::Sheet(sp))
    }

    fn convert_style_update(&mut self, su: StyleUpdate) -> Option<Process> {
        let StyleUpdate {
            sheet_idx,
            row,
            col,
            ty,
        } = su;
        let sheet_id = self.sheet_pos_manager.get_sheet_id(sheet_idx)?;
        let cell_style_payload = get_style_payload(ty);
        let p = CellPayload {
            row,
            col,
            change: CellChange::DiffStyle(cell_style_payload),
        };
        Some(Process::Sheet(SheetProcess {
            sheet_id,
            payload: SheetPayload::Cell(p),
        }))
    }

    fn convert_row_shift(&self, rs: RowShift) -> Option<Process> {
        let sheet_id = self.sheet_pos_manager.get_sheet_id(rs.sheet_idx)?;
        let ls = LineShift {
            start: rs.row,
            cnt: rs.count as u32,
            ty: if rs.insert {
                ShiftType::Insert
            } else {
                ShiftType::Delete
            },
            direction: Direction::Horizontal,
        };
        let sp = SheetPayload::Shift(ShiftPayload::Line(ls));
        let proc = SheetProcess {
            sheet_id,
            payload: sp,
        };
        Some(Process::Sheet(proc))
    }

    fn convert_col_shift(&self, cs: ColShift) -> Option<Process> {
        let sheet_id = self.sheet_pos_manager.get_sheet_id(cs.sheet_idx)?;
        let ls = LineShift {
            start: cs.col,
            cnt: cs.count as u32,
            ty: if cs.insert {
                ShiftType::Insert
            } else {
                ShiftType::Delete
            },
            direction: Direction::Vertical,
        };
        let sp = SheetPayload::Shift(ShiftPayload::Line(ls));
        let proc = SheetProcess {
            sheet_id,
            payload: sp,
        };
        Some(Process::Sheet(proc))
    }

    fn convert_cell_input(&mut self, input: CellInput) -> Option<Process> {
        let CellInput {
            sheet_idx,
            row,
            col,
            content,
        } = input;
        let sheet_id = self.sheet_pos_manager.get_sheet_id(sheet_idx)?;
        let payload = get_input_payload(row, col, content, &mut |t| self.text_id_manager.get_id(t));
        Some(Process::Sheet(SheetProcess { sheet_id, payload }))
    }

    fn convert_create_block(&mut self, input: CreateBlock) -> Option<Process> {
        let CreateBlock {
            sheet_idx,
            id,
            master_row,
            master_col,
            row_cnt,
            col_cnt,
        } = input;
        let sheet_id = self.sheet_pos_manager.get_sheet_id(sheet_idx)?;
        let payload = SheetPayload::Block(BlockPayload::Create(EditCreateBlock {
            block_id: id as BlockId,
            master_row,
            master_col,
            row_cnt,
            col_cnt,
        }));
        Some(Process::Sheet(SheetProcess { sheet_id, payload }))
    }

    fn convert_move_block(&mut self, input: MoveBlock) -> Option<Process> {
        let MoveBlock {
            sheet_idx,
            id,
            new_master_row,
            new_master_col,
        } = input;
        let sheet_id = self.sheet_pos_manager.get_sheet_id(sheet_idx)?;
        let payload = SheetPayload::Block(BlockPayload::Move(EditMoveBlock {
            block_id: id as BlockId,
            new_master_row,
            new_master_col,
        }));
        Some(Process::Sheet(SheetProcess { sheet_id, payload }))
    }

    fn convert_line_shift_in_block(&mut self, input: LineShiftInBlock) -> Option<Process> {
        let LineShiftInBlock {
            sheet_idx,
            block_id: id,
            idx,
            cnt,
            horizontal,
            insert,
        } = input;
        let sheet_id = self.sheet_pos_manager.get_sheet_id(sheet_idx)?;
        let payload = match (insert, horizontal) {
            (true, true) => {
                let p = BlockInsertRowsPayload {
                    block_id: id as BlockId,
                    insert_cnt: cnt,
                    idx,
                };
                BlockPayload::InsertRows(p)
            }
            (true, false) => {
                let p = BlockInsertColsPayload {
                    block_id: id as BlockId,
                    insert_cnt: cnt,
                    idx,
                };
                BlockPayload::InsertCols(p)
            }
            (false, true) => {
                let p = BlockDeleteRowsPayload {
                    block_id: id as BlockId,
                    delete_cnt: cnt,
                    idx,
                };
                BlockPayload::DeleteRows(p)
            }
            (false, false) => {
                let p = BlockDeleteColsPayload {
                    block_id: id as BlockId,
                    delete_cnt: cnt,
                    idx,
                };
                BlockPayload::DeleteCols(p)
            }
        };
        Some(Process::Sheet(SheetProcess {
            sheet_id,
            payload: SheetPayload::Block(payload),
        }))
    }
}

fn get_input_payload<F>(
    row: usize,
    col: usize,
    mut content: String,
    fetcher: &mut F,
) -> SheetPayload
where
    F: FnMut(&str) -> TextId,
{
    let (formula, content) = if content.starts_with('=') {
        (true, content.split_off(1))
    } else {
        (false, content)
    };
    if formula {
        let f = FormulaPayload {
            row,
            col,
            formula: content,
        };
        SheetPayload::Formula(f)
    } else {
        let cell_value = CellValue::from_string(content, fetcher);
        SheetPayload::Cell(CellPayload {
            row,
            col,
            change: CellChange::Value(cell_value),
        })
    }
}

fn get_style_payload(sut: StyleUpdateType) -> Vec<CellStylePayload> {
    let mut result = Vec::<CellStylePayload>::new();
    if let Some(fb) = sut.set_font_bold {
        result.push(CellStylePayload::Font(FontPayloadType::Bold(fb)));
    }
    if let Some(fi) = sut.set_font_italic {
        result.push(CellStylePayload::Font(FontPayloadType::Italic(fi)));
    }
    if let Some(fs) = sut.set_font_size {
        result.push(CellStylePayload::Font(FontPayloadType::Size(fs)));
    }
    if let Some(fs) = sut.set_font_shadow {
        result.push(CellStylePayload::Font(FontPayloadType::Shadow(fs)));
    }
    // todo!()
    result
}
