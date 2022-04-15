use crate::{BlockId, NormalCellId, SheetId};

pub trait BlockAffectedTrait {
    fn get_cells_to_be_deleted(
        &mut self,
        sheet_id: SheetId,
        line_idx: usize, // The index of the row or column to be deleted.
        cnt: usize,
        is_row: bool,
    ) -> Vec<NormalCellId>;

    fn remove(&mut self, sheet_id: SheetId, block_id: BlockId);

    fn get_block_size(&self, sheet_id: SheetId, block_id: BlockId) -> Option<(usize, usize)>;
}
