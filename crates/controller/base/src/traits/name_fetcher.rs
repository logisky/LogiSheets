use crate::{
    errors::BasicError, CellId, ColId, Cube, CubeId, ExtBookId, ExtRef, ExtRefId, FuncId, NameId,
    Range, RangeId, RowId, SheetId, TextId,
};

pub trait NameFetcherTrait {
    fn fetch_text(&self, text_id: &TextId) -> Result<String, BasicError>;
    fn fetch_func_name(&self, func_id: &FuncId) -> Result<String, BasicError>;
    fn fetch_sheet_name(&self, sheet_id: &SheetId) -> Result<String, BasicError>;
    fn fetch_book_name(&self, book_id: &ExtBookId) -> Result<String, BasicError>;
    fn fetch_defined_name(&self, nid: &NameId) -> Result<String, BasicError>;
    fn fetch_cell_idx(
        &self,
        sheet_id: &SheetId,
        cell_id: &CellId,
    ) -> Result<(usize, usize), BasicError>;
    fn fetch_row_idx(&self, sheet_id: &SheetId, row_id: &RowId) -> Result<usize, BasicError>;
    fn fetch_col_idx(&self, sheet_id: &SheetId, col_id: &ColId) -> Result<usize, BasicError>;
    fn fetch_range(&self, sheet_id: &SheetId, range_id: &RangeId) -> Result<Range, BasicError>;
    fn fetch_cube(&self, cube_id: &CubeId) -> Result<Cube, BasicError>;
    fn fetch_ext_ref(&mut self, ext_ref_id: &ExtRefId) -> Result<ExtRef, BasicError>;
}
