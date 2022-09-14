pub fn calc_effect(rate: f64, nper: i32) -> f64 {
    let n = nper as f64;
    (1. + rate / n).powi(nper) - 1.
}

pub fn calc_nominal(rate: f64, nper: u32) -> f64 {
    let nper = nper as f64;
    ((rate + 1.).powf(1. / nper) - 1.) * nper
}

#[cfg(test)]
mod tests {
    use super::{calc_effect, calc_nominal};

    #[test]
    fn effect_test() {
        let res = calc_effect(2., 2);
        assert!((res - 3.).abs() < 1e-4)
    }

    #[test]
    fn nominal_test() {
        let res = calc_nominal(0.053543, 4);
        assert!(res - 0.05250032 < 1e-7)
    }
}
