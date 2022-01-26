use im::{HashMap, HashSet};

use crate::vertex_manager::context::ContextTrait;
use crate::vertex_manager::vertex::{SheetRangeVertex, StsRangeVertex};

use super::super::status::Status;
use super::super::vertex::FormulaId;

pub struct ExecuteResult {
    pub status: Status,
    pub dirty_nodes: HashSet<FormulaId>,
    pub calc_rdeps: HashMap<FormulaId, HashSet<FormulaId>>,
}

pub trait SubPayload {
    fn affect_sheet_range<T>(&self, sts: &SheetRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait;

    fn affect_sts<T>(&self, sts: &StsRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait;

    fn exec<T>(self, prev: ExecuteResult, context: &mut T) -> ExecuteResult
    where
        T: ContextTrait;
}

pub enum AffectResult {
    DirtyOnly,
    Removed,
    // Only sheet range vertex will be updated.
    UpdateWith(SheetRangeVertex),
    None,
}

#[derive(Debug)]
pub enum Direction {
    Horizontal,
    Vertical,
    // Only used in deleting ranges.
    // It means deleting ranges will not cause any movement of
    // cell. Because the area is deleted for placing block cells.
    None,
}
