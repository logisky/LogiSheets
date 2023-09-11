use crate::{Cube, CubeId, ExtRef, ExtRefId, NormalCellId, Range, RangeId};

use crate::{errors::BasicError, CellId, ColId, ExtBookId, FuncId, NameId, RowId, SheetId, TextId};

pub trait SheetIdFetcherTrait {
    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId;
}

pub trait IdFetcherTrait {
    fn fetch_row_id(&self, sheet_id: &SheetId, row_idx: usize) -> Result<RowId, BasicError>;
    fn fetch_col_id(&self, sheet_id: &SheetId, col_idx: usize) -> Result<ColId, BasicError>;
    fn fetch_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<CellId, BasicError>;

    fn fetch_norm_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<NormalCellId, BasicError>;

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
