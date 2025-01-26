use logisheets_base::id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait};

pub trait CellAttachmentsExecCtx: IdFetcherTrait + SheetIdFetcherByIdxTrait {}
