use crate::{
    ext_book_manager::ExtBooksManager,
    id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
};

use logisheets_base::{
    id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, BlockCellId, ColId, ExtBookId,
    NormalCellId, RowId, SheetId,
};
use logisheets_workbook::workbook::Workbook;

pub struct Fetcher<'a> {
    pub sheet_id_manager: &'a mut SheetIdManager,
    pub text_id_manager: &'a mut TextIdManager,
    pub func_id_manager: &'a mut FuncIdManager,
    pub name_id_manager: &'a mut NameIdManager,
    pub navigator: &'a mut Navigator,
    pub ext_books_manager: &'a mut ExtBooksManager,
    pub workbook: &'a Workbook,
}

impl<'a> IdFetcherTrait for Fetcher<'a> {
    fn fetch_row_id(&mut self, sheet_id: &SheetId, row_idx: usize) -> Option<RowId> {
        self.navigator.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(&mut self, sheet_id: &SheetId, col_idx: usize) -> Option<ColId> {
        self.navigator.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(
        &mut self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Option<logisheets_base::CellId> {
        self.navigator.fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.sheet_id_manager.get_id(sheet_name)
    }

    fn fetch_name_id(&mut self, workbook: &Option<&str>, name: &str) -> logisheets_base::NameId {
        let book_id = match workbook {
            Some(book) => self.fetch_ext_book_id(book),
            None => 0 as ExtBookId,
        };
        self.name_id_manager.get_id(&(book_id, name.to_owned()))
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> ExtBookId {
        let idx = book.parse::<usize>().unwrap_or(0);
        if let Some(link) = self
            .workbook
            .xl
            .workbook_part
            .external_references
            .as_ref()
            .unwrap()
            .external_references
            .get(idx)
        {
            let id = &link.id;
            match self.workbook.xl.external_links.get(id) {
                Some(link) => {
                    let target = &link.target;
                    self.ext_books_manager.fetch_ext_book_id(target)
                }
                None => 0,
            }
        } else {
            0
        }
    }

    fn fetch_text_id(&mut self, text: &str) -> logisheets_base::TextId {
        self.text_id_manager.get_id(text)
    }

    fn fetch_func_id(&mut self, func_name: &str) -> logisheets_base::FuncId {
        self.func_id_manager.get_func_id(func_name)
    }
}

impl<'a> IndexFetcherTrait for Fetcher<'a> {
    fn fetch_row_index(&mut self, sheet_id: &SheetId, row_id: &RowId) -> Option<usize> {
        self.navigator.fetch_row_idx(sheet_id, row_id)
    }

    fn fetch_col_index(&mut self, sheet_id: &SheetId, col_id: &ColId) -> Option<usize> {
        self.navigator.fetch_col_idx(sheet_id, col_id)
    }

    fn fetch_cell_index(
        &mut self,
        sheet_id: &SheetId,
        cell_id: &logisheets_base::CellId,
    ) -> Option<(usize, usize)> {
        self.navigator.fetch_cell_idx(sheet_id, cell_id)
    }

    fn fetch_sheet_index(&mut self, sheet_id: &SheetId) -> Option<usize> {
        Some(sheet_id.clone() as usize)
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
