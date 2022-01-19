pub fn calc_pv(rate: f64, nper: f64, pmt: f64, fv: f64, begining: bool) -> f64 {
    if rate == 0.0 {
        return -(fv + pmt * nper);
    }
    let pmt_at_begining = if begining { 1. } else { 0. };
    let temp = (1. + rate).powf(nper);
    let factor = (1. + rate * pmt_at_begining) * (temp - 1.) / rate;
    -(fv + pmt * factor) / temp
}

#[cfg(test)]
mod tests {
    use super::calc_pv;
    #[test]
    fn pv_works_when_pmt_at_end_of_period() {
        assert_eq!(calc_pv(0.1, 5.0, 100.0, 1000.0, false), -1000.0000000000001);
    }

    #[test]
    fn pv_works_when_pmt_at_beginning() {
        assert_eq!(calc_pv(0.1, 5.0, 100.0, 1000.0, true), -1037.90786769408449);
    }

    #[test]
    fn pv_works_with_pmt_only() {
        assert_eq!(calc_pv(0.1, 5.0, 100.0, 0., false), -379.07867694084507);
    }

    #[test]
    fn pv_works_with_zero_rate() {
        assert_eq!(calc_pv(0.0, 5.0, 100.0, 1000.0, false), -1500.0);
    }
}
