use im::HashMap;
use logisheets_base::{NormalCellId, SheetId};

#[derive(Debug, Clone, Default)]
pub struct MergeCells {
    // The 1st CellId is the id of the start cell.
    // The 2nd CellId is the id of the end cell.
    pub data: HashMap<SheetId, HashMap<NormalCellId, NormalCellId>>,
}

impl MergeCells {
    // todo: remove this
    pub fn add_merge_cell(
        self,
        sheet_id: SheetId,
        start_cell: NormalCellId,
        end_cell: NormalCellId,
    ) -> Self {
        let mut set = self
            .data
            .get(&sheet_id)
            .map_or(HashMap::new(), |s| s.clone());
        set.insert(start_cell, end_cell);
        let new_data = self.data.update(sheet_id, set);
        MergeCells { data: new_data }
    }

    pub fn add_merge_cell2(
        &mut self,
        sheet_id: SheetId,
        start_cell: NormalCellId,
        end_cell: NormalCellId,
    ) {
        match self.data.get_mut(&sheet_id) {
            Some(m) => {
                m.insert(start_cell, end_cell);
            }
            None => {
                let mut sheet = HashMap::<NormalCellId, NormalCellId>::new();
                sheet.insert(start_cell, end_cell);
                self.data.insert(sheet_id, sheet);
            }
        }
    }

    pub fn remove_merge_cell(self, sheet_id: SheetId, start_cell: NormalCellId) -> Self {
        let set = self.data.get(&sheet_id);
        match set {
            Some(s) => {
                let new_set = s.clone().without(&start_cell);
                let new_data = self.data.update(sheet_id, new_set);
                MergeCells { data: new_data }
            }
            None => self,
        }
    }

    pub fn get_merge_cell(
        &self,
        sheet_id: &SheetId,
        start_cell: &NormalCellId,
    ) -> Option<(NormalCellId, NormalCellId)> {
        let end_cell = self.data.get(sheet_id)?.get(start_cell)?;
        Some((start_cell.clone(), end_cell.clone()))
    }
}
