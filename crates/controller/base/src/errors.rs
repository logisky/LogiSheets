use thiserror::Error;

use crate::{
    BlockId, ColId, CubeId, EphemeralId, ExtBookId, ExtRefId, FuncId, NameId, RangeId, RowId,
    SheetId, TextId,
};

pub type Result<T> = std::result::Result<T, BasicError>;

#[derive(Debug, Error)]
pub enum BasicError {
    #[error("Failed to fetch row id by the row index: {0}")]
    RowIdNotFound(usize),
    #[error("Failed to fetch col id by the col index: {0}")]
    ColIdNotFound(usize),
    #[error("Failed to fetch cell id by the row index and col index: {0}, {0}")]
    CellIdNotFound(usize, usize),
    #[error("Failed to fetch row index by the row id: {0}")]
    RowIndexUnavailable(RowId),
    #[error("Failed to fetch col index by the col id: {0}")]
    ColIndexUnavailable(ColId),
    #[error("Failed to fetch block by the block id: {1} in sheet {0}")]
    BlockIdNotFound(SheetId, BlockId),
    #[error("Failed to fetch block cell by the block id: {1}, row: {2}, col: {3} in sheet {0}")]
    BlockCellIdNotFound(SheetId, BlockId, usize, usize),
    #[error("Failed to create block because the block id is already existed")]
    BlockIdHasAlreadyExisted(BlockId),
    #[error("Failed to fetch sheet by the sheet id: {0}")]
    SheetIdNotFound(SheetId),
    #[error(
        "cannot fetch idx in the block with sheet:{0}, block_id: {1}, row id:{2} and col id: {3}"
    )]
    CannotFindIdxInBlock(SheetId, BlockId, RowId, ColId),

    #[error("text id not found: {0}")]
    TextIdNotFound(TextId),
    #[error("func id not found: {0}")]
    FuncIdNotFound(FuncId),
    #[error("ext book id not found: {0}")]
    BookIdNotFound(ExtBookId),
    #[error("name id not found: {0}")]
    NameNotFound(NameId),
    #[error("range id not found: {0}")]
    RangeIdNotFound(RangeId),
    #[error("cube id not found: {0}")]
    CubeIdNotFound(CubeId),

    #[error("sheet name not found: {0}")]
    SheetNameNotFound(String),
    #[error("sheet idx exceed the maximum: {0}")]
    SheetIdxExceed(usize),
    #[error("creating block on an existed block: {0}")]
    CreatingBlockOn(BlockId),
    #[error("ext ref id not found: {0}")]
    ExtRefIdNotFound(ExtRefId),
    #[error("ephemeral cell in reference is not allowed: {0}")]
    EphemeralCellInReference(EphemeralId),
}
