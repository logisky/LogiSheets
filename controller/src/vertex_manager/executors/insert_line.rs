use crate::vertex_manager::vertex::{MutReferenceVertex, SheetRangeVertex, StsRangeVertex};

use super::super::context::ContextTrait;
use super::base::{AffectResult, ExecuteResult, SubPayload};
use super::utils::{handle_sheet_range_affect_result, handle_sts_affect_result};
use controller_base::{CellId, SheetId};
use im::HashSet;
pub struct InsertLine {
    pub sheet_id: SheetId,
    pub start: usize,
    pub cnt: u32,
    pub is_row: bool,
}

impl SubPayload for InsertLine {
    fn affect_sheet_range<T>(&self, srv: &SheetRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        if is_affected_srv(srv, &self, ctx) {
            AffectResult::DirtyOnly
        } else {
            AffectResult::None
        }
    }

    fn affect_sts<T>(&self, sts: &StsRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        if is_affected_sts(sts, &self, ctx) {
            AffectResult::DirtyOnly
        } else {
            AffectResult::None
        }
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

fn is_affected_sts<T>(sts: &StsRangeVertex, p: &InsertLine, ctx: &mut T) -> bool
where
    T: ContextTrait,
{
    let sheet_start_idx = ctx.fetch_sheet_index(sts.start);
    let sheet_end_idx = ctx.fetch_sheet_index(sts.end);
    if sheet_start_idx.is_none() || sheet_end_idx.is_none() {
        return false;
    }
    let curr_sheet = ctx.fetch_sheet_index(p.sheet_id);
    if curr_sheet.is_none() {
        return false;
    }
    let curr_sheet = curr_sheet.unwrap();
    let sheet_start_idx = sheet_start_idx.unwrap();
    let sheet_end_idx = sheet_end_idx.unwrap();
    if sheet_end_idx < curr_sheet || sheet_start_idx > curr_sheet {
        return false;
    }
    true // TODO: Optimize here
}

fn is_affected_srv<T>(srv: &SheetRangeVertex, p: &InsertLine, ctx: &mut T) -> bool
where
    T: ContextTrait,
{
    if srv.sheet_id != p.sheet_id {
        return false;
    }
    match &srv.reference {
        MutReferenceVertex::ColRange(cr) => {
            if p.is_row {
                return true;
            }
            let start_idx = ctx.fetch_col_index(p.sheet_id, cr.start);
            let end_idx = ctx.fetch_col_index(p.sheet_id, cr.end);
            match (start_idx, end_idx) {
                (Some(start_idx), Some(end_idx)) => start_idx < p.start && p.start <= end_idx,
                _ => false,
            }
        }
        MutReferenceVertex::RowRange(rr) => {
            if !p.is_row {
                return true;
            }
            let start_idx = ctx.fetch_row_index(p.sheet_id, rr.start);
            let end_idx = ctx.fetch_row_index(p.sheet_id, rr.end);
            match (start_idx, end_idx) {
                (Some(start_idx), Some(end_idx)) => start_idx < p.start && p.start <= end_idx,
                _ => false,
            }
        }
        MutReferenceVertex::AddrRange(addr) => {
            if matches!(&addr.start, CellId::BlockCell(_))
                || matches!(&addr.end, CellId::BlockCell(_))
            {
                return false;
            }
            let start = ctx.fetch_cell_index(p.sheet_id, &addr.start);
            let end = ctx.fetch_cell_index(p.sheet_id, &addr.end);
            match (start, end) {
                (Some(start_idx), Some(end_idx)) => {
                    if p.is_row {
                        start_idx.0 < p.start && p.start <= end_idx.0
                    } else {
                        start_idx.1 < p.start && p.start <= end_idx.1
                    }
                }
                _ => false,
            }
        }
    }
}
