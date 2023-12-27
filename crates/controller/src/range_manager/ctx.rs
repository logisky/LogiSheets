use logisheets_base::{
    block_affect::BlockAffectTrait,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
    index_fetcher::IndexFetcherTrait,
};

pub trait RangeExecCtx:
    IdFetcherTrait + IndexFetcherTrait + SheetIdFetcherByIdxTrait + BlockAffectTrait
{
}
