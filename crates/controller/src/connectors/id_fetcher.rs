use crate::{
    ext_book_manager::ExtBooksManager,
    id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
};
use logisheets_base::{id_fetcher::IdFetcherTrait, ExtBookId, SheetId};

pub struct IdFetcher<'a> {
    pub sheet_id_manager: &'a mut SheetIdManager,
    pub text_id_manager: &'a mut TextIdManager,
    pub func_id_manager: &'a mut FuncIdManager,
    pub name_id_manager: &'a mut NameIdManager,
    pub external_links_manager: &'a mut ExtBooksManager,
    pub navigator: &'a mut Navigator,
}

impl<'a> IdFetcherTrait for IdFetcher<'a> {
    fn fetch_row_id(
        &mut self,
        sheet_id: &SheetId,
        row_idx: usize,
    ) -> Option<logisheets_base::RowId> {
        self.navigator.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(
        &mut self,
        sheet_id: &SheetId,
        col_idx: usize,
    ) -> Option<logisheets_base::ColId> {
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

    fn fetch_ext_book_id(&mut self, book: &str) -> logisheets_base::ExtBookId {
        self.external_links_manager.fetch_ext_book_id(book)
    }

    fn fetch_text_id(&mut self, text: &str) -> logisheets_base::TextId {
        self.text_id_manager.get_id(text)
    }

    fn fetch_func_id(&mut self, func_name: &str) -> logisheets_base::FuncId {
        self.func_id_manager.get_func_id(func_name)
    }
}
