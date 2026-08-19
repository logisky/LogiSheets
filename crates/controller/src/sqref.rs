//! Parsing and formatting of OOXML `sqref` attributes — the space-separated A1
//! range lists used by data validation (`<dataValidation sqref="...">`) and
//! conditional formatting (`<conditionalFormatting sqref="...">`).
//!
//! Parsing yields *positions*; turning those into the stable ids the engine
//! actually stores is the caller's job (it needs a navigator).

/// A rectangular range from an `sqref`, 0-based inclusive. Missing bounds
/// (e.g. a whole-column `A:A`) come back as [`UNBOUNDED`], which the caller is
/// expected to interpret as "the full extent of that axis".
#[derive(Debug, Clone, Copy)]
pub struct SqrefRange {
    pub r0: usize,
    pub c0: usize,
    pub r1: usize,
    pub c1: usize,
}

/// The upper bound a missing A1 dimension parses to. `A:A` gives `r1 ==
/// UNBOUNDED`, `1:1` gives `c1 == UNBOUNDED`.
pub const UNBOUNDED: usize = usize::MAX;

impl SqrefRange {
    pub fn contains(&self, row: usize, col: usize) -> bool {
        row >= self.r0 && row <= self.r1 && col >= self.c0 && col <= self.c1
    }

    /// Whole columns (`A:B`): every row, a bounded column span.
    pub fn is_col_range(&self) -> bool {
        self.r0 == 0 && self.r1 == UNBOUNDED && self.c1 != UNBOUNDED
    }

    /// Whole rows (`1:3`): every column, a bounded row span.
    pub fn is_row_range(&self) -> bool {
        self.c0 == 0 && self.c1 == UNBOUNDED && self.r1 != UNBOUNDED
    }
}

/// Parse an `sqref` (space-separated A1 ranges, e.g. `"A1:A10 C1 D2:E5"`) into
/// rectangular ranges. Tokens that don't parse are skipped.
pub fn parse_sqref(sqref: &str) -> Vec<SqrefRange> {
    sqref
        .split_whitespace()
        .filter_map(parse_range_token)
        .collect()
}

fn parse_range_token(tok: &str) -> Option<SqrefRange> {
    let (start, end) = match tok.split_once(':') {
        Some((a, b)) => (a, b),
        None => (tok, tok),
    };
    let (r0, c0) = parse_a1(start, false);
    let (r1, c1) = parse_a1(end, true);
    if c0 > c1 || r0 > r1 {
        return None;
    }
    Some(SqrefRange { r0, c0, r1, c1 })
}

/// Parse an A1 ref into (row, col), 0-based. A missing dimension defaults to 0
/// (`upper=false`) or [`UNBOUNDED`] (`upper=true`), so `A:A` / `1:1` work.
fn parse_a1(s: &str, upper: bool) -> (usize, usize) {
    let s = s.replace('$', "");
    let letters: String = s.chars().take_while(|c| c.is_ascii_alphabetic()).collect();
    let digits: String = s
        .chars()
        .skip_while(|c| c.is_ascii_alphabetic())
        .filter(|c| c.is_ascii_digit())
        .collect();
    let col = if letters.is_empty() {
        if upper { UNBOUNDED } else { 0 }
    } else {
        col_to_idx(&letters)
    };
    let row = match digits.parse::<usize>() {
        Ok(r) if r >= 1 => r - 1,
        _ => {
            if upper {
                UNBOUNDED
            } else {
                0
            }
        }
    };
    (row, col)
}

pub(crate) fn col_to_idx(letters: &str) -> usize {
    let mut idx = 0usize;
    for c in letters.chars() {
        idx = idx * 26 + (c.to_ascii_uppercase() as usize - 'A' as usize + 1);
    }
    idx - 1
}

/// A 0-based column index as A1 letters (`0` → `A`, `26` → `AA`).
pub fn col_to_letters(mut col: usize) -> String {
    let mut out = Vec::new();
    loop {
        out.push(b'A' + (col % 26) as u8);
        if col < 26 {
            break;
        }
        col = col / 26 - 1;
    }
    out.reverse();
    String::from_utf8(out).unwrap()
}

/// One A1 token for a bounded rectangle, collapsing a 1x1 rect to `A1`.
pub fn format_rect(r0: usize, c0: usize, r1: usize, c1: usize) -> String {
    let start = format!("{}{}", col_to_letters(c0), r0 + 1);
    if r0 == r1 && c0 == c1 {
        return start;
    }
    format!("{}:{}{}", start, col_to_letters(c1), r1 + 1)
}

/// One A1 token for whole columns (`A:B`).
pub fn format_col_range(c0: usize, c1: usize) -> String {
    format!("{}:{}", col_to_letters(c0), col_to_letters(c1))
}

/// One A1 token for whole rows (`1:3`).
pub fn format_row_range(r0: usize, r1: usize) -> String {
    format!("{}:{}", r0 + 1, r1 + 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_bounded() {
        let r = parse_sqref("A1:B10");
        assert_eq!(r.len(), 1);
        assert_eq!((r[0].r0, r[0].c0, r[0].r1, r[0].c1), (0, 0, 9, 1));
        assert!(!r[0].is_col_range() && !r[0].is_row_range());
    }

    #[test]
    fn parse_multi_token_and_single() {
        let r = parse_sqref("A1 C3:D4");
        assert_eq!(r.len(), 2);
        assert_eq!((r[0].r0, r[0].c0, r[0].r1, r[0].c1), (0, 0, 0, 0));
        assert_eq!((r[1].r0, r[1].c0, r[1].r1, r[1].c1), (2, 2, 3, 3));
    }

    #[test]
    fn parse_unbounded_axes() {
        let c = parse_sqref("A:B");
        assert!(c[0].is_col_range());
        assert_eq!((c[0].c0, c[0].c1), (0, 1));
        let r = parse_sqref("1:3");
        assert!(r[0].is_row_range());
        assert_eq!((r[0].r0, r[0].r1), (0, 2));
    }

    #[test]
    fn letters_round_trip() {
        assert_eq!(col_to_letters(0), "A");
        assert_eq!(col_to_letters(25), "Z");
        assert_eq!(col_to_letters(26), "AA");
        assert_eq!(col_to_letters(701), "ZZ");
        assert_eq!(col_to_letters(702), "AAA");
        for i in [0usize, 1, 25, 26, 27, 51, 52, 701, 702, 1000] {
            let s = col_to_letters(i);
            assert_eq!(col_to_idx(&s), i, "round trip failed for {i} ({s})");
        }
    }

    #[test]
    fn format_tokens() {
        assert_eq!(format_rect(0, 0, 9, 1), "A1:B10");
        assert_eq!(format_rect(2, 2, 2, 2), "C3");
        assert_eq!(format_col_range(0, 1), "A:B");
        assert_eq!(format_row_range(0, 2), "1:3");
    }
}
