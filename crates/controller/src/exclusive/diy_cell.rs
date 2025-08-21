use imbl::HashMap;
use logisheets_base::{BlockCellId, DiyCellId, SheetId};

/// DiyCell is a unique feature in LogiSheets that allows craft makers to design custom cell types,
/// such as a cell represented by a button.
///
/// On the backend, we simply store a DiyCellId. Craft makers can then associate this ID with their
/// own custom logic or UI representation.
#[derive(Debug, Clone, Default)]
pub struct DiyCellManager {
    next_available_id: DiyCellId,
    data: HashMap<(SheetId, BlockCellId), DiyCellId>,
}

impl DiyCellManager {
    pub fn new() -> Self {
        DiyCellManager {
            next_available_id: 0,
            data: HashMap::new(),
        }
    }

    pub fn create_new_diy_cell(
        &mut self,
        sheet_id: SheetId,
        block_cell_id: BlockCellId,
    ) -> DiyCellId {
        let id = self.next_available_id;
        self.next_available_id += 1;
        self.data.insert((sheet_id, block_cell_id), id);
        id
    }

    pub fn get_diy_cell_id(
        &self,
        sheet_id: SheetId,
        block_cell_id: &BlockCellId,
    ) -> Option<DiyCellId> {
        self.data.get(&(sheet_id, *block_cell_id)).cloned()
    }
}
