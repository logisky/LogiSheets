use crate::{navigator::Navigator, workbook::sheet_pos_manager::SheetPosManager};
use logisheets_base::{
    index_fetcher::IndexFetcherTrait, BlockCellId, CellId, ColId, NormalCellId, RowId, SheetId,
};
pub struct IndexFetcher<'a> {
    pub navigator: &'a mut Navigator,
    pub sheet_pos_manager: &'a SheetPosManager,
}

impl<'a> IndexFetcherTrait for IndexFetcher<'a> {
    fn fetch_row_index(&mut self, sheet_id: &SheetId, row_id: &RowId) -> Option<usize> {
        self.navigator.fetch_row_idx(sheet_id, row_id)
    }

    fn fetch_col_index(&mut self, sheet_id: &SheetId, col_id: &ColId) -> Option<usize> {
        self.navigator.fetch_col_idx(sheet_id, col_id)
    }

    fn fetch_cell_index(&mut self, sheet_id: &SheetId, cell_id: &CellId) -> Option<(usize, usize)> {
        self.navigator.fetch_cell_idx(sheet_id, cell_id)
    }

    fn fetch_sheet_index(&mut self, sheet_id: &SheetId) -> Option<usize> {
        self.sheet_pos_manager.get_sheet_idx(sheet_id)
    }

    fn fetch_normal_cell_index(
        &mut self,
        sheet_id: &SheetId,
        normal_cell_id: &NormalCellId,
    ) -> Option<(usize, usize)> {
        self.navigator
            .fetch_normal_cell_idx(sheet_id, normal_cell_id)
    }

    fn fetch_block_cell_index(
        &mut self,
        sheet: &SheetId,
        block_cell_id: &BlockCellId,
    ) -> Option<(usize, usize)> {
        self.navigator.fetch_block_cell_idx(sheet, block_cell_id)
    }
}
