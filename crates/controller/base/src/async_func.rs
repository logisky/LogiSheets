use serde::{Deserialize, Serialize};

use crate::{CellId, SheetId};

#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(feature = "gents", ts(file_name = "task.ts"))]
pub struct Task {
    pub async_func: String,
    pub args: Vec<String>,
}

pub type AsyncCalcResult = Result<String, AsyncErr>;

#[derive(Debug, Clone)]
pub enum AsyncErr {
    ArgErr,
    TimeOut,
}

pub trait AsyncFuncCommitTrait {
    fn query_or_commit_task(
        &mut self,
        sheet_id: SheetId,
        cell_id: CellId,
        task: Task,
    ) -> Option<AsyncCalcResult>;
}
