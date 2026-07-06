pub fn calc_fv(rate: f64, nper: f64, pmt: f64, pv: f64, beginning: bool) -> f64 {
    if rate == 0.0 {
        return -(pv + pmt * nper);
    }
    let pmt_at_beginning = if beginning { 1.0 } else { 0.0 };
    let f = libm::powf(1.0 + rate, nper);
    -pv * f - pmt * (1.0 + rate * pmt_at_beginning) / rate * (f - 1.0)
}

#[cfg(test)]
mod tests {
    use super::calc_fv;

    #[test]
    fn fv_works_when_pmt_at_end_of_period() {
        let r = calc_fv(0.1, 5.0, 100.0, 1000.0, false);
        assert_eq!(r, -2221.020000000001);
    }

    #[test]
    fn fv_works_when_pmt_at_beginning() {
        assert_eq!(calc_fv(0.1, 5.0, 100.0, 1000.0, true), -2282.071000000001);
    }

    #[test]
    fn fv_works_with_zero_rate() {
        assert_eq!(calc_fv(0.0, 5.0, 100.0, 1000.0, false), -1500.0);
    }
}
