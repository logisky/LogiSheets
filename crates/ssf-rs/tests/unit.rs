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

/// Excel's precision, not JavaScript's. These are the values where the two
/// rules disagree, and a spreadsheet has to answer the way the spreadsheet
/// does — see `NOTICE`. Expectations captured from Excel, NOT from `ssf`.
#[test]
fn numbers_round_at_excel_precision() {
    let cases: &[(&str, f64, &str)] = &[
        // As doubles these all sit a hair BELOW the halfway point, so
        // JavaScript rounds them down. Their 15-significant-digit form is the
        // tie, which Excel resolves away from zero.
        ("0.00", 1.005, "1.01"),
        ("0.00", 4.935, "4.94"),
        ("0.00", 0.015, "0.02"),
        ("0.00", 0.045, "0.05"),
        ("0.0", 0.15, "0.2"),
        ("#,##0.00", 1234.565, "1,234.57"),
        // Already above the tie: unchanged, and a check that the collapse to
        // 15 digits does not disturb the ordinary cases.
        ("0.00", 2.675, "2.68"),
        ("0.00", 0.135, "0.14"),
        ("0.000", 1.0005, "1.001"),
        // Negative ties go away from zero too, as Excel does.
        ("0.00", -1.005, "-1.01"),
        ("0.00", -4.935, "-4.94"),
        // Scaling by a power of ten used to cost an exact value a place:
        // `2.1 * 100` is 209.99999999999997.
        ("0.00", 2.1, "2.10"),
        ("0.0", 8.7, "8.7"),
        // A carry out of the fraction has to reach the integer part.
        ("0.00", 9.999, "10.00"),
        ("0.00", 0.995, "1.00"),
    ];
    for (fmt, v, want) in cases {
        assert_eq!(
            format_str(fmt, *v).unwrap(),
            *want,
            "format {fmt:?} of {v:?}"
        );
    }
}

/// The comma formats reach the number through a different helper than the bare
/// `0.00` ones do. They used to round differently as a result — `#,##0.00` said
/// "1.00" and "2.67" where `0.00` said "1.01" and "2.68" — so the point here is
/// that the families agree, not just that each is right on its own.
#[test]
fn every_fixed_decimal_format_rounds_alike() {
    let vals: &[(f64, &str)] = &[
        (1.005, "1.01"),
        (4.935, "4.94"),
        (2.675, "2.68"),
        (0.015, "0.02"),
        (2.1, "2.10"),
        (9.999, "10.00"),
        (0.995, "1.00"),
    ];
    for (v, want) in vals {
        assert_eq!(format_str("0.00", *v).unwrap(), *want, "0.00 of {v:?}");
        assert_eq!(
            format_str("#,##0.00", *v).unwrap(),
            *want,
            "#,##0.00 of {v:?}"
        );
        assert_eq!(
            format_str("$#,##0.00", *v).unwrap(),
            format!("${want}"),
            "$#,##0.00 of {v:?}"
        );
    }
}

/// Above 1e15 the rule is deliberately not applied, so every numeric format
/// keeps rendering the same digits it always did. Left unguarded, only the
/// formats routing through the changed helpers would have shortened, and they
/// would no longer have matched the others.
#[test]
fn large_values_render_the_same_across_formats() {
    let big = 26925224612816314368.0;
    assert_eq!(format_str("0", big).unwrap(), "26925224612816314000");
    assert_eq!(format_str("0.00", big).unwrap(), "26925224612816314000.00");
    assert_eq!(
        format_str("#,##0", big).unwrap(),
        "26,925,224,612,816,314,000"
    );
    assert_eq!(
        format_str("#,##0.00", big).unwrap(),
        "26,925,224,612,816,314,000.00"
    );
}
