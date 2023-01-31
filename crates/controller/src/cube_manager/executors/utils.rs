use logisheets_base::{Addr, CubeCross};

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
