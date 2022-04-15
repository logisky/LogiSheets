use controller_base::{
    block_affect::BlockAffectTrait, get_active_sheet::GetActiveSheetTrait,
    get_book_name::GetBookNameTrait, get_norm_cell_id::GetNormCellIdTrait,
    id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, CellId, SheetId,
};
use parser::context::ContextTrait as ParserTrait;

// pub trait ContextTrait = IdFetcherTrait + IndexFetcherTrait;

pub trait GetDeletedCellsTrait {
    fn get_deleted_cells(&mut self) -> Vec<(SheetId, CellId)>;
}

pub trait ContextTrait:
    IdFetcherTrait
    + IndexFetcherTrait
    + GetActiveSheetTrait
    + GetDeletedCellsTrait
    + GetBookNameTrait
    + BlockAffectTrait
    + ParserTrait
    + GetNormCellIdTrait
{
}
