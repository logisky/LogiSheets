use logisheets_base::id_fetcher::IdFetcherTrait;

pub trait SheetInfoExecCtx: IdFetcherTrait {
    fn has_updated(&mut self);
}
