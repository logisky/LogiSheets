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
    #[error("Failed to fetch block row id by the block id: {1}, row index: {2} in sheet {0}")]
    BlockRowIdNotFound(SheetId, BlockId, usize),
    #[error("Failed to fetch block col id by the block id: {1}, col index: {2} in sheet {0}")]
    BlockColIdNotFound(SheetId, BlockId, usize),
    #[error(
        "block ref name {0:?} is already used by block {2} on sheet {1}. Ref names \
         are how formulas reach a block, so they must be unique across the \
         workbook — reusing one would silently redirect every existing \
         BLOCKREF to the new block"
    )]
    BlockRefNameTaken(String, SheetId, BlockId),
    #[error("Failed to create block because the block id is already existed")]
    BlockIdHasAlreadyExisted(BlockId),
    #[error("Failed to create block because the block id is not existed")]
    BlockIdDoesNotExist(BlockId),
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
    #[error("sheet name already exists: {0}")]
    SheetNameAlreadyExists(String),
    #[error("sheet idx exceeds the maximum: {0}")]
    SheetIdxExceed(usize),
    #[error("creating block on an existed block: {0}")]
    CreatingBlockOn(BlockId),
    #[error("a block must be anchored on a grid cell, not an ephemeral one: {0}")]
    CreatingBlockOnEphemeral(EphemeralId),
    #[error(
        "block of {0} rows x {1} cols is too large: at most {2} rows, {3} cols and {4} cells"
    )]
    BlockTooLarge(u32, u32, u32, u32, u64),
    #[error("{0} lines at index {1} is out of range: a sheet holds at most {2}")]
    LineRangeOutOfSheet(u32, usize, u32),
    #[error("line range [{0}, +{1}) is outside block {2}, which has {3} line(s)")]
    LineRangeOutOfBlock(usize, u32, BlockId, usize),
    #[error("reorder of block {0} must be a permutation of its {1} line(s)")]
    BadBlockLineOrder(BlockId, usize),
    #[error("ext ref id not found: {0}")]
    ExtRefIdNotFound(ExtRefId),
    #[error("ephemeral cell in reference is not allowed: {0}")]
    EphemeralCellInReference(EphemeralId),

    #[error("invalid formula: {0}")]
    InvalidFormula(String),
    #[error("bind block size mismatch: {0}, {1}, {2}")]
    BindBlockSizeMismatch(BlockId, usize, usize),
    #[error("sheet id not found: {0}")]
    UnavailableSheetId(SheetId),
    #[error("no appendix is found")]
    NoAppendix,
    #[error("checkpoint not found: {0}")]
    CheckpointNotFound(String),
    #[error("incomplete row col length: {0}, {1}")]
    IncompleteRowColLength(usize, usize),
    #[error("referencing ephemeral cell")]
    ReferencingEphemeralCell,
    #[error("invalid shadow id: {0}")]
    InvalidShadowId(u64),
    #[error("invalid payload")]
    InvalidPayload,
}
