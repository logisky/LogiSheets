use super::super::context::ContextTrait;
use super::base::AffectResult;
use super::base::ExecuteResult;
use super::utils::handle_sheet_range_affect_result;
use super::utils::handle_sts_affect_result;
use crate::vertex_manager::vertex::{SheetRangeVertex, StsRangeVertex};
use im::HashSet;
use logisheets_base::SheetId;

use super::base::SubPayload;
use super::input_formula::affect_sheet_range;

#[derive(Debug)]
pub struct InputValue {
    pub sheet_id: SheetId,
    pub row: usize,
    pub col: usize,
}

impl SubPayload for InputValue {
    fn affect_sheet_range<T>(&self, sr: &SheetRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        affect_sheet_range(sr, self.sheet_id, self.row, self.col, ctx)
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
        let cell_id = context
            .fetch_cell_id(self.sheet_id, self.row, self.col)
            .unwrap();
        let mut res = prev;
        res.dirty_nodes = res.dirty_nodes.update((self.sheet_id, cell_id));
        let sheet_ranges = res
            .status
            .range_vertices
            .get(&self.sheet_id)
            .map_or(HashSet::new(), |r| r.clone());
        let res = sheet_ranges.iter().fold(res, |p, sr| {
            let affect_result = self.affect_sheet_range(sr, context);
            handle_sheet_range_affect_result(p, sr, affect_result, Some((self.sheet_id, cell_id)))
        });
        let sts = res.status.sts_vertices.clone();
        let res = sts.iter().fold(res, |p, s| {
            let affect_result = self.affect_sts(s, context);
            handle_sts_affect_result(p, s, affect_result, Some((self.sheet_id, cell_id)))
        });
        res
    }
}
