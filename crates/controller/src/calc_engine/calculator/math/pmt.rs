pub fn calc_pmt(rate: f64, nper: usize, pv: f64, fv: f64, beginning: bool) -> f64 {
    if nper == 0 {
        return 0.0;
    }

    if rate == 0.0 {
        return -(fv + pv) / (nper as f64);
    }

    let pvif = (1.0 + rate).powf(nper as f64);
    let pmt = (rate / (pvif - 1.0)) * -(pv * pvif + fv);

    if !beginning {
        return pmt;
    }
    pmt / (1.0 + rate)
}

pub fn calc_ipmt(rate: f64, per: usize, nper: usize, pv: f64, fv: f64, beginning: bool) -> f64 {
    let pmt = calc_pmt(rate, nper, pv, fv, beginning);
    let ipmt = -((1. + rate).powi(per as i32 - 1) * (pv * rate + pmt) - pmt);
    ipmt
}

pub fn calc_ppmt(rate: f64, per: usize, nper: usize, pv: f64, fv: f64, beginning: bool) -> f64 {
    let ppmt =
        calc_pmt(rate, nper, pv, fv, beginning) - calc_ipmt(rate, per, nper, pv, fv, beginning);
    ppmt
}

#[cfg(test)]
mod tests {

    use super::calc_pmt;
    #[test]
    fn pmt_test1() {
        let r = calc_pmt(0.005, 240, -100000., 0., false);
        assert!((r - 716.431).abs() < 1e-3);
        let r = calc_pmt(0.005, 240, -100000., 0., true);
        assert!((r - 712.867).abs() < 1e-3);
    }
}
