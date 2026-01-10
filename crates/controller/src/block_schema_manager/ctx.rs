use logisheets_base::id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait};

pub trait BlockSchemaCtx: IdFetcherTrait + SheetIdFetcherByIdxTrait {}
