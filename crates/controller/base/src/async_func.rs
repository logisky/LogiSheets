use crate::{CellId, SheetId};

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
#[cfg_attr(feature = "gents", gents_derives::gents_header(file_name = "task.ts"))]
pub struct Task {
    pub async_func: String,
    pub args: Vec<String>,
}

pub type AsyncCalcResult = Result<String, AsyncErr>;

#[derive(Debug, Clone)]
pub enum AsyncErr {
    ArgErr,
    TimeOut,
    NotFound,
}

pub trait AsyncFuncCommitTrait {
    fn query_or_commit_task(
        &mut self,
        sheet_id: SheetId,
        cell_id: CellId,
        task: Task,
    ) -> Option<AsyncCalcResult>;
}
