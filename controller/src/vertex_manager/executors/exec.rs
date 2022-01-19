use controller_base::matrix_value::cross_product_usize;
use controller_base::{BlockId, CellId, SheetId};

use super::base::{Direction, ExecuteResult, SubPayload};
use super::delete_line::DeleteLine;
use super::input_formula::InputFormula;
use super::input_value::InputValue;
use super::insert_block_line::InsertBlockLine;
use super::insert_line::InsertLine;
use super::remove_block::RemoveBlock;
use super::remove_block_line::RemoveBlockLine;
use super::remove_range::RemoveRange;
use crate::payloads::sheet_process::block::BlockPayload;
use crate::payloads::sheet_process::shift::{
    Direction as PayloadDirection, LineShift, ShiftPayload, ShiftType,
};
use crate::payloads::sheet_process::{CellChange, SheetPayload, SheetProcess};
use crate::vertex_manager::context::ContextTrait;

pub fn exec<T>(prev: ExecuteResult, proc: SheetProcess, ctx: &mut T) -> ExecuteResult
where
    T: ContextTrait,
{
    let sheet_id = proc.sheet_id;
    match proc.payload {
        SheetPayload::Shift(shift) => match shift {
            ShiftPayload::Line(ls) => handle_line_shift(prev, ls, sheet_id, ctx),
            ShiftPayload::Range(_) => todo!(),
        },
        SheetPayload::Formula(f) => {
            let p = InputFormula {
                sheet_id,
                row: f.row,
                col: f.col,
                formula: f.formula,
            };
            p.exec(prev, ctx)
        }
        SheetPayload::Cell(cp) => {
            let row = cp.row;
            let col = cp.col;
            match cp.change {
                CellChange::Value(_) => {
                    let p = InputValue { sheet_id, row, col };
                    p.exec(prev, ctx)
                }
                CellChange::DiffStyle(_) => prev,
                CellChange::Recalc => {
                    let p = InputValue { sheet_id, row, col };
                    p.exec(prev, ctx)
                }
            }
        }
        SheetPayload::Line(_) => prev,
        SheetPayload::Property(_) => prev,
        SheetPayload::Block(b) => handle_block_payload(prev, b, sheet_id, ctx),
    }
}

fn handle_block_payload<T>(
    prev: ExecuteResult,
    b: BlockPayload,
    sheet_id: SheetId,
    ctx: &mut T,
) -> ExecuteResult
where
    T: ContextTrait,
{
    match b {
        BlockPayload::Create(c) => {
            let end_row = c.master_row + c.row_cnt - 1;
            let end_col = c.master_col + c.col_cnt - 1;
            let res = get_blocks(ctx, sheet_id, c.master_row, c.master_col, end_row, end_col)
                .into_iter()
                .fold(prev, |p, block_id| {
                    let sp = RemoveBlock { sheet_id, block_id };
                    sp.exec(p, ctx)
                });
            let start = ctx
                .fetch_cell_id(sheet_id, c.master_row, c.master_col)
                .unwrap();
            let end = ctx.fetch_cell_id(sheet_id, end_row, end_col).unwrap();
            match (start, end) {
                (CellId::NormalCell(s), CellId::NormalCell(e)) => {
                    let sp = RemoveRange {
                        sheet_id,
                        start: s,
                        end: e,
                        direction: Direction::None,
                    };
                    sp.exec(res, ctx)
                }
                _ => res,
            }
        }
        BlockPayload::DeleteCols(dc) => {
            let sp = RemoveBlockLine {
                sheet_id,
                block_id: dc.block_id,
                is_row: false,
                idx: dc.idx,
                cnt: dc.delete_cnt,
            };
            sp.exec(prev, ctx)
        }
        BlockPayload::DeleteRows(dr) => {
            let sp = RemoveBlockLine {
                sheet_id,
                block_id: dr.block_id,
                is_row: true,
                idx: dr.idx,
                cnt: dr.delete_cnt,
            };
            sp.exec(prev, ctx)
        }
        BlockPayload::InsertCols(ic) => {
            let block_id = ic.block_id;
            let mc = ctx.get_master_cell(sheet_id, block_id);
            let (sr, sc) = ctx.fetch_cell_index(sheet_id, &mc).unwrap();
            let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, block_id).unwrap();
            let removed_sc = sc + col_cnt;
            let removed_ec = removed_sc + ic.insert_cnt - 1;
            let res = get_blocks(ctx, sheet_id, sr, removed_sc, sc, removed_ec)
                .into_iter()
                .fold(prev, |p, block_id| {
                    let sp = RemoveBlock { sheet_id, block_id };
                    sp.exec(p, ctx)
                });
            let removed_start = ctx.fetch_cell_id(sheet_id, sr, removed_sc).unwrap();
            let removed_end = ctx
                .fetch_cell_id(sheet_id, sr + row_cnt - 1, removed_ec)
                .unwrap();
            match (removed_start, removed_end) {
                (CellId::NormalCell(s), CellId::NormalCell(e)) => {
                    let sp = RemoveRange {
                        sheet_id,
                        start: s,
                        end: e,
                        direction: Direction::None,
                    };
                    let res = sp.exec(res, ctx);
                    let sp = InsertBlockLine {
                        sheet_id,
                        block_id,
                        is_row: false,
                        idx: ic.idx,
                        cnt: ic.insert_cnt,
                    };
                    sp.exec(res, ctx)
                }
                _ => unreachable!(),
            }
        }
        BlockPayload::InsertRows(ir) => {
            let block_id = ir.block_id;
            let mc = ctx.get_master_cell(sheet_id, block_id);
            let (sr, sc) = ctx.fetch_cell_index(sheet_id, &mc).unwrap();
            let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, block_id).unwrap();
            let removed_sr = sr + row_cnt;
            let removed_er = removed_sr + ir.insert_cnt - 1;
            let res = get_blocks(ctx, sheet_id, removed_sr, sc, removed_er, sc)
                .into_iter()
                .fold(prev, |p, block_id| {
                    let sp = RemoveBlock { sheet_id, block_id };
                    sp.exec(p, ctx)
                });
            let removed_start = ctx.fetch_cell_id(sheet_id, removed_sr, sc).unwrap();
            let removed_end = ctx
                .fetch_cell_id(sheet_id, removed_er, sc + col_cnt - 1)
                .unwrap();
            match (removed_start, removed_end) {
                (CellId::NormalCell(s), CellId::NormalCell(e)) => {
                    let sp = RemoveRange {
                        sheet_id,
                        start: s,
                        end: e,
                        direction: Direction::None,
                    };
                    let res = sp.exec(res, ctx);
                    let sp = InsertBlockLine {
                        sheet_id,
                        block_id,
                        is_row: true,
                        idx: ir.idx,
                        cnt: ir.insert_cnt,
                    };
                    sp.exec(res, ctx)
                }
                _ => unreachable!(),
            }
        }
        BlockPayload::Move(m) => {
            let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, m.block_id).unwrap();
            let end_row = m.new_master_row + row_cnt - 1;
            let end_col = m.new_master_col + col_cnt - 1;
            let res = get_blocks(
                ctx,
                sheet_id,
                m.new_master_row,
                m.new_master_col,
                end_row,
                end_col,
            )
            .into_iter()
            .fold(prev, |p, block_id| {
                let sp = RemoveBlock { sheet_id, block_id };
                sp.exec(p, ctx)
            });
            let start = ctx
                .fetch_cell_id(sheet_id, m.new_master_row, m.new_master_col)
                .unwrap();
            let end = ctx.fetch_cell_id(sheet_id, end_row, end_col).unwrap();
            match (start, end) {
                (CellId::NormalCell(s), CellId::NormalCell(e)) => {
                    let sp = RemoveRange {
                        sheet_id,
                        start: s,
                        end: e,
                        direction: Direction::None,
                    };
                    sp.exec(res, ctx)
                }
                _ => res,
            }
        }
        BlockPayload::Remove(r) => {
            let sp = RemoveBlock {
                sheet_id,
                block_id: r.block_id,
            };
            sp.exec(prev, ctx)
        }
    }
}

fn get_blocks<T>(
    ctx: &mut T,
    sheet_id: SheetId,
    sr: usize,
    sc: usize,
    er: usize,
    ec: usize,
) -> Vec<BlockId>
where
    T: ContextTrait,
{
    cross_product_usize(sr, er, sc, ec)
        .into_iter()
        .fold(vec![], |mut prev, (r, c)| {
            let cid = ctx.fetch_cell_id(sheet_id, r, c);
            if let Some(CellId::BlockCell(b)) = cid {
                prev.push(b.block_id);
                prev
            } else {
                prev
            }
        })
}

fn handle_line_shift<T>(
    prev: ExecuteResult,
    ls: LineShift,
    sheet_id: SheetId,
    ctx: &mut T,
) -> ExecuteResult
where
    T: ContextTrait,
{
    match (&ls.ty, &ls.direction) {
        (ShiftType::Delete, PayloadDirection::Horizontal) => {
            let p = DeleteLine {
                sheet_id,
                start: ls.start,
                cnt: ls.cnt as usize,
                is_row: true,
            };
            let res = p.exec(prev, ctx);
            let cnt = ls.cnt as usize;
            let blocks = ctx.get_blocks_across_line(sheet_id, ls.start, cnt, true);
            let res = blocks.into_iter().fold(res, |p, b| {
                let (b_row, b_col) = ctx.get_block_size(sheet_id, b).unwrap();
                let master_cell = ctx.get_master_cell(sheet_id, b);
                let (m_row, m_col) = ctx.fetch_cell_index(sheet_id, &master_cell).unwrap();
                let removed_sr = m_row + b_row - 1;
                let removed_er = removed_sr + cnt - 1;
                let removed_ec = b_col + m_col - 1;
                let blocks = get_blocks(ctx, sheet_id, removed_sr, m_col, removed_er, removed_ec);
                let result = blocks.into_iter().fold(p, |pr, b_id| {
                    let sp = RemoveBlock {
                        sheet_id,
                        block_id: b_id,
                    };
                    sp.exec(pr, ctx)
                });
                let removed_start = ctx.fetch_cell_id(sheet_id, removed_sr, m_col).unwrap();
                let removed_end = ctx.fetch_cell_id(sheet_id, removed_er, removed_ec).unwrap();
                match (removed_start, removed_end) {
                    (CellId::NormalCell(start), CellId::NormalCell(end)) => {
                        let sp = RemoveRange {
                            sheet_id,
                            start,
                            end,
                            direction: Direction::None,
                        };
                        sp.exec(result, ctx)
                    }
                    _ => result,
                }
            });
            res
        }
        (ShiftType::Delete, PayloadDirection::Vertical) => {
            let p = DeleteLine {
                sheet_id,
                start: ls.start,
                cnt: ls.cnt as usize,
                is_row: false,
            };
            let res = p.exec(prev, ctx);
            let cnt = ls.cnt as usize;
            let blocks = ctx.get_blocks_across_line(sheet_id, ls.start, cnt, false);
            let res = blocks.into_iter().fold(res, |p, b| {
                let (b_row, b_col) = ctx.get_block_size(sheet_id, b).unwrap();
                let master_cell = ctx.get_master_cell(sheet_id, b);
                let (m_row, m_col) = ctx.fetch_cell_index(sheet_id, &master_cell).unwrap();
                let removed_er = m_row + b_row - 1;
                let removed_sc = m_col + b_col;
                let removed_ec = removed_sc + cnt - 1;
                let blocks = get_blocks(ctx, sheet_id, m_row, removed_sc, removed_er, removed_ec);
                let result = blocks.into_iter().fold(p, |pr, b_id| {
                    let sp = RemoveBlock {
                        sheet_id,
                        block_id: b_id,
                    };
                    sp.exec(pr, ctx)
                });
                let removed_start = ctx.fetch_cell_id(sheet_id, m_row, removed_sc).unwrap();
                let removed_end = ctx.fetch_cell_id(sheet_id, removed_er, removed_ec).unwrap();
                match (removed_start, removed_end) {
                    (CellId::NormalCell(start), CellId::NormalCell(end)) => {
                        let sp = RemoveRange {
                            sheet_id,
                            start,
                            end,
                            direction: Direction::None,
                        };
                        sp.exec(result, ctx)
                    }
                    _ => result,
                }
            });
            res
        }
        (ShiftType::Insert, PayloadDirection::Horizontal) => {
            let p = InsertLine {
                sheet_id,
                start: ls.start,
                cnt: ls.cnt,
                is_row: true,
            };
            p.exec(prev, ctx)
        }
        (ShiftType::Insert, PayloadDirection::Vertical) => {
            let p = InsertLine {
                sheet_id,
                start: ls.start,
                cnt: ls.cnt,
                is_row: false,
            };
            p.exec(prev, ctx)
        }
    }
}
