use logisheets_base::{
    errors::BasicError, id_fetcher::IdFetcherTrait, BlockCellId, BlockId, CellId, ColId, ExtBookId,
    NormalCellId, RowId, SheetId,
};

use crate::{
    ext_book_manager::ExtBooksManager,
    id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
    workbook::ctx::SheetPosExecCtx,
};

pub struct SheetPosConnector<'a> {
    pub text_id_manager: &'a mut TextIdManager,
    pub sheet_id_manager: &'a mut SheetIdManager,
    pub func_id_manager: &'a mut FuncIdManager,
    pub name_id_manager: &'a mut NameIdManager,
    pub external_links_manager: &'a mut ExtBooksManager,
    pub navigator: &'a Navigator,

    pub updated: bool,
}

impl<'a> IdFetcherTrait for SheetPosConnector<'a> {
    fn fetch_row_id(&self, sheet_id: &SheetId, row_idx: usize) -> Result<RowId, BasicError> {
        self.navigator.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(&self, sheet_id: &SheetId, col_idx: usize) -> Result<ColId, BasicError> {
        self.navigator.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<CellId, BasicError> {
        self.navigator.fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.sheet_id_manager.get_or_register_id(sheet_name)
    }

    fn fetch_name_id(&mut self, workbook: &Option<&str>, name: &str) -> logisheets_base::NameId {
        let book_id = match workbook {
            Some(book) => self.fetch_ext_book_id(book),
            None => 0 as ExtBookId,
        };
        self.name_id_manager.get_id(&(book_id, name.to_owned()))
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> logisheets_base::ExtBookId {
        self.external_links_manager.fetch_ext_book_id(book)
    }

    fn fetch_text_id(&mut self, text: &str) -> logisheets_base::TextId {
        self.text_id_manager.get_or_register_id(text)
    }

    fn fetch_func_id(&mut self, func_name: &str) -> logisheets_base::FuncId {
        self.func_id_manager.get_func_id(func_name)
    }

    fn fetch_norm_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<NormalCellId, BasicError> {
        self.navigator
            .fetch_norm_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_block_cell_id(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
        row: usize,
        col: usize,
    ) -> Result<BlockCellId, BasicError> {
        self.navigator
            .fetch_block_cell_id(sheet_id, block_id, row, col)
    }
}

impl<'a> SheetPosExecCtx for SheetPosConnector<'a> {
    fn has_updated(&mut self) {
        self.updated = true
    }
}
