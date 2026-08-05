//! Node-free unit tests with expectations captured from the reference `ssf`.
//! These run under a plain `cargo test -p ssf-rs` (no `--ignored`, no `node`).

use ssf_rs::{format_str, format_text};

#[test]
fn common_formats() {
    let cases: &[(&str, f64, &str)] = &[
        ("0.00%", 0.1234, "12.34%"),
        ("#,##0.00", 1234.5, "1,234.50"),
        ("#,##0", -1234567.0, "-1,234,567"),
        ("0", 42.7, "43"),
        ("0.00E+00", 12345.678, "1.23E+04"),
        ("# ??/??", 1.625, "1  5/8 "),
        ("$#,##0.00", 1234.5, "$1,234.50"),
        ("yyyy-mm-dd", 45000.0, "2023-03-15"),
        ("d-mmm-yy", 45000.0, "15-Mar-23"),
        ("mmm-yy", 45000.0, "Mar-23"),
        ("h:mm:ss", 0.5, "12:00:00"),
        ("h:mm AM/PM", 0.75, "6:00 PM"),
        ("[h]:mm:ss", 1.5, "36:00:00"),
        ("m/d/yy", 1.0, "1/1/00"),
        ("General", 3.14159, "3.14159"),
        ("General", 1000000000.0, "1000000000"),
        ("0.00;-0.00;\"zero\"", 0.0, "zero"),
        ("000-00-0000", 123456789.0, "123-45-6789"),
        ("(###) ###-####", 8005551234.0, "(800) 555-1234"),
        ("0%", 0.5, "50%"),
        ("#,##0.0,", 1234567.0, "1,234.6"),
        ("mm:ss.0", 0.5001, "00:08.6"),
        ("General", 0.1, "0.1"),
    ];
    for (fmt, val, want) in cases {
        assert_eq!(
            format_str(fmt, *val).unwrap(),
            *want,
            "format_str({fmt:?}, {val})"
        );
    }
}

#[test]
fn text_placeholder() {
    assert_eq!(format_text("@", "hello").unwrap(), "hello");
    assert_eq!(format_str("@", 3.14159).unwrap(), "3.14159");
}

#[test]
fn readme_examples() {
    assert_eq!(format_str("0.00%", 0.1234).unwrap(), "12.34%");
    assert_eq!(format_str("#,##0.00", 1234.5).unwrap(), "1,234.50");
    assert_eq!(format_str("yyyy-mm-dd", 45000.0).unwrap(), "2023-03-15");
}
