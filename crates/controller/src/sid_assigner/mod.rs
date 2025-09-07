use logisheets_base::{CellId, SheetId};
use std::collections::HashMap;

#[derive(Debug)]
pub struct ShadowIdAssigner {
    next_id: u64,

    eid_to_cell_id: HashMap<u64, (SheetId, CellId)>,
    cell_id_to_eid: HashMap<(SheetId, CellId), u64>,
}

impl ShadowIdAssigner {
    pub fn new() -> Self {
        Self {
            next_id: u32::MAX as u64,
            eid_to_cell_id: HashMap::new(),
            cell_id_to_eid: HashMap::new(),
        }
    }

    pub fn get_shawdow_id(&mut self, sheet_id: SheetId, cell_id: CellId) -> u64 {
        if let Some(id) = self.cell_id_to_eid.get(&(sheet_id, cell_id)) {
            *id
        } else {
            let id = self.next_id;
            self.next_id += 1;
            self.eid_to_cell_id.insert(id, (sheet_id, cell_id));
            self.cell_id_to_eid.insert((sheet_id, cell_id), id);
            id
        }
    }

    pub fn get_cell_id(&self, eid: u64) -> Option<(SheetId, CellId)> {
        self.eid_to_cell_id.get(&eid).cloned()
    }
}
