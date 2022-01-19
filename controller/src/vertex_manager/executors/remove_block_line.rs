use super::super::context::ContextTrait;
use super::base::{AffectResult, ExecuteResult, SubPayload};
use super::utils::{
    delete_and_get_new, handle_sheet_range_affect_result, handle_sts_affect_result,
};
use crate::vertex_manager::executors::utils::delete_cells;
use crate::vertex_manager::vertex::{
    MutAddrRange, MutReferenceVertex, SheetRangeVertex, StsRangeVertex,
};
use controller_base::CellId;
use controller_base::{BlockId, SheetId};
use im::HashSet;

pub struct RemoveBlockLine {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub is_row: bool,
    pub idx: usize,
    pub cnt: usize,
}

impl SubPayload for RemoveBlockLine {
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
                    if self.is_row {
                        let remove_start = mc_row + self.idx;
                        let remove_end = remove_start + self.cnt - 1;
                        if remove_end < range_sr || remove_start > range_er {
                            AffectResult::None
                        } else if remove_end < range_er && remove_start > range_sr {
                            AffectResult::DirtyOnly
                        } else {
                            if let Some((new_sr, new_er)) =
                                delete_and_get_new(range_sr, range_er, remove_start, remove_end)
                            {
                                let start_id =
                                    ctx.fetch_cell_id(self.sheet_id, new_sr, range_sr).unwrap();
                                let end_id =
                                    ctx.fetch_cell_id(self.sheet_id, new_er, range_ec).unwrap();
                                if matches!(start_id, CellId::BlockCell(_))
                                    && matches!(end_id, CellId::BlockCell(_))
                                {
                                    AffectResult::UpdateWith(SheetRangeVertex {
                                        sheet_id: self.sheet_id,
                                        reference: MutReferenceVertex::AddrRange(MutAddrRange {
                                            start: start_id,
                                            end: end_id,
                                        }),
                                    })
                                } else {
                                    AffectResult::Removed
                                }
                            } else {
                                AffectResult::None
                            }
                        }
                    } else {
                        let remove_start = mc_col + self.idx;
                        let remove_end = remove_start + self.cnt - 1;
                        if remove_end < range_sc || remove_start > range_ec {
                            AffectResult::None
                        } else if remove_end < range_ec && remove_start > range_sc {
                            AffectResult::DirtyOnly
                        } else {
                            if let Some((new_sc, new_ec)) =
                                delete_and_get_new(range_sc, range_ec, remove_start, remove_end)
                            {
                                let start_id =
                                    ctx.fetch_cell_id(self.sheet_id, range_sr, new_sc).unwrap();
                                let end_id =
                                    ctx.fetch_cell_id(self.sheet_id, range_er, new_ec).unwrap();
                                if matches!(start_id, CellId::BlockCell(_))
                                    && matches!(end_id, CellId::BlockCell(_))
                                {
                                    AffectResult::UpdateWith(SheetRangeVertex {
                                        sheet_id: self.sheet_id,
                                        reference: MutReferenceVertex::AddrRange(MutAddrRange {
                                            start: start_id,
                                            end: end_id,
                                        }),
                                    })
                                } else {
                                    AffectResult::Removed
                                }
                            } else {
                                AffectResult::None
                            }
                        }
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
        let to_be_deleted = context
            .get_block_cells_by_line(
                self.sheet_id,
                self.block_id,
                self.idx,
                self.cnt,
                self.is_row,
            )
            .into_iter()
            .map(|b| (self.sheet_id, CellId::BlockCell(b)))
            .collect::<Vec<_>>();
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
