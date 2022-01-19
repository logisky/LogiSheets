use controller_base::{
    block_affect::BlockAffectTrait, get_active_sheet::GetActiveSheetTrait,
    get_book_name::GetBookNameTrait, get_norm_cells_in_line::GetNormCellsInLineTrait,
    id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
};
use parser::context::ContextTrait as ParserTrait;

// pub trait ContextTrait = IdFetcherTrait + IndexFetcherTrait;

pub trait ContextTrait:
    IdFetcherTrait
    + IndexFetcherTrait
    + GetActiveSheetTrait
    + GetNormCellsInLineTrait
    + GetBookNameTrait
    + BlockAffectTrait
    + ParserTrait
{
}
