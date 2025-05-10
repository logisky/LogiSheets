use logisheets_base::id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait};

pub trait ExclusiveManagerExecCtx: IdFetcherTrait + SheetIdFetcherByIdxTrait {}
