use crate::{errors::BasicError, BlockCellId, BlockId, CellId, SheetId};

pub trait BlockAffectTrait {
    fn get_all_block_cells(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
    ) -> Result<Vec<BlockCellId>, BasicError>;
    fn get_master_cell(&self, sheet_id: SheetId, block_id: BlockId) -> Result<CellId, BasicError>;
    fn get_block_cells_by_line(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Result<Vec<BlockCellId>, BasicError>;
    fn get_block_size(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
    ) -> Result<(usize, usize), BasicError>;
    fn get_blocks_across_line(
        &mut self,
        sheet_id: SheetId,
        from_idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Result<Vec<BlockId>, BasicError>;
    fn any_other_blocks_in(
        &mut self,
        sheet_id: SheetId,
        block_id: BlockId,
        start_row: usize,
        end_row: usize,
        start_col: usize,
        end_col: usize,
    ) -> bool;
}
