use logisheets_base::column_label_to_index;
use regex::Regex;

lazy_static! {
    static ref A1_ADDR_REGEX: Regex = Regex::new(r#"\$?([A-Za-z]+)\$?([0-9]+)"#).unwrap();
}
// A1 => (0, 0)
pub fn parse_cell(r: &str) -> Option<(usize, usize)> {
    let capture = A1_ADDR_REGEX.captures_iter(&r).next()?;
    let c = capture.get(1)?.as_str();
    let r = capture.get(2)?.as_str();
    let col_idx = column_label_to_index(c);
    match r.parse::<usize>() {
        // Rows are 1-based, so there is no row 0 to convert — subtracting from
        // it underflowed a usize and took the load down. The parser's own
        // `parse_row` already refuses it for the same reason; this is the copy
        // that reads the FILE, where the number is not ours.
        Ok(0) => None,
        Ok(row_idx) => Some((row_idx - 1, col_idx)),
        Err(_) => None,
    }
}

pub fn parse_range(r: &str) -> Option<((usize, usize), (usize, usize))> {
    let mut s = r.split(':');
    let start = s.next()?.trim();
    let end = s.next()?.trim();
    let start_addr = parse_cell(start)?;
    let end_addr = parse_cell(end)?;
    Some((start_addr, end_addr))
}

#[cfg(test)]
mod tests {
    use super::{parse_cell, parse_range};
    #[test]
    fn parse_cell_test() {
        let s = "$A$2";
        let r = parse_cell(s);
        assert!(matches!(r, Some((1, 0))));
        let s = "A$2";
        let r = parse_cell(s);
        assert!(matches!(r, Some((1, 0))));
        let s = "AA2";
        let r = parse_cell(s);
        assert!(matches!(r, Some((1, 26))));
        let s = "AA20";
        let r = parse_cell(s);
        assert!(matches!(r, Some((19, 26))));
        let s = "A9";
        let r = parse_cell(s);
        assert!(matches!(r, Some((8, 0))));
    }

    #[test]
    fn parse_range_test() {
        let s = "A2:B4";
        let r = parse_range(s);
        assert!(matches!(r, Some(((1, 0), (3, 1)))));
    }
}
