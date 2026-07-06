use logisheets_base::{SheetId, errors::BasicError, id_fetcher::SheetIdFetcherByIdxTrait};

pub trait NavExecCtx: SheetIdFetcherByIdxTrait {
    fn get_sheet_id(&mut self, name: String) -> Result<SheetId, BasicError>;
}
