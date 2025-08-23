use logisheets_base::{
    block_affect::BlockAffectTrait,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
    index_fetcher::IndexFetcherTrait,
    StyleId,
};

use crate::style_manager::RawStyle;
use crate::{edit_action::StyleUpdateType, Error};

pub trait ContainerExecCtx:
    IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait + SheetIdFetcherByIdxTrait
{
    // Get a new style id based on the old style id and the style update type.
    // Note that the old id won't be removed even if it is not used by any cell.
    fn get_new_style_id(
        &mut self,
        old_id: StyleId,
        update_type: StyleUpdateType,
    ) -> Result<StyleId, Error>;

    fn insert_style(&mut self, style: RawStyle) -> Result<StyleId, Error>;
}
