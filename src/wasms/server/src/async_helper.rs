use std::collections::HashMap;
use xlrs_controller::{CellId, SheetId, Task};

#[derive(Debug)]
pub struct PendingTask {
    pub tasks: Vec<Task>,
    pub dirtys: Vec<(SheetId, CellId)>,
}

#[derive(Debug)]
pub struct AsyncHelper {
    pending: HashMap<u32, PendingTask>,
    next_avail: u32,
}

impl Default for AsyncHelper {
    fn default() -> Self {
        AsyncHelper {
            pending: HashMap::new(),
            next_avail: 1,
        }
    }
}

impl AsyncHelper {
    pub fn add_pending_task(&mut self, task: PendingTask) -> u32 {
        let id = self.next_avail;
        self.pending.insert(id, task);
        let r = self.next_avail;
        self.next_avail += 1;
        r
    }

    pub fn get_pending_task(&mut self, id: u32) -> Option<PendingTask> {
        let (_, task) = self.pending.remove_entry(&id)?;
        Some(task)
    }
}
