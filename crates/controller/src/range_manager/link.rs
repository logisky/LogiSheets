//! Mapping a (sub-)range of a linked source onto its backing block.
//!
//! A link redirects a source normal range (e.g. `A1:B4`) to a block of equal
//! column count. Referencing the WHOLE source resolves to the whole block, but a
//! reference to a SUB-range — most commonly one column of a multi-column linked
//! table, e.g. `SUM(B1:B4)` — must resolve to the block's corresponding column.
//!
//! Columns map by offset within the source (pick the right field). The row
//! extent maps to the block's full height whenever the reference spans the
//! source's full height, so variable-length growth is preserved (the same
//! interior-insert semantics as an exact-range link); a partial-row reference
//! maps by offset instead.

use imbl::HashMap;
use logisheets_base::id_fetcher::IdFetcherTrait;
use logisheets_base::index_fetcher::IndexFetcherTrait;
use logisheets_base::{BlockCellId, BlockId, BlockRange, NormalCellId, NormalRange, SheetId};

use crate::navigator::Navigator;

/// The navigation ops needed to map a linked normal sub-range onto its block.
/// Implemented for the runtime `Navigator` (used when a formula is registered)
/// and for the range executor ctx (used to remap existing formulas at link
/// creation) via thin wrappers, so the mapping logic lives in one place.
pub trait LinkNav {
    fn norm_idx(&self, sheet: SheetId, c: &NormalCellId) -> Option<(usize, usize)>;
    fn block_idx(&self, sheet: SheetId, c: &BlockCellId) -> Option<(usize, usize)>;
    fn block_cell(
        &self,
        sheet: SheetId,
        block_id: BlockId,
        row: usize,
        col: usize,
    ) -> Option<BlockCellId>;
}

/// `LinkNav` over the runtime `Navigator` (formula-registration path).
pub struct NavLink<'a>(pub &'a Navigator);

impl LinkNav for NavLink<'_> {
    fn norm_idx(&self, sheet: SheetId, c: &NormalCellId) -> Option<(usize, usize)> {
        self.0.fetch_normal_cell_idx(&sheet, c).ok()
    }
    fn block_idx(&self, sheet: SheetId, c: &BlockCellId) -> Option<(usize, usize)> {
        self.0.fetch_block_cell_idx(&sheet, c).ok()
    }
    fn block_cell(
        &self,
        sheet: SheetId,
        block_id: BlockId,
        row: usize,
        col: usize,
    ) -> Option<BlockCellId> {
        self.0.fetch_block_cell_id(&sheet, &block_id, row, col).ok()
    }
}

/// `LinkNav` over a range-executor ctx (existing-formula remap path).
pub struct CtxLink<'a, C>(pub &'a C);

impl<C: IndexFetcherTrait + IdFetcherTrait> LinkNav for CtxLink<'_, C> {
    fn norm_idx(&self, sheet: SheetId, c: &NormalCellId) -> Option<(usize, usize)> {
        self.0.fetch_normal_cell_index(&sheet, c).ok()
    }
    fn block_idx(&self, sheet: SheetId, c: &BlockCellId) -> Option<(usize, usize)> {
        self.0.fetch_block_cell_index(&sheet, c).ok()
    }
    fn block_cell(
        &self,
        sheet: SheetId,
        block_id: BlockId,
        row: usize,
        col: usize,
    ) -> Option<BlockCellId> {
        self.0.fetch_block_cell_id(&sheet, &block_id, row, col).ok()
    }
}

fn normal_corners(r: &NormalRange) -> Option<(NormalCellId, NormalCellId)> {
    match r {
        NormalRange::Single(c) => Some((*c, *c)),
        NormalRange::AddrRange(a, b) => Some((*a, *b)),
        // Unbounded row/col ranges can't be linked or offset-mapped.
        NormalRange::RowRange(..) | NormalRange::ColRange(..) => None,
    }
}

fn block_corners(r: &BlockRange) -> (BlockCellId, BlockCellId) {
    match r {
        BlockRange::Single(c) => (*c, *c),
        BlockRange::AddrRange(a, b) => (*a, *b),
    }
}

/// Outcome of resolving a normal reference against a linked (record) region.
///
/// A linked region is a variable-length RECORD: each column is a field, rows are
/// the (growable) entries. It may therefore be referenced only ONE WHOLE COLUMN
/// at a time — e.g. a linked `A1:D10` admits exactly `A1:A10`, `B1:B10`,
/// `C1:C10`, `D1:D10`. Anything else that touches the region is an error.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkRef {
    /// A valid full column of the record; redirects to this block column range,
    /// which lives on `sheet` (may differ from the source sheet — cross-sheet).
    Column { sheet: SheetId, block: BlockRange },
    /// Touches the record but isn't a valid full column → `#VALUE!`.
    Invalid,
    /// Doesn't touch any record; resolve the reference normally.
    Passthrough,
}

/// Classify `query` (on `src_sheet`) against a SINGLE link whose target block is
/// on `tgt_sheet`. Returns `None` if the query doesn't overlap the source region
/// at all; otherwise `Column` (a valid full-height column, mapped to the block on
/// `tgt_sheet`) or `Invalid`.
pub fn classify<N: LinkNav>(
    nav: &N,
    src_sheet: SheetId,
    tgt_sheet: SheetId,
    source: &NormalRange,
    target: &BlockRange,
    query: &NormalRange,
) -> Option<LinkRef> {
    let (q0, q1) = normal_corners(query)?;
    let (s0, s1) = normal_corners(source)?;
    let (qr0, qc0) = nav.norm_idx(src_sheet, &q0)?;
    let (qr1, qc1) = nav.norm_idx(src_sheet, &q1)?;
    let (sr0, sc0) = nav.norm_idx(src_sheet, &s0)?;
    let (sr1, sc1) = nav.norm_idx(src_sheet, &s1)?;
    let (qr0, qr1) = (qr0.min(qr1), qr0.max(qr1));
    let (qc0, qc1) = (qc0.min(qc1), qc0.max(qc1));
    let (sr0, sr1) = (sr0.min(sr1), sr0.max(sr1));
    let (sc0, sc1) = (sc0.min(sc1), sc0.max(sc1));

    // No overlap with this record region → this link doesn't apply.
    if qr1 < sr0 || qr0 > sr1 || qc1 < sc0 || qc0 > sc1 {
        return None;
    }

    // Valid iff the query is exactly one full-height column within the region.
    let valid = qc0 == qc1 && qc0 >= sc0 && qc0 <= sc1 && qr0 == sr0 && qr1 == sr1;
    if !valid {
        return Some(LinkRef::Invalid);
    }

    // Map that column onto the block's corresponding inner column, spanning the
    // block's full height (reads the whole list + tracks variable-length growth).
    // The block is navigated on its OWN sheet (`tgt_sheet`).
    let (b0, b1) = block_corners(target);
    let block_id = b0.block_id;
    // `block_idx` returns SHEET coords; the corners' row span is the block's
    // inner bottom-row index (blocks are contiguous rectangles).
    let (br0, _) = nav.block_idx(tgt_sheet, &b0)?;
    let (br1, _) = nav.block_idx(tgt_sheet, &b1)?;
    let block_inner_bottom = br0.max(br1) - br0.min(br1);
    let inner_col = qc0 - sc0;
    let top = nav.block_cell(tgt_sheet, block_id, 0, inner_col)?;
    let bottom = nav.block_cell(tgt_sheet, block_id, block_inner_bottom, inner_col)?;
    Some(LinkRef::Column {
        sheet: tgt_sheet,
        block: BlockRange::AddrRange(top, bottom),
    })
}

/// Resolve `query` (on `src_sheet`) against every link on that sheet. The first
/// record region the query touches decides the outcome; if it touches none, it's
/// a `Passthrough`. Each link's value is `(target_sheet, block)`.
pub fn resolve_normal<N: LinkNav>(
    nav: &N,
    src_sheet: SheetId,
    links: &HashMap<NormalRange, (SheetId, BlockRange)>,
    query: &NormalRange,
) -> LinkRef {
    links
        .iter()
        .find_map(|(source, (tgt_sheet, target))| {
            classify(nav, src_sheet, *tgt_sheet, source, target, query)
        })
        .unwrap_or(LinkRef::Passthrough)
}
