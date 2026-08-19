//! Shift the relative A1 references in a formula string by a row/column delta.
//!
//! A conditional-formatting `expression` rule is authored once, anchored on the
//! top-left cell of its `sqref`, and Excel re-evaluates it for every covered
//! cell with the relative references offset accordingly — `=$B1>10` on `A1:A5`
//! tests `$B1` for the first row, `$B2` for the second, and so on.
//!
//! The shift happens once, when the rule is installed onto a cell's shadow: the
//! shifted text is then parsed like any other formula, so the resulting
//! references are engine ids and track later edits on their own. This is why a
//! textual pass is enough — it only has to produce the right *starting* text.

/// Offset every relative reference in `formula` by `(dr, dc)`. Absolute parts
/// (`$`-prefixed) are left alone, as are string literals and function names.
/// A reference pushed off the sheet (negative row/column) becomes `#REF!`,
/// matching Excel.
pub(crate) fn shift_formula(formula: &str, dr: i32, dc: i32) -> String {
    if dr == 0 && dc == 0 {
        return formula.to_string();
    }
    let bytes: Vec<char> = formula.chars().collect();
    let mut out = String::with_capacity(formula.len());
    let mut i = 0usize;
    let mut in_string = false;
    while i < bytes.len() {
        let c = bytes[i];
        if in_string {
            out.push(c);
            // `""` inside a literal is an escaped quote, not the end.
            if c == '"' {
                if bytes.get(i + 1) == Some(&'"') {
                    out.push('"');
                    i += 2;
                    continue;
                }
                in_string = false;
            }
            i += 1;
            continue;
        }
        if c == '"' {
            in_string = true;
            out.push(c);
            i += 1;
            continue;
        }
        match scan_ref(&bytes, i) {
            Some((end, r)) => {
                out.push_str(&shift_one(&r, dr, dc));
                i = end;
            }
            None => {
                out.push(c);
                i += 1;
            }
        }
    }
    out
}

/// One scanned A1 reference: which parts were absolute, and their indices.
struct ParsedRef {
    col_abs: bool,
    row_abs: bool,
    col: usize,
    row: usize,
}

/// Try to read an A1 reference starting at `i`. Returns the index just past it.
///
/// Rejects anything that isn't a standalone reference: a token preceded by an
/// identifier character (so `LOG10` is not read as `LOG` + `10`, and the `A1` in
/// `FOOA1` is left alone), or followed by one (`A1B`), or followed by `(`
/// (a function call — `SUM(`).
fn scan_ref(s: &[char], i: usize) -> Option<(usize, ParsedRef)> {
    // A reference may not start in the middle of an identifier. `!` is allowed
    // before it so `Sheet1!A1` shifts its cell part.
    if i > 0 {
        let p = s[i - 1];
        if p.is_alphanumeric() || p == '_' || p == '.' || p == '$' {
            return None;
        }
    }
    let mut j = i;
    let col_abs = s.get(j) == Some(&'$');
    if col_abs {
        j += 1;
    }
    let letter_start = j;
    while j < s.len() && s[j].is_ascii_alphabetic() {
        j += 1;
    }
    let letters: String = s[letter_start..j].iter().collect();
    // Excel columns are at most 3 letters (XFD); more means it's a name.
    if letters.is_empty() || letters.len() > 3 {
        return None;
    }
    let row_abs = s.get(j) == Some(&'$');
    if row_abs {
        j += 1;
    }
    let digit_start = j;
    while j < s.len() && s[j].is_ascii_digit() {
        j += 1;
    }
    if digit_start == j {
        return None;
    }
    let digits: String = s[digit_start..j].iter().collect();
    // Not a reference if an identifier or a call continues right after.
    if let Some(&n) = s.get(j) {
        if n.is_alphanumeric() || n == '_' || n == '(' {
            return None;
        }
    }
    let row: usize = digits.parse().ok()?;
    if row == 0 {
        return None;
    }
    Some((
        j,
        ParsedRef {
            col_abs,
            row_abs,
            col: crate::sqref::col_to_idx(&letters.to_ascii_uppercase()),
            row: row - 1,
        },
    ))
}

fn shift_one(r: &ParsedRef, dr: i32, dc: i32) -> String {
    let row = if r.row_abs {
        Some(r.row)
    } else {
        offset(r.row, dr)
    };
    let col = if r.col_abs {
        Some(r.col)
    } else {
        offset(r.col, dc)
    };
    match (row, col) {
        (Some(row), Some(col)) => format!(
            "{}{}{}{}",
            if r.col_abs { "$" } else { "" },
            crate::sqref::col_to_letters(col),
            if r.row_abs { "$" } else { "" },
            row + 1
        ),
        // Shifted off the sheet — Excel writes #REF! here.
        _ => "#REF!".to_string(),
    }
}

fn offset(v: usize, d: i32) -> Option<usize> {
    let n = v as i64 + d as i64;
    if n < 0 { None } else { Some(n as usize) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shifts_relative_keeps_absolute() {
        assert_eq!(shift_formula("$B1>10", 2, 0), "$B3>10");
        // Relative column moves with dc, absolute row ignores dr.
        assert_eq!(shift_formula("B$1>10", 2, 1), "C$1>10");
        assert_eq!(shift_formula("$B$1>10", 2, 3), "$B$1>10");
        assert_eq!(shift_formula("B1>10", 2, 3), "E3>10");
    }

    #[test]
    fn zero_delta_is_identity() {
        assert_eq!(shift_formula("A1+$B$2", 0, 0), "A1+$B$2");
    }

    #[test]
    fn leaves_string_literals_alone() {
        assert_eq!(
            shift_formula("IF(A1=\"B1\",\"C2\",A1)", 1, 0),
            "IF(A2=\"B1\",\"C2\",A2)"
        );
        // An escaped quote must not end the literal early.
        assert_eq!(
            shift_formula("A1&\"say \"\"B1\"\" ok\"", 1, 0),
            "A2&\"say \"\"B1\"\" ok\""
        );
    }

    #[test]
    fn leaves_function_names_and_identifiers_alone() {
        assert_eq!(shift_formula("LOG10(A1)", 1, 0), "LOG10(A2)");
        assert_eq!(shift_formula("SUM(A1:A5)", 1, 0), "SUM(A2:A6)");
        assert_eq!(shift_formula("MYNAME1+A1", 1, 0), "MYNAME1+A2");
    }

    #[test]
    fn keeps_sheet_qualifier() {
        assert_eq!(shift_formula("Sheet1!A1>0", 1, 0), "Sheet1!A2>0");
    }

    #[test]
    fn off_sheet_becomes_ref_error() {
        assert_eq!(shift_formula("B2>0", -5, 0), "#REF!>0");
        assert_eq!(shift_formula("B2>0", 0, -5), "#REF!>0");
    }

    #[test]
    fn multi_letter_columns() {
        assert_eq!(shift_formula("AA1>0", 1, 1), "AB2>0");
        assert_eq!(shift_formula("ZZ1>0", 0, 1), "AAA1>0");
    }
}
