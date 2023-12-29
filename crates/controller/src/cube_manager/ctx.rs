use logisheets_base::{
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
    index_fetcher::IndexFetcherTrait,
};

pub trait CubeExecCtx: IdFetcherTrait + IndexFetcherTrait + SheetIdFetcherByIdxTrait {}
