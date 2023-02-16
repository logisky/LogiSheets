use logisheets_base::{BlockId, ColId, RowId, SheetId};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum NavError {
    #[error("cannot find a sheet by id: {0}")]
    CannotGetSheetById(SheetId),
    #[error("cannot find a block by id: sheet:{0}, block:{1}")]
    CannotGetBlockById(SheetId, BlockId),
    // #[error("cannot fetch col id with sheet:{0} and col idx:{1}")]
    // CannotFetchColId(SheetId, usize),
    // #[error("cannot fetch row id with sheet:{0} and row idx:{1}")]
    // CannotFetchRowId(SheetId, usize),
    #[error("cannot fetch row idx with sheet:{0} and row id:{1}")]
    CannotFetchRowIdx(SheetId, RowId),
    #[error("cannot fetch col idx with sheet:{0} and row id:{1}")]
    CannotFetchColIdx(SheetId, ColId),
    #[error(
        "cannot fetch idx in the block with sheet:{0}, block_id: {1}, row id:{2} and col id: {3}"
    )]
    CannotFindIdxInBlock(SheetId, BlockId, RowId, ColId),
}
