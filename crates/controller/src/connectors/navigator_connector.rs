use logisheets_base::{id_fetcher::SheetIdFetcherByIdxTrait, SheetId};

use crate::{navigator::ctx::NavExecCtx, workbook::sheet_pos_manager::SheetPosManager};

pub struct NavigatorConnector<'a> {
    pub sheet_pos_manager: &'a SheetPosManager,
}

impl<'a> SheetIdFetcherByIdxTrait for NavigatorConnector<'a> {
    fn fetch_sheet_id_by_index(&self, idx: usize) -> Result<SheetId, usize> {
        self.sheet_pos_manager
            .get_sheet_id(idx)
            .ok_or(self.sheet_pos_manager.pos.len())
    }
}

impl<'a> NavExecCtx for NavigatorConnector<'a> {}
