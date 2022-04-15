use controller_base::name_fetcher::NameFetcherTrait;

use crate::{
    ext_book_manager::ExtBooksManager,
    id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
};

pub struct NameFetcher<'a> {
    pub func_manager: &'a FuncIdManager,
    pub sheet_id_manager: &'a SheetIdManager,
    pub external_links_manager: &'a ExtBooksManager,
    pub text_id_manager: &'a TextIdManager,
    pub name_id_manager: &'a NameIdManager,
    pub navigator: &'a mut Navigator,
}

impl<'a> NameFetcherTrait for NameFetcher<'a> {
    fn fetch_text(&self, text_id: &controller_base::TextId) -> String {
        self.text_id_manager
            .get_string(text_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_func_name(&self, func_id: &controller_base::FuncId) -> String {
        self.func_manager
            .get_string(func_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_sheet_name(&self, sheet_id: &controller_base::SheetId) -> String {
        self.sheet_id_manager
            .get_string(sheet_id)
            .unwrap_or(String::from("Unknown"))
    }

    fn fetch_book_name(&self, book_id: &controller_base::ExtBookId) -> String {
        self.external_links_manager
            .fetch_book_name(book_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_defined_name(&self, nid: &controller_base::NameId) -> String {
        match self.name_id_manager.get_string(nid) {
            Some((_, name)) => name,
            None => String::from(""),
        }
    }

    fn fetch_cell_idx(
        &mut self,
        sheet_id: &controller_base::SheetId,
        cell_id: &controller_base::CellId,
    ) -> (usize, usize) {
        self.navigator
            .fetch_cell_idx(sheet_id.clone(), cell_id)
            .unwrap()
    }

    fn fetch_row_idx(
        &mut self,
        sheet_id: &controller_base::SheetId,
        row_id: &controller_base::RowId,
    ) -> usize {
        self.navigator
            .fetch_row_idx(sheet_id.clone(), row_id.clone())
            .unwrap()
    }

    fn fetch_col_idx(
        &mut self,
        sheet_id: &controller_base::SheetId,
        col_id: &controller_base::ColId,
    ) -> usize {
        self.navigator
            .fetch_col_idx(sheet_id.clone(), col_id.clone())
            .unwrap()
    }
}
