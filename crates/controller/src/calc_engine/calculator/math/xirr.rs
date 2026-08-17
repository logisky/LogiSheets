//! XIRR — internal rate of return for a schedule of cash flows on specific
//! dates: the rate at which XNPV is zero.

use super::newton_iter::newton;
use super::xnpv::xnpv_raw;

/// Solve `XNPV(rate) = 0` by Newton iteration from `guess` (default 0.1, as
/// Excel). Returns `None` (→ `#NUM!`) if the series are mismatched, the flows
/// don't include both a positive and a negative value, a date precedes the
/// first, or the iteration fails to converge.
pub fn calc_xirr(values: &[f64], dates: &[f64], guess: Option<f64>) -> Option<f64> {
    if values.len() != dates.len() {
        return None;
    }
    validate_cashflow(values)?;
    let d0 = dates[0].trunc();
    if dates.iter().any(|d| d.trunc() < d0) {
        return None;
    }
    let f = |rate: f64| xnpv_raw(rate, values, dates, d0);
    let r = newton(guess.unwrap_or(0.1), f)?;
    if r.is_finite() { Some(r) } else { None }
}

/// A return can only be computed when the flows include at least one inflow and
/// one outflow (mirrors IRR).
fn validate_cashflow(values: &[f64]) -> Option<()> {
    if values.len() < 2 {
        return None;
    }
    let has_pos = values.iter().any(|v| *v > 0.0);
    let has_neg = values.iter().any(|v| *v < 0.0);
    if has_pos && has_neg { Some(()) } else { None }
}

#[cfg(test)]
mod tests {
    use super::calc_xirr;

    #[test]
    fn xirr_matches_excel_example() {
        // Same schedule as the XNPV example → ≈ 37.34%.
        let values = [-10000., 2750., 4250., 3250., 2750.];
        let dates = [39448., 39508., 39751., 39859., 39904.];
        let r = calc_xirr(&values, &dates, None).unwrap();
        assert!((r - 0.373362535).abs() < 1e-5, "got {}", r);
    }

    #[test]
    fn xirr_rejects_single_sign() {
        // All positive → no return.
        assert!(calc_xirr(&[1., 2., 3.], &[1., 2., 3.], None).is_none());
    }
}
