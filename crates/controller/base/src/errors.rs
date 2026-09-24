use thiserror::Error;

use crate::{
    BlockId, ColId, CubeId, EphemeralId, ExtBookId, ExtRefId, FuncId, NameId, RangeId, RowId,
    SheetId, TextId,
};

pub type Result<T> = std::result::Result<T, BasicError>;

/// Failures from the engine's lookup and addressing layer. Every message says
/// which addressing scheme a number belongs to — an index (a position, which
/// moves) or an id (stable) — never just "sheet 3", since confusing the two is
/// what causes most of these. Where it happened comes from the context around
/// it, not from here.
#[derive(Debug, Error)]
pub enum BasicError {
    #[error("no row exists at row index {0}")]
    RowIdNotFound(usize),
    #[error("no column exists at column index {0}")]
    ColIdNotFound(usize),
    #[error("no cell exists at row index {0}, column index {1}")]
    CellIdNotFound(usize, usize),
    #[error("row id {0} is not in this sheet, so it has no row index")]
    RowIndexUnavailable(RowId),
    #[error("column id {0} is not in this sheet, so it has no column index")]
    ColIndexUnavailable(ColId),
    #[error("sheet id {0} has no block with block id {1}")]
    BlockIdNotFound(SheetId, BlockId),
    #[error(
        "block id {1} on sheet id {0} has no cell at row index {2}, column index {3} (both indices are relative to the block, not to the sheet)"
    )]
    BlockCellIdNotFound(SheetId, BlockId, usize, usize),
    #[error(
        "block id {1} on sheet id {0} has no row at row index {2} (the index is relative to the block, not to the sheet)"
    )]
    BlockRowIdNotFound(SheetId, BlockId, usize),
    #[error(
        "block id {1} on sheet id {0} has no column at column index {2} (the index is relative to the block, not to the sheet)"
    )]
    BlockColIdNotFound(SheetId, BlockId, usize),
    #[error(
        "block ref name {0:?} is already used by block id {2} on sheet id {1}. Ref names \
         are how formulas reach a block, so they must be unique across the \
         workbook — reusing one would silently redirect every existing \
         BLOCKREF to the new block"
    )]
    BlockRefNameTaken(String, SheetId, BlockId),
    #[error("cannot create a block with block id {0}: that id is already taken on this sheet")]
    BlockIdHasAlreadyExisted(BlockId),
    #[error("no block with block id {0} exists on this sheet")]
    BlockIdDoesNotExist(BlockId),
    #[error("no sheet exists with sheet id {0}")]
    SheetIdNotFound(SheetId),
    #[error(
        "block id {1} on sheet id {0} has no cell with row id {2} and column id {3}; the ids belong to another block or were removed"
    )]
    CannotFindIdxInBlock(SheetId, BlockId, RowId, ColId),

    #[error("no interned text with text id {0}")]
    TextIdNotFound(TextId),
    #[error("no registered function with func id {0}")]
    FuncIdNotFound(FuncId),
    #[error("no external workbook with book id {0}")]
    BookIdNotFound(ExtBookId),
    #[error("no defined name with name id {0}")]
    NameNotFound(NameId),
    #[error("no range with range id {0}")]
    RangeIdNotFound(RangeId),
    #[error("no cube with cube id {0}")]
    CubeIdNotFound(CubeId),

    #[error("no sheet is named {0:?}")]
    SheetNameNotFound(String),
    #[error("a sheet named {0:?} already exists; sheet names must be unique in a workbook")]
    SheetNameAlreadyExists(String),
    #[error("sheet index {0} is out of range; the workbook has fewer sheets than that")]
    SheetIdxExceed(usize),
    #[error("cannot create a block here: block id {0} already covers one of these cells")]
    CreatingBlockOn(BlockId),
    #[error(
        "a block must be anchored on a grid cell, not on ephemeral cell id {0} (ephemeral cells are scratch cells and are never saved)"
    )]
    CreatingBlockOnEphemeral(EphemeralId),
    #[error(
        "a block of {0} rows x {1} columns is too large: the limits are {2} rows, {3} columns and {4} cells"
    )]
    BlockTooLarge(u32, u32, u32, u32, u64),
    #[error("{0} line(s) at index {1} run past the end of the sheet, which holds at most {2}")]
    LineRangeOutOfSheet(u32, usize, u32),
    #[error(
        "{1} line(s) starting at index {0} run past the end of block id {2}, which has {3} line(s)"
    )]
    LineRangeOutOfBlock(usize, u32, BlockId, usize),
    #[error(
        "the new order for block id {0} must be a permutation of its {1} line(s): every index exactly once"
    )]
    BadBlockLineOrder(BlockId, usize),
    #[error("no external reference with ext ref id {0}")]
    ExtRefIdNotFound(ExtRefId),
    #[error(
        "ephemeral cell id {0} cannot appear in a reference: ephemeral cells are scratch cells with no address on the grid"
    )]
    EphemeralCellInReference(EphemeralId),

    #[error("{0:?} is not a valid formula")]
    InvalidFormula(String),
    #[error(
        "cannot bind a form of {1} rows x {2} columns to block id {0}: the form is larger than the block"
    )]
    BindBlockSizeMismatch(BlockId, usize, usize),
    #[error("no sheet exists with sheet id {0}")]
    UnavailableSheetId(SheetId),
    #[error(
        "no appendix tagged {tag} for craft {craft_id:?} was found at or above this cell in block id {block_id}"
    )]
    NoAppendix {
        block_id: BlockId,
        craft_id: String,
        tag: u8,
    },
    #[error("no checkpoint is saved under the label {0:?}")]
    CheckpointNotFound(String),
    #[error(
        "{0:?} is not a valid name: start with a letter, `_` or `\\`, use only letters, digits, `_` and `.`, and do not look like a cell reference (A1, R1C1) or TRUE/FALSE"
    )]
    InvalidDefinedName(String),
    #[error("no defined name is called {0:?}")]
    DefinedNameNotFound(String),
    #[error("a defined name called {0:?} already exists; names are case-insensitive")]
    DefinedNameAlreadyExists(String),
    #[error("{0:?} cannot be defined this way: the definition refers back to {0:?} itself")]
    DefinedNameCycle(String),
    #[error(
        "row indices and column indices must pair up one to one, but {0} row index(es) came with {1} column index(es)"
    )]
    IncompleteRowColLength(usize, usize),
    #[error(
        "ephemeral cell id {0} has no position on the grid, so it cannot be addressed by row and column"
    )]
    ReferencingEphemeralCell(EphemeralId),
    #[error("no shadow cell with shadow id {0}")]
    InvalidShadowId(u64),
    #[error("the payload is missing {0}")]
    IncompletePayload(&'static str),

    /// What the engine was doing when the failure inside happened. An id
    /// several layers from the coordinate it came from means nothing on its
    /// own — and a block cell's lookup can fail on its block's anchor, a
    /// different cell from the one asked about.
    #[error("{doing}: {source}")]
    While {
        doing: String,
        source: Box<BasicError>,
    },
}

/// Attach what was being attempted to a failure on its way up. Lazy, so a
/// request that succeeds pays nothing for the description.
pub trait Context<T> {
    fn context(self, doing: impl FnOnce() -> String) -> Result<T>;
}

impl<T> Context<T> for Result<T> {
    fn context(self, doing: impl FnOnce() -> String) -> Result<T> {
        self.map_err(|source| BasicError::While {
            doing: doing(),
            source: Box::new(source),
        })
    }
}
