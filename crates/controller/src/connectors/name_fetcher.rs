use logisheets_base::{
    name_fetcher::NameFetcherTrait, CellId, ExtBookId, ExtRef, NameId, Range, SheetId,
};

use crate::{
    ext_book_manager::ExtBooksManager,
    formula_manager::FormulaManager,
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
    pub formula_manager: &'a FormulaManager,
}

impl<'a> NameFetcherTrait for NameFetcher<'a> {
    fn fetch_text(&self, text_id: &logisheets_base::TextId) -> String {
        self.text_id_manager
            .get_string(text_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_func_name(&self, func_id: &logisheets_base::FuncId) -> String {
        self.func_manager
            .get_string(func_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_sheet_name(&self, sheet_id: &SheetId) -> String {
        self.sheet_id_manager
            .get_string(sheet_id)
            .unwrap_or(String::from("Unknown"))
    }

    fn fetch_book_name(&self, book_id: &ExtBookId) -> String {
        self.external_links_manager
            .fetch_book_name(book_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_defined_name(&self, nid: &NameId) -> String {
        match self.name_id_manager.get_string(nid) {
            Some((_, name)) => name,
            None => String::from(""),
        }
    }

    fn fetch_cell_idx(&mut self, sheet_id: &SheetId, cell_id: &CellId) -> (usize, usize) {
        self.navigator.fetch_cell_idx(sheet_id, cell_id).unwrap()
    }

    fn fetch_row_idx(&mut self, sheet_id: &SheetId, row_id: &logisheets_base::RowId) -> usize {
        self.navigator.fetch_row_idx(sheet_id, row_id).unwrap()
    }

    fn fetch_col_idx(&mut self, sheet_id: &SheetId, col_id: &logisheets_base::ColId) -> usize {
        self.navigator.fetch_col_idx(sheet_id, col_id).unwrap()
    }

    fn fetch_range(&mut self, sheet_id: &SheetId, range_id: &u32) -> Option<Range> {
        self.formula_manager
            .range_manager
            .get_range(sheet_id, range_id)
    }

    fn fetch_cube(&mut self, cube_id: &u32) -> logisheets_base::Cube {
        self.formula_manager.cube_manager.get_cube(cube_id).unwrap()
    }

    fn fetch_ext_ref(&mut self, ext_ref_id: &u32) -> ExtRef {
        self.formula_manager
            .ext_ref_manager
            .get_ext_ref(ext_ref_id)
            .unwrap()
    }
}
