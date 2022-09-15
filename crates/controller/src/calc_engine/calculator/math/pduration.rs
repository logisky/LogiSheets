// pv > 0, fv > 0;
pub fn calc_pduration(rate: f64, pv: f64, fv: f64) -> f64 {
    (fv.log10() - pv.log10()) / (1. + rate).log10()
}

pub fn calc_rri(nper: f64, pv: f64, fv: f64) -> f64 {
    (fv / pv).powf(1. / nper) - 1.
}

#[cfg(test)]
mod tests {
    use super::{calc_pduration, calc_rri};

    #[test]
    fn pduration_test1() {
        let res = calc_pduration(0.025, 2000., 2200.);
        assert_eq!(res, 3.859866162622647);
    }

    #[test]
    fn pduration_test2() {
        let res = calc_pduration(0.025 / 12., 1000., 1200.);
        assert_eq!(res, 87.60547641937109);
    }

    #[test]
    fn rri_test1() {
        let res = calc_rri(96., 10000., 11000.);
        assert_eq!(res, 0.0009933073762913303);
    }
}
