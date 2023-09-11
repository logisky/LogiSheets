use crate::{errors::BasicError, BlockCellId, CellId, ColId, NormalCellId, RowId, SheetId};

pub trait IndexFetcherTrait {
    fn fetch_row_index(&self, sheet_id: &SheetId, row_id: &RowId) -> Result<usize, BasicError>;

    fn fetch_col_index(&self, sheet_id: &SheetId, col_id: &ColId) -> Result<usize, BasicError>;

    fn fetch_cell_index(
        &self,
        sheet_id: &SheetId,
        cell_id: &CellId,
    ) -> Result<(usize, usize), BasicError>;

    fn fetch_sheet_index(&self, sheet_id: &SheetId) -> Result<usize, BasicError>;

    fn fetch_normal_cell_index(
        &self,
        sheet_id: &SheetId,
        normal_cell_id: &NormalCellId,
    ) -> Result<(usize, usize), BasicError>;

    fn fetch_block_cell_index(
        &self,
        sheet: &SheetId,
        block_cell_id: &BlockCellId,
    ) -> Result<(usize, usize), BasicError>;
}
