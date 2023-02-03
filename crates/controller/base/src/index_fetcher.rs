use crate::{BlockCellId, NormalCellId};
use anyhow::Result;

use super::{CellId, ColId, RowId, SheetId};

pub trait IndexFetcherTrait {
    fn fetch_row_index(&mut self, sheet_id: &SheetId, row_id: &RowId) -> Result<usize>;

    fn fetch_col_index(&mut self, sheet_id: &SheetId, col_id: &ColId) -> Result<usize>;

    fn fetch_cell_index(&mut self, sheet_id: &SheetId, cell_id: &CellId) -> Result<(usize, usize)>;

    fn fetch_sheet_index(&mut self, sheet_id: &SheetId) -> Result<usize>;

    fn fetch_normal_cell_index(
        &mut self,
        sheet_id: &SheetId,
        normal_cell_id: &NormalCellId,
    ) -> Result<(usize, usize)>;

    fn fetch_block_cell_index(
        &mut self,
        sheet: &SheetId,
        block_cell_id: &BlockCellId,
    ) -> Result<(usize, usize)>;
}
