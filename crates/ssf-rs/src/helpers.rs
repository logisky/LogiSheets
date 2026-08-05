//! Small string/number helpers ported directly from `ssf`.

use crate::jsnum;

/// `ssf.fill(c, l)`: the char `c` repeated to length `l`.
pub fn fill(c: char, l: usize) -> String {
    c.to_string().repeat(l)
}

/// `ssf.pad0(v, d)`: left-pad with '0' to width `d`.
pub fn pad0(s: &str, d: usize) -> String {
    if s.len() >= d {
        s.to_string()
    } else {
        format!("{}{}", "0".repeat(d - s.len()), s)
    }
}

/// `ssf.pad_(v, d)`: left-pad with ' ' to width `d`.
pub fn pad_(s: &str, d: usize) -> String {
    if s.len() >= d {
        s.to_string()
    } else {
        format!("{}{}", " ".repeat(d - s.len()), s)
    }
}

/// `ssf.rpad_(v, d)`: right-pad with ' ' to width `d`.
pub fn rpad_(s: &str, d: usize) -> String {
    if s.len() >= d {
        s.to_string()
    } else {
        format!("{}{}", s, " ".repeat(d - s.len()))
    }
}

/// `ssf.pad0` for an integer value.
pub fn pad0_i(v: i64, d: usize) -> String {
    pad0(&v.to_string(), d)
}

/// `ssf.pad0r(v, d)`: round `v` to an integer and left-pad with '0'.
///
/// In upstream this branches on `|v| > 2^32` but both branches reduce to
/// `pad0(String(Math.round(v)), d)`, so we implement that directly.
pub fn pad0r(v: f64, d: usize) -> String {
    pad0(&jsnum::to_string_js(jsnum::round(v)), d)
}

/// `ssf._strrev`.
pub fn strrev(s: &str) -> String {
    s.chars().rev().collect()
}

/// `ssf.hashq`: render a `#`/`?`/`0` digit-placeholder run as literal text
/// (`#` -> "", `?` -> " ", `0` -> "0", everything else passes through).
pub fn hashq(s: &str) -> String {
    let mut o = String::new();
    for ch in s.chars() {
        match ch {
            '#' => {}
            '?' => o.push(' '),
            '0' => o.push('0'),
            other => o.push(other),
        }
    }
    o
}

/// `ssf.commaify`: insert thousands separators into a run of digits.
pub fn commaify(s: &str) -> String {
    let w = 3;
    if s.len() <= w {
        return s.to_string();
    }
    let mut j = s.len() % w;
    let mut o = s[..j].to_string();
    while j != s.len() {
        if !o.is_empty() {
            o.push(',');
        }
        o.push_str(&s[j..j + w]);
        j += w;
    }
    o
}

/// `ssf.isgeneral(s, i)`: does `s` contain "general" (case-insensitive) starting
/// at byte index `i`?
pub fn isgeneral(s: &str, i: usize) -> bool {
    let b = s.as_bytes();
    b.len() >= 7 + i
        && (b[i] | 32) == b'g'
        && (b[i + 1] | 32) == b'e'
        && (b[i + 2] | 32) == b'n'
        && (b[i + 3] | 32) == b'e'
        && (b[i + 4] | 32) == b'r'
        && (b[i + 5] | 32) == b'a'
        && (b[i + 6] | 32) == b'l'
}
