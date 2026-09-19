use logisheets_base::{CellId, NormalRange, SheetId};

use crate::{Error, range_manager::ctx::RangeExecCtx};

pub fn get_lower_upper_bound_of_range<C>(
    sheet_id: SheetId,
    range: &NormalRange,
    horizontal: bool,
    context: &C,
) -> Result<(usize, usize), Error>
where
    C: RangeExecCtx,
{
    let bounds = match range {
        NormalRange::RowRange(start, end) => {
            if horizontal {
                let start_idx = context.fetch_row_index(&sheet_id, start)?;
                let end_idx = context.fetch_row_index(&sheet_id, end)?;
                (start_idx, end_idx)
            } else {
                (usize::MIN, usize::MAX)
            }
        }
        NormalRange::ColRange(start, end) => {
            if horizontal {
                (usize::MIN, usize::MAX)
            } else {
                let start_idx = context.fetch_col_index(&sheet_id, start)?;
                let end_idx = context.fetch_col_index(&sheet_id, end)?;
                (start_idx, end_idx)
            }
        }
        NormalRange::AddrRange(start, end) => {
            let (row_start, col_start) =
                context.fetch_cell_index(&sheet_id, &CellId::NormalCell(*start))?;
            let (row_end, col_end) =
                context.fetch_cell_index(&sheet_id, &CellId::NormalCell(*end))?;
            if horizontal {
                (row_start, row_end)
            } else {
                (col_start, col_end)
            }
        }
        NormalRange::Single(cell) => {
            let (row, col) = context.fetch_normal_cell_index(&sheet_id, cell)?;
            if horizontal { (row, row) } else { (col, col) }
        }
    };
    Ok(bounds)
}

pub fn cut_and_get_new_bound(
    range_start: usize,
    range_end: usize,
    delete_start: usize,
    delete_end: usize,
) -> Option<(usize, usize)> {
    if delete_start <= range_start && delete_end <= range_end && delete_end >= range_start {
        // In this case, some top cells deleted and the bottom ones move upwards.
        let deleted_cnt = delete_end - range_start + 1;
        Some((delete_end + 1 - deleted_cnt, range_end - deleted_cnt))
    } else if delete_start > range_start && delete_start <= range_end && delete_end >= range_end {
        Some((range_start, delete_start - 1))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cut_and_get_new_bound() {
        let (start, end) = cut_and_get_new_bound(1, 3, 3, 3).unwrap();
        assert_eq!(start, 1);
        assert_eq!(end, 2);
    }
}
