use logisheets_base::get_active_sheet::GetActiveSheetTrait;
use logisheets_base::get_book_name::GetBookNameTrait;
use logisheets_base::id_fetcher::IdFetcherTrait;
use logisheets_base::SheetId;

pub trait ContextTrait: IdFetcherTrait + GetActiveSheetTrait + GetBookNameTrait {}

pub struct Context<'a, T>
where
    T: IdFetcherTrait,
{
    pub sheet_id: SheetId,
    pub book_name: &'a str,
    pub id_fetcher: &'a mut T,
}

impl<'a, T> ContextTrait for Context<'a, T> where T: IdFetcherTrait {}

impl<'a, T> GetActiveSheetTrait for Context<'a, T>
where
    T: IdFetcherTrait,
{
    fn get_active_sheet(&self) -> SheetId {
        self.sheet_id
    }
}

impl<'a, T> GetBookNameTrait for Context<'a, T>
where
    T: IdFetcherTrait,
{
    fn get_book_name(&self) -> &str {
        self.book_name
    }
}

impl<'a, T> IdFetcherTrait for Context<'a, T>
where
    T: IdFetcherTrait,
{
    fn fetch_row_id(
        &mut self,
        sheet_id: SheetId,
        row_idx: usize,
    ) -> Option<logisheets_base::RowId> {
        self.id_fetcher.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(
        &mut self,
        sheet_id: SheetId,
        col_idx: usize,
    ) -> Option<logisheets_base::ColId> {
        self.id_fetcher.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(
        &mut self,
        sheet_id: SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Option<logisheets_base::CellId> {
        self.id_fetcher.fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.id_fetcher.fetch_sheet_id(sheet_name)
    }

    fn fetch_name_id(&mut self, workbook: &Option<&str>, name: &str) -> logisheets_base::NameId {
        self.id_fetcher.fetch_name_id(workbook, name)
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> logisheets_base::ExtBookId {
        self.id_fetcher.fetch_ext_book_id(book)
    }

    fn fetch_text_id(&mut self, text: &str) -> logisheets_base::TextId {
        self.id_fetcher.fetch_text_id(text)
    }

    fn fetch_func_id(&mut self, func_name: &str) -> logisheets_base::FuncId {
        self.id_fetcher.fetch_func_id(func_name)
    }
}
