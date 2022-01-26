use controller_base::{BlockId, CellId, SheetId};
use im::HashSet;

use super::super::context::ContextTrait;
use super::base::{AffectResult, ExecuteResult, SubPayload};
use super::utils::{handle_sheet_range_affect_result, handle_sts_affect_result};
use crate::vertex_manager::executors::utils::delete_cells;
use crate::vertex_manager::vertex::{MutReferenceVertex, SheetRangeVertex};

#[derive(Debug)]
pub struct RemoveBlock {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
}

impl SubPayload for RemoveBlock {
    fn affect_sheet_range<T>(&self, srv: &SheetRangeVertex, _: &mut T) -> AffectResult
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
                (CellId::BlockCell(b1), CellId::BlockCell(b2)) => {
                    if b1.block_id == self.block_id || b2.block_id == self.block_id {
                        AffectResult::Removed
                    } else {
                        AffectResult::None
                    }
                }
                _ => AffectResult::None,
            },
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
        let cells = context
            .get_all_block_cells(self.sheet_id, self.block_id)
            .into_iter()
            .map(|b| (self.sheet_id, CellId::BlockCell(b)))
            .collect::<Vec<_>>();
        let res = delete_cells(prev, cells);
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
