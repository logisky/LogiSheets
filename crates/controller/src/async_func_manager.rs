use logisheets_base::{
    async_func::{AsyncCalcResult, Task},
    CellId,
};

use crate::SheetId;

#[derive(Default)]
pub struct AsyncFuncManager {
    pub values: std::collections::HashMap<Task, AsyncCalcResult>,
    pub queue: Vec<Task>,
    pub dirties: Vec<(SheetId, CellId)>,
}

impl AsyncFuncManager {
    pub fn add_value(&mut self, t: Task, v: AsyncCalcResult) {
        self.values.insert(t, v);
    }

    pub fn query_or_commit(
        &mut self,
        t: Task,
        sheet_id: SheetId,
        cell_id: CellId,
    ) -> Option<AsyncCalcResult> {
        if let Some(res) = self.values.get(&t) {
            Some(res.clone())
        } else {
            self.dirties.push((sheet_id, cell_id));
            self.queue.push(t);
            None
        }
    }

    pub fn get_calc_tasks(&mut self) -> (Vec<Task>, Vec<(SheetId, CellId)>) {
        let mut empty_tasks = Vec::<Task>::new();
        let mut empty_dirty = Vec::<(SheetId, CellId)>::new();
        std::mem::swap(&mut empty_tasks, &mut self.queue);
        std::mem::swap(&mut empty_dirty, &mut self.dirties);
        (empty_tasks, empty_dirty)
    }
}
