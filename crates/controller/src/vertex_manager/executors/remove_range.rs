use super::super::context::ContextTrait;
use super::base::{AffectResult, Direction, ExecuteResult, SubPayload};
use super::utils::{
    delete_and_get_new, delete_cells, handle_sheet_range_affect_result, handle_sts_affect_result,
};
use crate::vertex_manager::vertex::{
    FormulaId, MutAddrRange, MutReferenceVertex, SheetRangeVertex, StsRangeVertex,
};
use im::HashSet;
use logisheets_base::matrix_value::cross_product_usize;
use logisheets_base::{CellId, NormalCellId, SheetId};

#[derive(Debug)]
pub struct RemoveRange {
    pub sheet_id: SheetId,
    pub start: NormalCellId,
    pub end: NormalCellId,
    pub direction: Direction,
}

impl SubPayload for RemoveRange {
    fn affect_sheet_range<T>(&self, srv: &SheetRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        if self.sheet_id != srv.sheet_id {
            return AffectResult::None;
        }
        let (remove_sr, remove_sc) = ctx
            .fetch_cell_index(self.sheet_id, &CellId::NormalCell(self.start))
            .unwrap();
        let (remove_er, remove_ec) = ctx
            .fetch_cell_index(self.sheet_id, &CellId::NormalCell(self.end))
            .unwrap();
        match (&self.direction, &srv.reference) {
            (Direction::Horizontal, MutReferenceVertex::RowRange(rr)) => {
                let range_start = ctx.fetch_row_index(self.sheet_id, rr.start).unwrap();
                let range_end = ctx.fetch_row_index(self.sheet_id, rr.end).unwrap();
                if remove_er < range_start || remove_sr > range_end {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Vertical, MutReferenceVertex::RowRange(rr)) => {
                let range_end = ctx.fetch_row_index(self.sheet_id, rr.end).unwrap();
                if remove_sr > range_end {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Horizontal, MutReferenceVertex::ColRange(cr)) => {
                let range_end = ctx.fetch_col_index(self.sheet_id, cr.end).unwrap();
                if remove_sc > range_end {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Vertical, MutReferenceVertex::ColRange(cr)) => {
                let range_start = ctx.fetch_col_index(self.sheet_id, cr.start).unwrap();
                let range_end = ctx.fetch_col_index(self.sheet_id, cr.end).unwrap();
                if remove_ec < range_start || remove_sc > range_end {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Horizontal, MutReferenceVertex::AddrRange(_)) => {
                todo!()
            }
            (Direction::Vertical, MutReferenceVertex::AddrRange(_)) => {
                todo!()
            }
            (Direction::None, MutReferenceVertex::RowRange(rr)) => {
                let range_start = ctx.fetch_row_index(self.sheet_id, rr.start).unwrap();
                let range_end = ctx.fetch_row_index(self.sheet_id, rr.end).unwrap();
                if range_start > remove_er || range_end < remove_sr {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::None, MutReferenceVertex::ColRange(cr)) => {
                let range_start = ctx.fetch_col_index(self.sheet_id, cr.start).unwrap();
                let range_end = ctx.fetch_col_index(self.sheet_id, cr.end).unwrap();
                if range_start > remove_ec || range_end < remove_sc {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::None, MutReferenceVertex::AddrRange(ar)) => {
                if matches!(&ar.start, CellId::BlockCell(_))
                    || matches!(&ar.end, CellId::BlockCell(_))
                {
                    return AffectResult::None;
                }
                let (range_sr, range_sc) = ctx.fetch_cell_index(self.sheet_id, &ar.start).unwrap();
                let (range_er, range_ec) = ctx.fetch_cell_index(self.sheet_id, &ar.end).unwrap();
                if remove_er < range_sr || remove_sr > range_er {
                    AffectResult::None
                } else if remove_ec < range_sc || remove_sc > range_ec {
                    AffectResult::None
                } else {
                    if remove_ec >= range_ec && remove_sc <= range_sc {
                        if let Some((new_row_start, new_row_end)) =
                            delete_and_get_new(range_sr, range_er, remove_sr, remove_sc)
                        {
                            let new_start = ctx
                                .fetch_cell_id(self.sheet_id, new_row_start, range_sc)
                                .unwrap();
                            let new_end = ctx
                                .fetch_cell_id(self.sheet_id, new_row_end, range_ec)
                                .unwrap();
                            let v = SheetRangeVertex {
                                sheet_id: self.sheet_id,
                                reference: MutReferenceVertex::AddrRange(MutAddrRange {
                                    start: new_start,
                                    end: new_end,
                                }),
                            };
                            AffectResult::UpdateWith(v)
                        } else {
                            AffectResult::None
                        }
                    } else if remove_er >= range_er && remove_sr <= range_sr {
                        if let Some((new_col_start, new_col_end)) =
                            delete_and_get_new(range_sc, range_ec, remove_sc, remove_ec)
                        {
                            let new_start = ctx
                                .fetch_cell_id(self.sheet_id, range_sr, new_col_start)
                                .unwrap();
                            let new_end = ctx
                                .fetch_cell_id(self.sheet_id, range_er, new_col_end)
                                .unwrap();
                            let v = SheetRangeVertex {
                                sheet_id: self.sheet_id,
                                reference: MutReferenceVertex::AddrRange(MutAddrRange {
                                    start: new_start,
                                    end: new_end,
                                }),
                            };
                            AffectResult::UpdateWith(v)
                        } else {
                            AffectResult::None
                        }
                    } else {
                        AffectResult::Removed
                    }
                }
            }
        }
    }

    fn affect_sts<T>(&self, _: &StsRangeVertex, _: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        AffectResult::DirtyOnly
    }

    fn exec<T>(self, prev: ExecuteResult, context: &mut T) -> ExecuteResult
    where
        T: ContextTrait,
    {
        let (start_row, start_col) = context
            .fetch_cell_index(self.sheet_id, &CellId::NormalCell(self.start))
            .unwrap();
        let (end_row, end_col) = context
            .fetch_cell_index(self.sheet_id, &CellId::NormalCell(self.end))
            .unwrap();
        let to_be_deleted = cross_product_usize(start_row, end_row, start_col, end_col)
            .into_iter()
            .fold(Vec::<FormulaId>::new(), |mut prev, (r, c)| {
                let cell_id = context.get_norm_cell_id(self.sheet_id, r, c).unwrap();
                prev.push((self.sheet_id, CellId::NormalCell(cell_id)));
                prev
            });
        let res = delete_cells(prev, to_be_deleted);
        let sheet_ranges = res
            .status
            .range_vertices
            .get(&self.sheet_id)
            .map_or(HashSet::new(), |r| r.clone());
        let res = sheet_ranges.iter().fold(res, |p, sr| {
            let affect_result = self.affect_sheet_range(sr, context);
            handle_sheet_range_affect_result(p, sr, affect_result, None)
        });
        let sts = res.status.sts_vertices.clone();
        let res = sts.iter().fold(res, |p, s| {
            let affect_result = self.affect_sts(s, context);
            handle_sts_affect_result(p, s, affect_result, None)
        });
        res
    }
}
