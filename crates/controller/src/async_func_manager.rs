use std::collections::HashMap;

use logisheets_base::{
    async_func::{AsyncCalcResult, Task},
    CellId,
};

use crate::SheetId;

#[derive(Default)]
pub struct AsyncFuncManager {
    values: HashMap<Task, AsyncCalcResult>,
    pending: HashMap<Task, Vec<(SheetId, CellId)>>,
}

impl AsyncFuncManager {
    pub fn commit_value(&mut self, t: Task, v: AsyncCalcResult) -> Vec<(SheetId, CellId)> {
        let result = self.pending.remove(&t).unwrap_or_default();
        self.values.insert(t, v);
        result
    }

    pub fn query_or_commit_task(
        &mut self,
        t: Task,
        sheet_id: SheetId,
        cell_id: CellId,
    ) -> Option<AsyncCalcResult> {
        if let Some(res) = self.values.get(&t) {
            Some(res.clone())
        } else {
            let a = self.pending.entry(t).or_insert(vec![]);
            a.push((sheet_id, cell_id));
            None
        }
    }

    pub fn get_calc_tasks(&mut self) -> Vec<Task> {
        self.pending.keys().map(|t| t.clone()).collect::<Vec<_>>()
    }
}
