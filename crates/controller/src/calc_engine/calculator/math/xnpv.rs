//! XNPV — net present value for a schedule of cash flows on specific dates
//! (not necessarily periodic).

/// `values[i]` occurs on `dates[i]`. `dates[0]` is the start of the schedule;
/// each flow is discounted by `(1 + rate)^((date_i - date_0) / 365)`. Dates are
/// truncated to whole days (Excel does the same). Returns `None` (→ `#NUM!`) if
/// the series are empty / mismatched, `rate <= -1`, or any date precedes the
/// first.
pub fn calc_xnpv(rate: f64, values: &[f64], dates: &[f64]) -> Option<f64> {
    if values.is_empty() || values.len() != dates.len() {
        return None;
    }
    // (1 + rate) must stay positive for the fractional-power discount factor.
    if rate <= -1.0 {
        return None;
    }
    let d0 = dates[0].trunc();
    if dates.iter().any(|d| d.trunc() < d0) {
        return None;
    }
    Some(xnpv_raw(rate, values, dates, d0))
}

/// The bare discounted sum — also the objective XIRR drives to zero. Assumes
/// the inputs were already validated (equal length, every date ≥ `d0`).
pub(crate) fn xnpv_raw(rate: f64, values: &[f64], dates: &[f64], d0: f64) -> f64 {
    values
        .iter()
        .zip(dates.iter())
        .map(|(p, d)| {
            let exp = (d.trunc() - d0) / 365.0;
            p / (1.0 + rate).powf(exp)
        })
        .sum()
}

#[cfg(test)]
mod tests {
    use super::calc_xnpv;

    #[test]
    fn xnpv_matches_excel_example() {
        // Microsoft's XNPV example: rate 9% over 2008-01-01 … 2009-04-01.
        let values = [-10000., 2750., 4250., 3250., 2750.];
        let dates = [39448., 39508., 39751., 39859., 39904.];
        let r = calc_xnpv(0.09, &values, &dates).unwrap();
        assert!((r - 2086.6476).abs() < 1e-3, "got {}", r);
    }

    #[test]
    fn xnpv_rejects_bad_input() {
        assert!(calc_xnpv(0.1, &[1., 2.], &[100.]).is_none()); // length mismatch
        assert!(calc_xnpv(-1.5, &[1., 2.], &[100., 200.]).is_none()); // rate <= -1
        assert!(calc_xnpv(0.1, &[1., 2.], &[200., 100.]).is_none()); // date before first
    }
}
