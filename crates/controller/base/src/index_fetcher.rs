use crate::{BlockCellId, NormalCellId};

use super::{CellId, ColId, RowId, SheetId};

pub trait IndexFetcherTrait {
    fn fetch_row_index(&mut self, sheet_id: &SheetId, row_id: &RowId) -> Option<usize>;

    fn fetch_col_index(&mut self, sheet_id: &SheetId, col_id: &ColId) -> Option<usize>;

    fn fetch_cell_index(&mut self, sheet_id: &SheetId, cell_id: &CellId) -> Option<(usize, usize)>;

    fn fetch_sheet_index(&mut self, sheet_id: &SheetId) -> Option<usize>;

    fn fetch_normal_cell_index(
        &mut self,
        sheet_id: &SheetId,
        normal_cell_id: &NormalCellId,
    ) -> Option<(usize, usize)>;

    fn fetch_block_cell_index(
        &mut self,
        sheet: &SheetId,
        block_cell_id: &BlockCellId,
    ) -> Option<(usize, usize)>;
}
