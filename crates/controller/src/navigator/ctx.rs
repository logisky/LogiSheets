use logisheets_base::{errors::BasicError, id_fetcher::SheetIdFetcherByIdxTrait, SheetId};

pub trait NavExecCtx: SheetIdFetcherByIdxTrait {
    fn get_sheet_id(&mut self, name: String) -> Result<SheetId, BasicError>;
}
