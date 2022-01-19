use crate::{navigator::Navigator, workbook::sheet_pos_manager::SheetPosManager};
use controller_base::index_fetcher::IndexFetcherTrait;
pub struct IndexFetcher<'a> {
    pub navigator: &'a mut Navigator,
    pub sheet_pos_manager: &'a SheetPosManager,
}

impl<'a> IndexFetcherTrait for IndexFetcher<'a> {
    fn fetch_row_index(
        &mut self,
        sheet_id: controller_base::SheetId,
        row_id: controller_base::RowId,
    ) -> Option<usize> {
        self.navigator.fetch_row_idx(sheet_id, row_id)
    }

    fn fetch_col_index(
        &mut self,
        sheet_id: controller_base::SheetId,
        col_id: controller_base::ColId,
    ) -> Option<usize> {
        self.navigator.fetch_col_idx(sheet_id, col_id)
    }

    fn fetch_cell_index(
        &mut self,
        sheet_id: controller_base::SheetId,
        cell_id: &controller_base::CellId,
    ) -> Option<(usize, usize)> {
        self.navigator.fetch_cell_idx(sheet_id, cell_id)
    }

    fn fetch_sheet_index(&mut self, sheet_id: controller_base::SheetId) -> Option<usize> {
        self.sheet_pos_manager.get_sheet_idx(sheet_id)
    }
}
