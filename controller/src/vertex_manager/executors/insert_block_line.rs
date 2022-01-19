use super::super::context::ContextTrait;
use super::base::{AffectResult, ExecuteResult, SubPayload};
use super::utils::{handle_sheet_range_affect_result, handle_sts_affect_result};
use crate::vertex_manager::vertex::{MutReferenceVertex, SheetRangeVertex, StsRangeVertex};
use controller_base::{BlockId, CellId, SheetId};
use im::HashSet;

pub struct InsertBlockLine {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub is_row: bool,
    pub idx: usize,
    pub cnt: usize,
}

impl SubPayload for InsertBlockLine {
    fn affect_sheet_range<T>(&self, srv: &SheetRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        if srv.sheet_id != self.sheet_id {
            return AffectResult::None;
        }
        match &srv.reference {
            MutReferenceVertex::ColRange(_) => AffectResult::None,
            MutReferenceVertex::RowRange(_) => AffectResult::None,
            MutReferenceVertex::AddrRange(ar) => match (&ar.start, &ar.end) {
                (CellId::BlockCell(start), CellId::BlockCell(end)) => {
                    if start.block_id != self.sheet_id || end.block_id != self.sheet_id {
                        return AffectResult::None;
                    }
                    let (range_sr, range_sc) = ctx
                        .fetch_cell_index(self.sheet_id, &CellId::BlockCell(start.clone()))
                        .unwrap();
                    let (range_er, range_ec) = ctx
                        .fetch_cell_index(self.sheet_id, &CellId::BlockCell(end.clone()))
                        .unwrap();
                    let master_cell = ctx.get_master_cell(self.sheet_id, self.block_id);
                    let (mc_row, mc_col) =
                        ctx.fetch_cell_index(self.sheet_id, &master_cell).unwrap();
                    let (insert_start, insert_end) = if self.is_row {
                        let s = mc_row + self.idx;
                        let e = s + self.cnt - 1;
                        (s, e)
                    } else {
                        let s = mc_col + self.idx;
                        let e = s + self.cnt - 1;
                        (s, e)
                    };
                    let (range_start, range_end) = if self.is_row {
                        (range_sr, range_er)
                    } else {
                        (range_sc, range_ec)
                    };
                    if insert_end < range_start || insert_start > range_end {
                        AffectResult::None
                    } else {
                        AffectResult::DirtyOnly
                    }
                }
                _ => AffectResult::None,
            },
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
