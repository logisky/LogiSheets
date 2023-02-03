use crate::{Cube, CubeId, ExtRef, ExtRefId, Range, RangeId};
use anyhow::Result;

use super::{CellId, ColId, ExtBookId, FuncId, NameId, RowId, SheetId, TextId};

pub trait SheetIdFetcherTrait {
    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId;
}

pub trait IdFetcherTrait {
    fn fetch_row_id(&mut self, sheet_id: &SheetId, row_idx: usize) -> Result<RowId>;
    fn fetch_col_id(&mut self, sheet_id: &SheetId, col_idx: usize) -> Result<ColId>;
    fn fetch_cell_id(
        &mut self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<CellId>;

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId;

    fn fetch_name_id(&mut self, workbook: &Option<&str>, name: &str) -> NameId;

    fn fetch_ext_book_id(&mut self, book: &str) -> ExtBookId;

    fn fetch_text_id(&mut self, text: &str) -> TextId;

    fn fetch_func_id(&mut self, func_name: &str) -> FuncId;
}

pub trait VertexFetcherTrait {
    fn fetch_range_id(&mut self, sheet_id: &SheetId, range: &Range) -> RangeId;

    fn fetch_cube_id(&mut self, cube: &Cube) -> CubeId;

    fn fetch_ext_ref_id(&mut self, ext_ref: &ExtRef) -> ExtRefId;
}
