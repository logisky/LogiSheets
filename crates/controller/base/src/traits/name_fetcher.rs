use crate::{
    BlockFieldId, BlockId, CellId, ColId, Cube, CubeId, ExtBookId, ExtRef, ExtRefId, FuncId,
    NameId, Range, RangeId, RowId, SheetId, TextId, errors::BasicError,
};

pub trait NameFetcherTrait {
    fn fetch_text(&self, text_id: &TextId) -> Result<String, BasicError>;
    fn fetch_func_name(&self, func_id: &FuncId) -> Result<String, BasicError>;
    fn fetch_sheet_name(&self, sheet_id: &SheetId) -> Result<String, BasicError>;
    fn fetch_book_name(&self, book_id: &ExtBookId) -> Result<String, BasicError>;
    fn fetch_defined_name(&self, nid: &NameId) -> Result<String, BasicError>;
    fn fetch_cell_idx(
        &self,
        sheet_id: &SheetId,
        cell_id: &CellId,
    ) -> Result<(usize, usize), BasicError>;
    fn fetch_row_idx(&self, sheet_id: &SheetId, row_id: &RowId) -> Result<usize, BasicError>;
    fn fetch_col_idx(&self, sheet_id: &SheetId, col_id: &ColId) -> Result<usize, BasicError>;
    fn fetch_range(&self, sheet_id: &SheetId, range_id: &RangeId) -> Result<Range, BasicError>;
    fn fetch_cube(&self, cube_id: &CubeId) -> Result<Cube, BasicError>;
    fn fetch_ext_ref(&mut self, ext_ref_id: &ExtRefId) -> Result<ExtRef, BasicError>;

    /// Reverse-lookup a block ref-name from `(sheet_id, block_id)`, used by
    /// unparse to render BLOCKREF formulas with the block's *current* name.
    /// Returns `None` if the block has no schema bound.
    fn fetch_block_ref_name_by_id(&self, _sheet_id: SheetId, _block_id: BlockId) -> Option<String> {
        None
    }

    /// Reverse-lookup a field name. Returns `None` if the schema does not
    /// know this field id (e.g., field has been removed since parse time).
    fn fetch_block_field_name_by_id(
        &self,
        _sheet_id: SheetId,
        _block_id: BlockId,
        _field_id: BlockFieldId,
    ) -> Option<String> {
        None
    }

    /// Resolve a `BLOCKREF` target to the concrete cell it names, so unparse can
    /// print an ordinary `A1` reference instead of the `BLOCKREF(...)` call.
    ///
    /// `None` — the default — means "keep the BLOCKREF form", which is what
    /// every caller wants except an export aimed at a foreign reader. Excel has
    /// no BLOCKREF function, so a file it must recalculate needs coordinates;
    /// LogiSheets itself is better served by the named form, which survives
    /// rows moving and blocks being renamed.
    ///
    /// `key` is the already-unparsed key expression. Implementors should resolve
    /// only a literal key and return `None` for anything computed, since a
    /// runtime expression has no single cell to point at.
    fn resolve_block_ref_cell(
        &self,
        _sheet_id: SheetId,
        _block_id: BlockId,
        _field_id: BlockFieldId,
        _key: &str,
    ) -> Option<(usize, usize)> {
        None
    }

    /// Resolve a `BLOCKREFS` scan to the rectangle it covers, for the same
    /// reason as {@link resolve_block_ref_cell}.
    ///
    /// Only the statically-decidable shape is expected: an all-rows key filter
    /// and a literal field name. Anything else returns `None` and keeps the
    /// BLOCKREFS form.
    fn resolve_block_refs_range(
        &self,
        _sheet_id: SheetId,
        _block_id: BlockId,
        _key_condition: &str,
        _field_condition: &str,
    ) -> Option<((usize, usize), (usize, usize))> {
        None
    }
}
