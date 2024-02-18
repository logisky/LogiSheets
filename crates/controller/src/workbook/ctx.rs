use logisheets_base::id_fetcher::IdFetcherTrait;

pub trait SheetPosExecCtx: IdFetcherTrait {
    fn has_updated(&mut self);
}
