use controller_base::{CellId, SheetId};

use super::super::context::ContextTrait;
use super::base::{AffectResult, ExecuteResult, SubPayload};
use super::utils::{handle_sheet_range_affect_result, handle_sts_affect_result};
use crate::vertex_manager::executors::utils::{delete_and_get_new, delete_cells};
use crate::vertex_manager::vertex::{
    MutAddrRange, MutColRange, MutReferenceVertex, MutRowRange, SheetRangeVertex, StsRangeVertex,
};
use im::HashSet;

#[derive(Debug)]
pub struct DeleteLine {
    pub sheet_id: SheetId,
    pub start: usize,
    pub cnt: usize,
    pub is_row: bool,
}

impl SubPayload for DeleteLine {
    fn affect_sheet_range<T>(&self, srv: &SheetRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        if srv.sheet_id != self.sheet_id {
            return AffectResult::None;
        }
        match &srv.reference {
            MutReferenceVertex::ColRange(cr) => {
                if self.is_row {
                    return AffectResult::DirtyOnly;
                }
                let range_start = ctx.fetch_col_index(self.sheet_id, cr.start).unwrap();
                let range_end = ctx.fetch_col_index(self.sheet_id, cr.end).unwrap();
                let delete_start = self.start;
                let delete_end = self.start + self.cnt as usize - 1;
                if range_start > delete_end || range_end < delete_start {
                    return AffectResult::None;
                }
                if range_start < delete_start && range_end > delete_end {
                    return AffectResult::DirtyOnly;
                }
                if range_start >= delete_start && range_end <= delete_end {
                    return AffectResult::Removed;
                }
                let (new_start, new_end) =
                    delete_and_get_new(range_start, range_end, delete_start, delete_end).unwrap();
                let new_start = ctx.fetch_col_id(self.sheet_id, new_start).unwrap();
                let new_end = ctx.fetch_col_id(self.sheet_id, new_end).unwrap();
                AffectResult::UpdateWith(SheetRangeVertex {
                    sheet_id: self.sheet_id,
                    reference: MutReferenceVertex::ColRange(MutColRange {
                        start: new_start,
                        end: new_end,
                    }),
                })
            }
            MutReferenceVertex::RowRange(rr) => {
                if !self.is_row {
                    return AffectResult::DirtyOnly;
                }
                let range_start = ctx.fetch_row_index(self.sheet_id, rr.start).unwrap();
                let range_end = ctx.fetch_row_index(self.sheet_id, rr.end).unwrap();
                let delete_start = self.start;
                let delete_end = self.start + self.cnt as usize - 1;
                if range_start > delete_end || range_end < delete_start {
                    return AffectResult::None;
                }
                if range_start < delete_start && range_end > delete_end {
                    return AffectResult::DirtyOnly;
                }
                if range_start >= delete_start && range_end <= delete_end {
                    return AffectResult::Removed;
                }
                let (new_start, new_end) =
                    delete_and_get_new(range_start, range_end, delete_start, delete_end).unwrap();
                let new_start = ctx.fetch_row_id(self.sheet_id, new_start).unwrap();
                let new_end = ctx.fetch_row_id(self.sheet_id, new_end).unwrap();
                AffectResult::UpdateWith(SheetRangeVertex {
                    sheet_id: self.sheet_id,
                    reference: MutReferenceVertex::RowRange(MutRowRange {
                        start: new_start,
                        end: new_end,
                    }),
                })
            }
            MutReferenceVertex::AddrRange(ar) => {
                if matches!(&ar.start, CellId::BlockCell(_))
                    || matches!(&ar.end, CellId::BlockCell(_))
                {
                    return AffectResult::None;
                }
                let (start_row, start_col) =
                    ctx.fetch_cell_index(self.sheet_id, &ar.start).unwrap();
                let (end_row, end_col) = ctx.fetch_cell_index(self.sheet_id, &ar.end).unwrap();
                let delete_start = self.start;
                let delete_end = self.start + self.cnt as usize - 1;
                let (range_start, range_end) = if self.is_row {
                    (start_row, end_row)
                } else {
                    (start_col, end_col)
                };
                if range_start > delete_end || range_end < delete_start {
                    return AffectResult::None;
                }
                if range_start < delete_start && range_end > delete_end {
                    return AffectResult::DirtyOnly;
                }
                if range_start >= delete_start && range_end <= delete_end {
                    return AffectResult::Removed;
                }
                let (new_range_start, new_range_end) =
                    delete_and_get_new(range_start, range_end, delete_start, delete_end).unwrap();
                let (new_start_row, new_start_col, new_end_row, new_end_col) = {
                    if self.is_row {
                        (new_range_start, start_col, new_range_end, end_col)
                    } else {
                        (start_row, new_range_start, end_row, new_range_end)
                    }
                };
                let new_start = ctx.fetch_cell_id(self.sheet_id, new_start_row, new_start_col);
                let new_end = ctx.fetch_cell_id(self.sheet_id, new_end_row, new_end_col);
                if new_start.is_none() || new_end.is_none() {
                    AffectResult::None
                } else {
                    let v = SheetRangeVertex {
                        sheet_id: self.sheet_id,
                        reference: MutReferenceVertex::AddrRange(MutAddrRange {
                            start: new_start.unwrap(),
                            end: new_end.unwrap(),
                        }),
                    };
                    AffectResult::UpdateWith(v)
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
        let to_be_deleted = context.get_deleted_cells();
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
