pub fn calc_fv(rate: f64, nper: f64, pmt: f64, pv: f64, begining: bool) -> f64 {
    if rate == 0. {
        return -(pv + pmt * nper);
    }
    let pmt_at_begining = if begining { 1_f64 } else { 0_f64 };
    let f = (1_f64 + rate).powf(nper);
    -pv * f - pmt * (1.0 + rate * pmt_at_begining) / rate * (f - 1.0)
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
    fn fv_works_with_pmt_only() {
        assert_eq!(calc_fv(0.1, 5.0, 100.0, 0., false), -610.5100000000006);
    }

    #[test]
    fn fv_works_with_zero_rate() {
        assert_eq!(calc_fv(0.0, 5.0, 100.0, 1000.0, false), -1500.0);
    }

    #[test]
    fn fv_dummy() {
        let rates = [0.1, 0.1, 0.1, 0.0];
        let nper = 5.0;
        let pmt = 100.0;
        let pvs = [1000.0, 1000.0, 0., 1000.0];
        let pmt_at_begining = [false, true, false, false];

        let results: Vec<f64> = rates
            .iter()
            .zip(pvs.iter())
            .zip(pmt_at_begining.iter())
            .map(|(rpv, a)| calc_fv(*rpv.0, nper, pmt, *rpv.1, *a))
            .collect();

        assert_eq!(
            results,
            [
                -2221.020000000001,
                -2282.071000000001,
                -610.5100000000006,
                -1500.0
            ]
        );
    }
}
