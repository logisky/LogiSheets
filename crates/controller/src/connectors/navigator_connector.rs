use logisheets_base::{errors::BasicError, id_fetcher::SheetIdFetcherByIdxTrait, SheetId};

use crate::{
    id_manager::SheetIdManager, navigator::ctx::NavExecCtx,
    workbook::sheet_info_manager::SheetInfoManager,
};

pub struct NavigatorConnector<'a> {
    pub sheet_pos_manager: &'a SheetInfoManager,
    pub sheet_id_manager: &'a mut SheetIdManager,
}

impl<'a> SheetIdFetcherByIdxTrait for NavigatorConnector<'a> {
    fn fetch_sheet_id_by_index(&self, idx: usize) -> Result<SheetId, usize> {
        self.sheet_pos_manager
            .get_sheet_id(idx)
            .ok_or(self.sheet_pos_manager.pos.len())
    }
}

impl<'a> NavExecCtx for NavigatorConnector<'a> {
    fn get_sheet_id(&mut self, name: String) -> Result<SheetId, BasicError> {
        if self.sheet_id_manager.has(&name).is_some() {
            return Err(BasicError::SheetNameAlreadyExists(name));
        }
        Ok(self.sheet_id_manager.get_or_register_id(&name))
    }
}
