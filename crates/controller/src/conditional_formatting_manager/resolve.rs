//! Conversion between OOXML `sqref` strings and id-anchored [`CfRange`]s.
//!
//! `sqref` → ids happens once, after the load has fully settled (blocks
//! included); ids → `sqref` happens on every save. Positions are always read
//! back from the navigator, so a range whose anchor rows moved reports its new
//! location without anything having to rewrite it.

use imbl::Vector;
use logisheets_base::SheetId;

use super::CfRange;

const MAX_ROW: usize = MAX_ROW_CNT as usize;
const MAX_COL: usize = MAX_COL_CNT as usize;
use crate::navigator::Navigator;
use crate::navigator::sheet_nav::{MAX_COL_CNT, MAX_ROW_CNT};
use crate::sqref::{UNBOUNDED, format_col_range, format_rect, format_row_range, parse_sqref};

/// Resolve an `sqref` into id-anchored ranges. Tokens that don't parse, or
/// whose corner cells can't be resolved in this sheet, are dropped.
pub(crate) fn resolve_sqref(nav: &Navigator, sheet_id: SheetId, sqref: &str) -> Vector<CfRange> {
    parse_sqref(sqref)
        .into_iter()
        .filter_map(|r| {
            // Order matters: a whole-column token parses with an unbounded row
            // bound, so it must be recognized before we try to anchor corners.
            if r.is_col_range() {
                let c0 = nav.fetch_col_id(&sheet_id, r.c0).ok()?;
                let c1 = nav.fetch_col_id(&sheet_id, r.c1).ok()?;
                Some(CfRange::ColRange(c0, c1))
            } else if r.is_row_range() {
                let r0 = nav.fetch_row_id(&sheet_id, r.r0).ok()?;
                let r1 = nav.fetch_row_id(&sheet_id, r.r1).ok()?;
                Some(CfRange::RowRange(r0, r1))
            } else if r.r1 == UNBOUNDED || r.c1 == UNBOUNDED {
                // Half-open and not a clean row/column range (`B2:B`): we have
                // no sane anchor for the open end, so drop it rather than
                // resolve a cell id at usize::MAX.
                None
            } else {
                // `fetch_cell_id` PANICS past the end of the sheet rather than
                // returning an error, so the bound check has to happen here —
                // `.ok()?` would not catch it. Clamp instead of dropping: a
                // range running to the last row is a legitimate way to say
                // "the whole column" and Excel writes exactly that.
                let r0 = r.r0.min(MAX_ROW - 1);
                let c0 = r.c0.min(MAX_COL - 1);
                let r1 = r.r1.min(MAX_ROW - 1);
                let c1 = r.c1.min(MAX_COL - 1);
                let start = nav.fetch_cell_id(&sheet_id, r0, c0).ok()?;
                let end = nav.fetch_cell_id(&sheet_id, r1, c1).ok()?;
                Some(CfRange::Rect(start, end))
            }
        })
        .collect()
}

/// The current bounds of a range as `(r0, c0, r1, c1)`, with [`UNBOUNDED`] on
/// the open axis of a row/column range. `None` when an anchor no longer exists
/// (its row or column was deleted) — the range is then effectively gone.
pub(crate) fn range_bounds(
    nav: &Navigator,
    sheet_id: SheetId,
    range: &CfRange,
) -> Option<(usize, usize, usize, usize)> {
    match range {
        CfRange::Rect(start, end) => {
            let (r0, c0) = nav.fetch_cell_idx(&sheet_id, start).ok()?;
            let (r1, c1) = nav.fetch_cell_idx(&sheet_id, end).ok()?;
            // Normalize: a reorder could in principle flip the corners.
            Some((r0.min(r1), c0.min(c1), r0.max(r1), c0.max(c1)))
        }
        CfRange::RowRange(a, b) => {
            let r0 = nav.fetch_row_idx(&sheet_id, a).ok()?;
            let r1 = nav.fetch_row_idx(&sheet_id, b).ok()?;
            Some((r0.min(r1), 0, r0.max(r1), UNBOUNDED))
        }
        CfRange::ColRange(a, b) => {
            let c0 = nav.fetch_col_idx(&sheet_id, a).ok()?;
            let c1 = nav.fetch_col_idx(&sheet_id, b).ok()?;
            Some((0, c0.min(c1), UNBOUNDED, c0.max(c1)))
        }
    }
}

/// Whether `(row, col)` is currently covered by `range`. This is the
/// membership test evaluation will run per cell; nothing evaluates yet.
#[allow(dead_code)]
pub(crate) fn range_contains(
    nav: &Navigator,
    sheet_id: SheetId,
    range: &CfRange,
    row: usize,
    col: usize,
) -> bool {
    match range_bounds(nav, sheet_id, range) {
        Some((r0, c0, r1, c1)) => row >= r0 && row <= r1 && col >= c0 && col <= c1,
        None => false,
    }
}

/// Render one range back to an A1 token, or `None` if its anchors are gone.
fn range_to_token(nav: &Navigator, sheet_id: SheetId, range: &CfRange) -> Option<String> {
    let (r0, c0, r1, c1) = range_bounds(nav, sheet_id, range)?;
    match range {
        CfRange::Rect(_, _) => Some(format_rect(r0, c0, r1, c1)),
        CfRange::RowRange(_, _) => Some(format_row_range(r0, r1)),
        CfRange::ColRange(_, _) => Some(format_col_range(c0, c1)),
    }
}

/// Render a range list back to an `sqref`. Ranges whose anchors no longer
/// resolve are dropped; an all-dropped list yields an empty string, which the
/// saver treats as "omit this `<conditionalFormatting>` element".
pub(crate) fn ranges_to_sqref(
    nav: &Navigator,
    sheet_id: SheetId,
    ranges: &Vector<CfRange>,
) -> String {
    ranges
        .iter()
        .filter_map(|r| range_to_token(nav, sheet_id, r))
        .collect::<Vec<_>>()
        .join(" ")
}
