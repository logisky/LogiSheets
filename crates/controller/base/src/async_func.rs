use crate::{CellId, SheetId};
use gents_derives::TS;

#[derive(Debug, Clone, Hash, PartialEq, Eq, TS)]
#[ts(file_name = "task.ts", rename_all = "camelCase")]
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
