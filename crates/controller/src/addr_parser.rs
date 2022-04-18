use lazy_static::lazy_static;
use logisheets_base::{column_label_to_index, Addr, Span};
use regex::Regex;

lazy_static! {
    static ref SPAN_REGEX: Regex = Regex::new(r#"^([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$"#).unwrap();
    static ref CELL_REGEX: Regex = Regex::new(r#"^([A-Z]+)([0-9]+)"#).unwrap();
}

pub fn parse_span(s: &str) -> Option<Span> {
    let mut caps = SPAN_REGEX.captures_iter(s);
    let first = caps.next()?;
    let start_row = &first[2].parse::<usize>().unwrap_or(0) - 1;
    let end_row = &first[4].parse::<usize>().unwrap_or(0) - 1;
    let start_col = column_label_to_index(&first[1]);
    let end_col = column_label_to_index(&first[3]);
    Some(Span {
        start: Addr {
            row: start_row.to_owned(),
            col: start_col,
        },
        end: Addr {
            row: end_row.to_owned(),
            col: end_col,
        },
    })
}

pub fn parse_addr(s: &str) -> Option<Addr> {
    let mut caps = CELL_REGEX.captures_iter(s);
    let first = caps.next()?;
    let start_row = &first[2].parse::<usize>().unwrap_or(0) - 1;
    let start_col = column_label_to_index(&first[1]);
    Some(Addr {
        row: start_row,
        col: start_col,
    })
}

#[test]
fn parse_span_test() {
    let span_str = "AA1:BB22";
    let span = parse_span(span_str).unwrap();
    assert_eq!(span.start.row, 0);
    assert_eq!(span.end.row, 21);
    assert_eq!(span.start.col, 26);
    assert_eq!(span.end.col, 53);
}

#[test]
fn parse_addr_test() {
    let addr_str = "AA33";
    let addr = parse_addr(addr_str).unwrap();
    assert_eq!(addr.row, 32);
    assert_eq!(addr.col, 26);
}
