use super::super::context::ContextTrait;
use super::base::{AffectResult, Direction, ExecuteResult, SubPayload};
use super::utils::{handle_sheet_range_affect_result, handle_sts_affect_result};
use crate::vertex_manager::vertex::{MutReferenceVertex, SheetRangeVertex};
use im::HashSet;
use logisheets_base::{CellId, SheetId};

#[derive(Debug)]
pub struct InsertRange {
    pub sheet_id: SheetId,
    pub row: usize,
    pub col: usize,
    pub row_cnt: u32,
    pub col_cnt: u32,
    pub direction: Direction,
}

impl SubPayload for InsertRange {
    fn affect_sheet_range<T>(&self, srv: &SheetRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        if self.sheet_id != srv.sheet_id {
            return AffectResult::None;
        }
        match (&self.direction, &srv.reference) {
            (Direction::Horizontal, MutReferenceVertex::RowRange(rr)) => {
                let insert_start = self.row;
                let insert_end = self.row + self.row_cnt as usize - 1;
                let range_start = ctx.fetch_row_index(self.sheet_id, rr.start).unwrap();
                let range_end = ctx.fetch_row_index(self.sheet_id, rr.end).unwrap();
                if insert_end < range_start || insert_start > range_end {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Vertical, MutReferenceVertex::RowRange(rr)) => {
                let insert_start = self.row;
                let range_end = ctx.fetch_row_index(self.sheet_id, rr.end).unwrap();
                if insert_start > range_end {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Horizontal, MutReferenceVertex::ColRange(cr)) => {
                let insert_start = self.col;
                let range_end = ctx.fetch_col_index(self.sheet_id, cr.end).unwrap();
                if insert_start > range_end {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Vertical, MutReferenceVertex::ColRange(cr)) => {
                let insert_start = self.col;
                let insert_end = self.col + self.col_cnt as usize - 1;
                let range_start = ctx.fetch_col_index(self.sheet_id, cr.start).unwrap();
                let range_end = ctx.fetch_col_index(self.sheet_id, cr.end).unwrap();
                if insert_end < range_start || insert_start > range_end {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Horizontal, MutReferenceVertex::AddrRange(ar)) => {
                if matches!(&ar.start, CellId::BlockCell(_))
                    || matches!(&ar.end, CellId::BlockCell(_))
                {
                    return AffectResult::None;
                }
                let (range_sr, _) = ctx.fetch_cell_index(self.sheet_id, &ar.start).unwrap();
                let (range_er, range_ec) = ctx.fetch_cell_index(self.sheet_id, &ar.end).unwrap();
                let insert_sr = self.row;
                let insert_er = self.row + self.row_cnt as usize - 1;
                let insert_sc = self.col;
                if insert_er < range_sr || insert_sr > range_er {
                    AffectResult::None
                } else if insert_sc > range_ec {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::Vertical, MutReferenceVertex::AddrRange(ar)) => {
                if matches!(&ar.start, CellId::BlockCell(_))
                    || matches!(&ar.end, CellId::BlockCell(_))
                {
                    return AffectResult::None;
                }
                let (_, range_sc) = ctx.fetch_cell_index(self.sheet_id, &ar.start).unwrap();
                let (range_er, range_ec) = ctx.fetch_cell_index(self.sheet_id, &ar.end).unwrap();
                let insert_sr = self.row;
                let insert_sc = self.col;
                let insert_ec = self.col + self.col_cnt as usize - 1;
                if insert_ec < range_sc || insert_sc > range_ec {
                    AffectResult::None
                } else if insert_sr > range_er {
                    AffectResult::None
                } else {
                    AffectResult::DirtyOnly
                }
            }
            (Direction::None, _) => unreachable!(),
        }
    }

    fn affect_sts<T>(
        &self,
        _: &crate::vertex_manager::vertex::StsRangeVertex,
        _: &mut T,
    ) -> AffectResult
    where
        T: ContextTrait,
    {
        AffectResult::DirtyOnly
    }

    fn exec<T>(self, prev: ExecuteResult, context: &mut T) -> ExecuteResult
    where
        T: ContextTrait,
    {
        let sheet_ranges = prev
            .status
            .range_vertices
            .get(&self.sheet_id)
            .map_or(HashSet::new(), |r| r.clone());
        let res = sheet_ranges.iter().fold(prev, |p, sr| {
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
