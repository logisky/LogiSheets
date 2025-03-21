use logisheets_base::{
    errors::{BasicError, Result},
    name_fetcher::NameFetcherTrait,
    CellId, ExtBookId, ExtRef, NameId, Range, SheetId,
};

use crate::{
    cube_manager::CubeManager,
    ext_book_manager::ExtBooksManager,
    ext_ref_manager::ExtRefManager,
    id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
    range_manager::RangeManager,
};

pub struct NameFetcher<'a> {
    pub func_manager: &'a FuncIdManager,
    pub range_manager: &'a RangeManager,
    pub cube_manager: &'a CubeManager,
    pub ext_ref_manager: &'a ExtRefManager,
    pub sheet_id_manager: &'a SheetIdManager,
    pub external_links_manager: &'a ExtBooksManager,
    pub text_id_manager: &'a TextIdManager,
    pub name_id_manager: &'a NameIdManager,
    pub navigator: &'a Navigator,
}

impl<'a> NameFetcherTrait for NameFetcher<'a> {
    fn fetch_text(&self, text_id: &logisheets_base::TextId) -> Result<String> {
        self.text_id_manager
            .get_string(text_id)
            .ok_or(BasicError::TextIdNotFound(*text_id))
    }

    fn fetch_func_name(&self, func_id: &logisheets_base::FuncId) -> Result<String> {
        self.func_manager
            .get_string(func_id)
            .ok_or(BasicError::FuncIdNotFound(*func_id))
    }

    fn fetch_sheet_name(&self, sheet_id: &SheetId) -> Result<String> {
        self.sheet_id_manager
            .get_string(sheet_id)
            .ok_or(BasicError::SheetIdNotFound(*sheet_id))
    }

    fn fetch_book_name(&self, book_id: &ExtBookId) -> Result<String> {
        self.external_links_manager
            .fetch_book_name(book_id)
            .ok_or(BasicError::BookIdNotFound(*book_id))
    }

    fn fetch_defined_name(&self, nid: &NameId) -> Result<String> {
        match self.name_id_manager.get_string(nid) {
            Some((_, name)) => Ok(name),
            None => Err(BasicError::NameNotFound(*nid)),
        }
    }

    fn fetch_cell_idx(&self, sheet_id: &SheetId, cell_id: &CellId) -> Result<(usize, usize)> {
        self.navigator.fetch_cell_idx(sheet_id, cell_id)
    }

    fn fetch_row_idx(&self, sheet_id: &SheetId, row_id: &logisheets_base::RowId) -> Result<usize> {
        self.navigator.fetch_row_idx(sheet_id, row_id)
    }

    fn fetch_col_idx(&self, sheet_id: &SheetId, col_id: &logisheets_base::ColId) -> Result<usize> {
        self.navigator.fetch_col_idx(sheet_id, col_id)
    }

    fn fetch_range(&self, sheet_id: &SheetId, range_id: &u32) -> Result<Range> {
        self.range_manager
            .get_range(sheet_id, range_id)
            .ok_or(BasicError::RangeIdNotFound(*range_id))
    }

    fn fetch_cube(&self, cube_id: &u32) -> Result<logisheets_base::Cube> {
        self.cube_manager
            .get_cube(cube_id)
            .ok_or(BasicError::CubeIdNotFound(*cube_id))
    }

    fn fetch_ext_ref(&mut self, ext_ref_id: &u32) -> Result<ExtRef> {
        self.ext_ref_manager
            .get_ext_ref(ext_ref_id)
            .ok_or(BasicError::ExtRefIdNotFound(*ext_ref_id))
    }
}
