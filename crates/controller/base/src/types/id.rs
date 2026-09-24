pub type Id = u32;
/// A row id, stable across inserts and deletes. Scoped to one sheet (or,
/// inside a `BlockCellId`, to one block); not a position.
pub type RowId = u32;
/// A column id; same scoping as [`RowId`].
pub type ColId = u32;
pub type BlockFieldId = u32;
pub type RangeId = u32;
pub type CubeId = u32;
pub type ExtRefId = u32;
/// A sheet's stable id. Unlike a `sheet_idx` (tab position) it does not
/// change when sheets are added, removed or reordered, and it is not reused
/// after a sheet is deleted.
pub type SheetId = u16;
/// Index into the workbook's shared-text table.
pub type TextId = u32;
pub type NameId = u32;
pub type FuncId = u16;
/// Chosen by the caller when creating a block; unique within a sheet.
pub type BlockId = usize;
pub const CURR_BOOK: ExtBookId = 0;
pub type ExtBookId = u8;
pub type AuthorId = u8;
pub type PersonId = u32;
pub type StyleId = u32;

/// Id of a `CellId::EphemeralCell`, chosen by whoever writes it.
pub type EphemeralId = u64;

pub type DiyCellId = u32;
