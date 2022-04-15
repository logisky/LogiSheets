use crate::{BlockCellId, BlockId, CellId, SheetId};

pub trait BlockAffectTrait {
    fn get_all_block_cells(&self, sheet_id: SheetId, block_id: BlockId) -> Vec<BlockCellId>;
    fn get_master_cell(&self, sheet_id: SheetId, block_id: BlockId) -> CellId;
    fn get_block_cells_by_line(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Vec<BlockCellId>;
    fn get_block_size(&self, sheet_id: SheetId, block_id: BlockId) -> Option<(usize, usize)>;
    fn get_blocks_across_line(
        &mut self,
        sheet_id: SheetId,
        from_idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Vec<BlockId>;
}
