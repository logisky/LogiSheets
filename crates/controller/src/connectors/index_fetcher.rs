use crate::{navigator::Navigator, workbook::sheet_info_manager::SheetInfoManager};
use logisheets_base::{
    errors::{BasicError, Result},
    index_fetcher::IndexFetcherTrait,
    BlockCellId, CellId, ColId, NormalCellId, RowId, SheetId,
};
pub struct IndexFetcher<'a> {
    pub navigator: &'a Navigator,
    pub sheet_pos_manager: &'a SheetInfoManager,
}

impl<'a> IndexFetcherTrait for IndexFetcher<'a> {
    fn fetch_row_index(&self, sheet_id: &SheetId, row_id: &RowId) -> Result<usize> {
        self.navigator.fetch_row_idx(sheet_id, row_id)
    }

    fn fetch_col_index(&self, sheet_id: &SheetId, col_id: &ColId) -> Result<usize> {
        self.navigator.fetch_col_idx(sheet_id, col_id)
    }

    fn fetch_cell_index(&self, sheet_id: &SheetId, cell_id: &CellId) -> Result<(usize, usize)> {
        self.navigator.fetch_cell_idx(sheet_id, cell_id)
    }

    fn fetch_sheet_index(&self, sheet_id: &SheetId) -> Result<usize> {
        self.sheet_pos_manager
            .get_sheet_idx(sheet_id)
            .ok_or(BasicError::SheetIdNotFound(*sheet_id))
    }

    fn fetch_normal_cell_index(
        &self,
        sheet_id: &SheetId,
        normal_cell_id: &NormalCellId,
    ) -> Result<(usize, usize)> {
        self.navigator
            .fetch_normal_cell_idx(sheet_id, normal_cell_id)
    }

    fn fetch_block_cell_index(
        &self,
        sheet: &SheetId,
        block_cell_id: &BlockCellId,
    ) -> Result<(usize, usize)> {
        self.navigator.fetch_block_cell_idx(sheet, block_cell_id)
    }
}
