use logisheets_base::{
    block_affect::BlockAffectTrait,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
    index_fetcher::IndexFetcherTrait,
    StyleId,
};

use crate::{edit_action::StyleUpdateType, Error};

pub trait ContainerExecCtx:
    IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait + SheetIdFetcherByIdxTrait
{
    fn get_new_style_id(
        &mut self,
        old_id: StyleId,
        update_type: StyleUpdateType,
    ) -> Result<StyleId, Error>;
}
