use anyhow::Result;
use logisheets_base::get_active_sheet::GetActiveSheetTrait;
use logisheets_base::get_book_name::GetBookNameTrait;
use logisheets_base::id_fetcher::{IdFetcherTrait, VertexFetcherTrait};
use logisheets_base::{
    Cube, CubeId, ExtBookId, ExtRef, ExtRefId, FuncId, NameId, NormalCellId, Range, RangeId,
    SheetId, TextId,
};

pub trait ContextTrait:
    IdFetcherTrait + GetActiveSheetTrait + GetBookNameTrait + VertexFetcherTrait
{
}

pub struct Context<'a, T, F>
where
    T: IdFetcherTrait,
    F: VertexFetcherTrait,
{
    pub sheet_id: SheetId,
    pub book_name: &'a str,
    pub id_fetcher: &'a mut T,
    pub vertex_fetcher: &'a mut F,
}

impl<'a, T, F> ContextTrait for Context<'a, T, F>
where
    T: IdFetcherTrait,
    F: VertexFetcherTrait,
{
}

impl<'a, T, F> VertexFetcherTrait for Context<'a, T, F>
where
    T: IdFetcherTrait,
    F: VertexFetcherTrait,
{
    fn fetch_range_id(&mut self, sheet_id: &SheetId, range: &Range) -> RangeId {
        self.vertex_fetcher.fetch_range_id(sheet_id, range)
    }

    fn fetch_cube_id(&mut self, cube: &Cube) -> CubeId {
        self.vertex_fetcher.fetch_cube_id(cube)
    }

    fn fetch_ext_ref_id(&mut self, ext_ref: &ExtRef) -> ExtRefId {
        self.vertex_fetcher.fetch_ext_ref_id(ext_ref)
    }
}

impl<'a, T, F> GetActiveSheetTrait for Context<'a, T, F>
where
    T: IdFetcherTrait,
    F: VertexFetcherTrait,
{
    fn get_active_sheet(&self) -> SheetId {
        self.sheet_id
    }
}

impl<'a, T, F> GetBookNameTrait for Context<'a, T, F>
where
    T: IdFetcherTrait,
    F: VertexFetcherTrait,
{
    fn get_book_name(&self) -> &str {
        self.book_name
    }
}

impl<'a, T, F> IdFetcherTrait for Context<'a, T, F>
where
    T: IdFetcherTrait,
    F: VertexFetcherTrait,
{
    fn fetch_row_id(
        &mut self,
        sheet_id: &SheetId,
        row_idx: usize,
    ) -> Result<logisheets_base::RowId> {
        self.id_fetcher.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(
        &mut self,
        sheet_id: &SheetId,
        col_idx: usize,
    ) -> Result<logisheets_base::ColId> {
        self.id_fetcher.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(
        &mut self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<logisheets_base::CellId> {
        self.id_fetcher.fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.id_fetcher.fetch_sheet_id(sheet_name)
    }

    fn fetch_name_id(&mut self, workbook: &Option<&str>, name: &str) -> NameId {
        self.id_fetcher.fetch_name_id(workbook, name)
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> ExtBookId {
        self.id_fetcher.fetch_ext_book_id(book)
    }

    fn fetch_text_id(&mut self, text: &str) -> TextId {
        self.id_fetcher.fetch_text_id(text)
    }

    fn fetch_func_id(&mut self, func_name: &str) -> FuncId {
        self.id_fetcher.fetch_func_id(func_name)
    }

    fn fetch_norm_cell_id(
        &mut self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<NormalCellId> {
        self.id_fetcher
            .fetch_norm_cell_id(sheet_id, row_idx, col_idx)
    }
}
