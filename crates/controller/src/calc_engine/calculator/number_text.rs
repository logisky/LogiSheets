//! Turning a number into the text a spreadsheet would show for it.

use ssf_rs::jsnum::{Precision, to_precision_with};

/// A number as text, the way Excel converts one.
///
/// **Excel carries 15 significant decimal digits, and nothing downstream ever
/// sees a 16th.** Rust's `f64::to_string` prints the shortest decimal that
/// round-trips the binary value, which needs 16 or 17 digits often enough to
/// matter: `=1/3&""` came out as `0.3333333333333333` where every other
/// spreadsheet in the world says `0.333333333333333`, and `=(0.1+0.2)&""` as
/// `0.30000000000000004` rather than `0.3`.
///
/// The rounding is the whole fix; the formatting is deliberately left alone.
/// Rounding to 15 significant digits and then printing the shortest form of
/// *that* value cannot change a case that was already right — 1e-7 stays
/// `0.0000001`, 1234.5678 stays itself — whereas swapping in a different
/// formatter would also have changed WHEN scientific notation appears, which
/// is a separate rule and not the bug being fixed.
///
/// Excel's own General renderer (`ssf_rs::general`) is the wrong tool here: it
/// is the column-width-constrained DISPLAY format and gives about 9 digits
/// (`1/3` as `0.333333333`), which is what a cell shows, not what a formula
/// gets when it concatenates.
pub fn number_to_text(v: f64) -> String {
    let rounded: f64 = to_precision_with(v, 15, Precision::Excel15)
        .parse()
        .unwrap_or(v);
    rounded.to_string()
}

#[cfg(test)]
mod tests {
    use super::number_to_text;

    #[test]
    fn caps_at_fifteen_significant_digits() {
        assert_eq!(number_to_text(1.0 / 3.0), "0.333333333333333");
        assert_eq!(number_to_text(2.0 / 3.0), "0.666666666666667");
        assert_eq!(number_to_text(0.1 + 0.2), "0.3");
        assert_eq!(number_to_text(2.0_f64.sqrt()), "1.4142135623731");
    }

    #[test]
    fn leaves_alone_what_was_already_right() {
        assert_eq!(number_to_text(1.0), "1");
        assert_eq!(number_to_text(1.5), "1.5");
        assert_eq!(number_to_text(0.25), "0.25");
        assert_eq!(number_to_text(100.0), "100");
        assert_eq!(number_to_text(1234.5678), "1234.5678");
        // Small magnitudes keep decimal notation rather than gaining an
        // exponent, which a different formatter would have changed.
        assert_eq!(number_to_text(1e-7), "0.0000001");
        assert_eq!(number_to_text(-1.0 / 3.0), "-0.333333333333333");
    }
}
