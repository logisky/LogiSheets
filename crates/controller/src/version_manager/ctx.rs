use logisheets_base::{
    errors::BasicError,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
    BlockCellId, CellId, ColId, ExtBookId, FuncId, NameId, NormalCellId, RowId, SheetId, TextId,
};

use crate::controller::status::Status;

pub trait VersionExecCtx: IdFetcherTrait + SheetIdFetcherByIdxTrait {}

pub struct VersionExecCtxImpl<'a> {
    status: &'a mut Status,
}

impl<'a> VersionExecCtxImpl<'a> {
    pub fn new(status: &'a mut Status) -> Self {
        Self { status }
    }
}

impl<'a> VersionExecCtx for VersionExecCtxImpl<'a> {}

impl<'a> IdFetcherTrait for VersionExecCtxImpl<'a> {
    fn fetch_row_id(&self, sheet_id: &SheetId, row_idx: usize) -> Result<RowId, BasicError> {
        self.status.navigator.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(&self, sheet_id: &SheetId, col_idx: usize) -> Result<ColId, BasicError> {
        self.status.navigator.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<CellId, BasicError> {
        self.status
            .navigator
            .fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_norm_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<NormalCellId, BasicError> {
        self.status
            .navigator
            .fetch_norm_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_block_cell_id(
        &self,
        sheet_id: &SheetId,
        block_id: &logisheets_base::BlockId,
        row: usize,
        col: usize,
    ) -> Result<BlockCellId, BasicError> {
        self.status
            .navigator
            .fetch_block_cell_id(sheet_id, block_id, row, col)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.status
            .sheet_id_manager
            .get_id(sheet_name)
            .unwrap()
            .clone()
    }

    fn fetch_name_id(&mut self, _: &Option<&str>, _: &str) -> NameId {
        unreachable!()
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> ExtBookId {
        self.status.external_links_manager.fetch_ext_book_id(book)
    }

    fn fetch_text_id(&mut self, text: &str) -> TextId {
        self.status.text_id_manager.get_id(text).unwrap().clone()
    }

    fn fetch_func_id(&mut self, func_name: &str) -> FuncId {
        self.status.func_id_manager.get_func_id(func_name)
    }
}

impl<'a> SheetIdFetcherByIdxTrait for VersionExecCtxImpl<'a> {
    fn fetch_sheet_id_by_index(&self, idx: usize) -> Result<SheetId, usize> {
        let sheet_pos_manager = &self.status.sheet_pos_manager;
        sheet_pos_manager
            .get_sheet_id(idx)
            .ok_or(sheet_pos_manager.pos.len())
    }
}
