use logisheets_base::{
    errors::BasicError,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
    index_fetcher::IndexFetcherTrait,
    BlockCellId, BlockId, CellId, ColId, ExtBookId, NormalCellId, RowId, SheetId,
};

use crate::{
    cube_manager::ctx::CubeExecCtx,
    ext_book_manager::ExtBooksManager,
    id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
    workbook::sheet_info_manager::SheetInfoManager,
};

pub struct CubeConnector<'a> {
    pub sheet_id_manager: &'a mut SheetIdManager,
    pub text_id_manager: &'a mut TextIdManager,
    pub func_id_manager: &'a mut FuncIdManager,
    pub name_id_manager: &'a mut NameIdManager,
    pub external_links_manager: &'a mut ExtBooksManager,
    pub sheet_pos_manager: &'a SheetInfoManager,
    pub navigator: &'a Navigator,
}

impl<'a> IdFetcherTrait for CubeConnector<'a> {
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
    ) -> Result<logisheets_base::NormalCellId, BasicError> {
        self.navigator
            .fetch_norm_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_block_cell_id(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
        row: usize,
        col: usize,
    ) -> std::prelude::v1::Result<logisheets_base::BlockCellId, logisheets_base::errors::BasicError>
    {
        self.navigator
            .fetch_block_cell_id(sheet_id, block_id, row, col)
    }
}

impl<'a> IndexFetcherTrait for CubeConnector<'a> {
    fn fetch_row_index(&self, sheet_id: &SheetId, row_id: &RowId) -> Result<usize, BasicError> {
        self.navigator.fetch_row_idx(sheet_id, row_id)
    }

    fn fetch_col_index(&self, sheet_id: &SheetId, col_id: &ColId) -> Result<usize, BasicError> {
        self.navigator.fetch_col_idx(sheet_id, col_id)
    }

    fn fetch_cell_index(
        &self,
        sheet_id: &SheetId,
        cell_id: &CellId,
    ) -> Result<(usize, usize), BasicError> {
        self.navigator.fetch_cell_idx(sheet_id, cell_id)
    }

    fn fetch_sheet_index(&self, sheet_id: &SheetId) -> Result<usize, BasicError> {
        self.sheet_pos_manager
            .get_sheet_idx(sheet_id)
            .ok_or(BasicError::SheetIdNotFound(*sheet_id))
    }

    fn fetch_normal_cell_index(
        &self,
        sheet_id: &SheetId,
        normal_cell_id: &NormalCellId,
    ) -> Result<(usize, usize), BasicError> {
        self.navigator
            .fetch_normal_cell_idx(sheet_id, normal_cell_id)
    }

    fn fetch_block_cell_index(
        &self,
        sheet: &SheetId,
        block_cell_id: &BlockCellId,
    ) -> Result<(usize, usize), BasicError> {
        self.navigator.fetch_block_cell_idx(sheet, block_cell_id)
    }
}

impl<'a> SheetIdFetcherByIdxTrait for CubeConnector<'a> {
    fn fetch_sheet_id_by_index(&self, idx: usize) -> Result<SheetId, usize> {
        self.sheet_pos_manager
            .get_sheet_id(idx)
            .ok_or(self.sheet_pos_manager.pos.len())
    }
}

impl<'a> CubeExecCtx for CubeConnector<'a> {}
