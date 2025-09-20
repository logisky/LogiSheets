use logisheets_base::{
    block_affect::BlockAffectTrait,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
};

pub trait ExclusiveManagerExecCtx:
    IdFetcherTrait + SheetIdFetcherByIdxTrait + BlockAffectTrait
{
}
