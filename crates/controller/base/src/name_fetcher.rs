use crate::{
    CellId, ColId, Cube, CubeId, ExtBookId, ExtRef, ExtRefId, FuncId, NameId, Range, RangeId,
    RowId, SheetId, TextId,
};

pub trait NameFetcherTrait {
    fn fetch_text(&self, text_id: &TextId) -> String;
    fn fetch_func_name(&self, func_id: &FuncId) -> String;
    fn fetch_sheet_name(&self, sheet_id: &SheetId) -> String;
    fn fetch_book_name(&self, book_id: &ExtBookId) -> String;
    fn fetch_defined_name(&self, nid: &NameId) -> String;
    fn fetch_cell_idx(&mut self, sheet_id: &SheetId, cell_id: &CellId) -> (usize, usize);
    fn fetch_row_idx(&mut self, sheet_id: &SheetId, row_id: &RowId) -> usize;
    fn fetch_col_idx(&mut self, sheet_id: &SheetId, col_id: &ColId) -> usize;
    fn fetch_range(&mut self, sheet_id: &SheetId, range_id: &RangeId) -> Option<Range>;
    fn fetch_cube(&mut self, cube_id: &CubeId) -> Cube;
    fn fetch_ext_ref(&mut self, ext_ref_id: &ExtRefId) -> ExtRef;
}
