use logisheets_base::{
    errors::BasicError,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
    BlockCellId, BlockId, CellId, ColId, ExtBookId, FuncId, NameId, NormalCellId, RowId, SheetId,
    TextId,
};

use crate::{
    block_manager::schema_manager::ctx::BlockSchemaCtx, id_manager::SheetIdManager,
    navigator::Navigator, workbook::sheet_info_manager::SheetInfoManager,
};

pub struct BlockSchemaConnector<'a> {
    pub id_navigator: &'a Navigator,
    pub sheet_info_manager: &'a mut SheetInfoManager,
    pub sheet_id_manager: &'a mut SheetIdManager,
}

type Result<T> = std::result::Result<T, BasicError>;

impl<'a> IdFetcherTrait for BlockSchemaConnector<'a> {
    fn fetch_row_id(&self, sheet_id: &SheetId, row_idx: usize) -> Result<RowId> {
        self.id_navigator.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(&self, sheet_id: &SheetId, col_idx: usize) -> Result<ColId> {
        self.id_navigator.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(&self, sheet_id: &SheetId, row_idx: usize, col_idx: usize) -> Result<CellId> {
        self.id_navigator.fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.sheet_id_manager.get_or_register_id(sheet_name)
    }

    fn fetch_name_id(&mut self, _workbook: &Option<&str>, _name: &str) -> NameId {
        unreachable!()
    }

    fn fetch_ext_book_id(&mut self, _book: &str) -> ExtBookId {
        unreachable!()
    }

    fn fetch_text_id(&mut self, _text: &str) -> TextId {
        unreachable!()
    }

    fn fetch_func_id(&mut self, _func_name: &str) -> FuncId {
        unreachable!()
    }

    fn fetch_norm_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<NormalCellId> {
        self.id_navigator
            .fetch_norm_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_block_cell_id(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
        row: usize,
        col: usize,
    ) -> Result<BlockCellId> {
        self.id_navigator
            .fetch_block_cell_id(sheet_id, block_id, row, col)
    }
}

impl<'a> SheetIdFetcherByIdxTrait for BlockSchemaConnector<'a> {
    fn fetch_sheet_id_by_index(&self, idx: usize) -> std::result::Result<SheetId, usize> {
        self.sheet_info_manager.pos.get(idx).copied().ok_or(idx)
    }
}

impl<'a> BlockSchemaCtx for BlockSchemaConnector<'a> {}
