use logisheets_base::matrix_value::cross_product_usize;

// Calculate the diff between two rectangles sharing the original point
pub fn resize_rect_diff(
    master_row: usize,
    master_col: usize,
    row_cnt1: usize,
    col_cnt1: usize,
    row_cnt2: usize,
    col_cnt2: usize,
) -> Vec<(usize, usize)> {
    let (min_row, max_row) = if row_cnt1 < row_cnt2 {
        (row_cnt1, row_cnt2)
    } else {
        (row_cnt2, row_cnt1)
    };
    let (min_col, max_col) = if col_cnt1 < col_cnt2 {
        (col_cnt1, col_cnt2)
    } else {
        (col_cnt2, col_cnt1)
    };
    cross_product_usize(
        master_row,
        master_row + max_row - 1,
        master_col,
        master_col + max_col - 1,
    )
    .into_iter()
    .filter(|(r, c)| *r > master_row + min_row - 1 || *c > master_col + min_col - 1)
    .collect()
}

#[cfg(test)]
mod tests {
    use super::resize_rect_diff;

    #[test]
    fn test_resize_rect_diff() {
        let result = resize_rect_diff(0, 0, 10, 10, 11, 11);
        assert_eq!(result.len(), 21);
        let result = resize_rect_diff(10, 10, 10, 10, 11, 11);
        assert_eq!(result.len(), 21);
        let result = resize_rect_diff(10, 9, 9, 9, 7, 7);
        assert_eq!(result.len(), 32);
        let result = resize_rect_diff(10, 6, 6, 9, 7, 8);
        assert_eq!(result.len(), 15);
        let result = resize_rect_diff(3, 4, 1, 2, 3, 1);
        assert_eq!(result.len(), 5);
        assert_eq!(result, vec![(3, 5), (4, 4), (4, 5), (5, 4), (5, 5)]);
    }
}
