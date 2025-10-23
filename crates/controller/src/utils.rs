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

pub fn turn_indexed_color_to_rgb(index: u32) -> String {
    match index {
        0 => String::from("FF000000"),
        1 => String::from("FFFFFFFF"),
        2 => String::from("FFFF0000"),
        3 => String::from("FF00FF00"),
        4 => String::from("FF0000FF"),
        5 => String::from("FFFFFF00"),
        6 => String::from("FFFF00FF"),
        7 => String::from("FF00FFFF"),
        8 => String::from("FF000000"),
        9 => String::from("FFFFFFFF"),
        10 => String::from("FFFF0000"),
        11 => String::from("FF00FF00"),
        12 => String::from("FF0000FF"),
        13 => String::from("FFFFFF00"),
        14 => String::from("FFFF00FF"),
        15 => String::from("FF00FFFF"),
        16 => String::from("FF800000"),
        17 => String::from("FF008000"),
        18 => String::from("FF000080"),
        19 => String::from("FF808000"),
        20 => String::from("FF800080"),
        21 => String::from("FF008080"),
        22 => String::from("FFC0C0C0"),
        23 => String::from("FF808080"),
        24 => String::from("FF9999FF"),
        25 => String::from("FF993366"),
        26 => String::from("FFFFFFCC"),
        27 => String::from("FFCCFFFF"),
        28 => String::from("FF660066"),
        29 => String::from("FFFF8080"),
        30 => String::from("FF0066CC"),
        31 => String::from("FFCCCCFF"),
        32 => String::from("FF000080"),
        33 => String::from("FFFF00FF"),
        34 => String::from("FFFFFF00"),
        35 => String::from("FF00FFFF"),
        36 => String::from("FF800080"),
        37 => String::from("FF800000"),
        38 => String::from("FF008080"),
        39 => String::from("FF0000FF"),
        40 => String::from("FF00CCFF"),
        41 => String::from("FFCCFFFF"),
        42 => String::from("FFCCFFCC"),
        43 => String::from("FFFFFF99"),
        44 => String::from("FF99CCFF"),
        45 => String::from("FFFF99CC"),
        46 => String::from("FFCC99FF"),
        47 => String::from("FFFFCC99"),
        48 => String::from("FF3366FF"),
        49 => String::from("FF33CCCC"),
        50 => String::from("FF99CC00"),
        51 => String::from("FFFFCC00"),
        52 => String::from("FFFF9900"),
        53 => String::from("FFFF6600"),
        54 => String::from("FF666699"),
        55 => String::from("FF969696"),
        56 => String::from("FF003366"),
        57 => String::from("FF339966"),
        58 => String::from("FF003300"),
        59 => String::from("FF333300"),
        60 => String::from("FF993300"),
        61 => String::from("FF993366"),
        62 => String::from("FF333399"),
        63 => String::from("FF333333"),
        _ => String::from("FF000000"),
    }
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
