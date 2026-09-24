use logisheets_base::{Addr, Cube, CubeCross, SheetId, index_fetcher::IndexFetcherTrait};

/// Whether `sheet` lies in the cube's sheet span, by tab position. The ends
/// may be given in either order (`Sheet3:Sheet1` spans the same sheets as
/// `Sheet1:Sheet3`). A span whose end sheet is gone contains nothing: such a
/// cube already evaluates to #REF!, and it must not fail an unrelated edit.
pub fn cube_spans_sheet<C: IndexFetcherTrait>(ctx: &C, cube: &Cube, sheet: &SheetId) -> bool {
    let (Ok(a), Ok(b), Ok(curr)) = (
        ctx.fetch_sheet_index(&cube.from_sheet),
        ctx.fetch_sheet_index(&cube.to_sheet),
        ctx.fetch_sheet_index(sheet),
    ) else {
        return false;
    };
    a.min(b) <= curr && curr <= a.max(b)
}

pub fn get_lower_upper_bound_of_cross(cross: &CubeCross, is_horizontal: bool) -> (usize, usize) {
    let (lower, upper) = match cross {
        CubeCross::Single(row_idx, col_idx) => {
            if is_horizontal {
                (*row_idx, *row_idx)
            } else {
                (*col_idx, *col_idx)
            }
        }
        CubeCross::RowRange(l, h) => {
            if is_horizontal {
                (*l, *h)
            } else {
                (0, usize::MAX)
            }
        }
        CubeCross::ColRange(l, h) => {
            if is_horizontal {
                (0, usize::MAX)
            } else {
                (*l, *h)
            }
        }
        CubeCross::AddrRange(
            Addr {
                row: start_row,
                col: start_col,
            },
            Addr {
                row: end_row,
                col: end_col,
            },
        ) => {
            if is_horizontal {
                (*start_row, *end_row)
            } else {
                (*start_col, *end_col)
            }
        }
    };
    (lower, upper)
}
