use anyhow::Result;
use logisheets_base::id_fetcher::{IdFetcherTrait, VertexFetcherTrait};
use logisheets_base::name_fetcher::NameFetcherTrait;
use logisheets_base::{
    CellId, ColId, Cube, CubeId, ExtBookId, ExtRef, ExtRefId, FuncId, NameId, NormalCellId, Range,
    RangeId, RowId, SheetId, TextId,
};

pub struct TestIdFetcher {}

impl IdFetcherTrait for TestIdFetcher {
    fn fetch_row_id(&mut self, sheet_id: &SheetId, row_idx: usize) -> Result<RowId> {
        Ok(sheet_id.clone() as u32 + row_idx as u32)
    }

    fn fetch_col_id(&mut self, sheet_id: &SheetId, col_idx: usize) -> Result<ColId> {
        Ok(sheet_id.clone() as u32 + col_idx as u32)
    }

    fn fetch_cell_id(&mut self, _: &SheetId, row_idx: usize, col_idx: usize) -> Result<CellId> {
        Ok(CellId::NormalCell(NormalCellId {
            row: row_idx as u32,
            col: col_idx as u32,
            follow_row: None,
            follow_col: None,
        }))
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        sheet_name.len() as SheetId
    }

    fn fetch_name_id(&mut self, _: &Option<&str>, name: &str) -> NameId {
        name.len() as NameId
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> ExtBookId {
        book.len() as ExtBookId
    }

    fn fetch_text_id(&mut self, _: &str) -> TextId {
        1
    }

    fn fetch_func_id(&mut self, _: &str) -> FuncId {
        1
    }

    fn fetch_norm_cell_id(
        &mut self,
        _sheet_id: &SheetId,
        _row_idx: usize,
        _col_idx: usize,
    ) -> Result<NormalCellId> {
        Ok(NormalCellId {
            row: 0,
            col: 0,
            follow_row: None,
            follow_col: None,
        })
    }
}

impl NameFetcherTrait for TestIdFetcher {
    fn fetch_text(&self, _text_id: &TextId) -> String {
        String::from("testtext")
    }

    fn fetch_func_name(&self, _func_id: &FuncId) -> String {
        String::from("SUM")
    }

    fn fetch_sheet_name(&self, sheet_id: &SheetId) -> String {
        sheet_id.to_string()
    }

    fn fetch_book_name(&self, book_id: &ExtBookId) -> String {
        book_id.to_string()
    }

    fn fetch_defined_name(&self, nid: &NameId) -> String {
        nid.to_string()
    }

    fn fetch_cell_idx(&mut self, _sheet_id: &SheetId, cell_id: &CellId) -> (usize, usize) {
        if let CellId::NormalCell(NormalCellId {
            row,
            col,
            follow_row: _,
            follow_col: _,
        }) = cell_id
        {
            (row.clone() as usize, col.clone() as usize)
        } else {
            panic!()
        }
    }

    fn fetch_row_idx(&mut self, _sheet_id: &SheetId, row_id: &RowId) -> usize {
        row_id.clone() as usize
    }

    fn fetch_col_idx(&mut self, _sheet_id: &SheetId, col_id: &ColId) -> usize {
        col_id.clone() as usize
    }

    fn fetch_range(&mut self, _: &SheetId, _: &RangeId) -> Option<Range> {
        todo!()
    }

    fn fetch_cube(&mut self, _cube_id: &CubeId) -> Cube {
        todo!()
    }

    fn fetch_ext_ref(&mut self, _ext_ref_id: &ExtRefId) -> ExtRef {
        todo!()
    }
}

pub struct TestVertexFetcher {}

impl VertexFetcherTrait for TestVertexFetcher {
    fn fetch_range_id(&mut self, _: &SheetId, _range: &Range) -> RangeId {
        1
    }

    fn fetch_cube_id(&mut self, _cube: &Cube) -> CubeId {
        1
    }

    fn fetch_ext_ref_id(&mut self, _ext_ref: &ExtRef) -> ExtRefId {
        1
    }
}
