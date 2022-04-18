pub fn calc_effect(rate: f64, nper: i32) -> f64 {
    let n = nper as f64;
    (1. + rate / n).powi(nper) - 1.
}

#[cfg(test)]
mod tests {
    use super::calc_effect;
    #[test]
    fn effect_test() {
        let res = calc_effect(2., 2);
        assert!((res - 3.).abs() < 1e-4)
    }
}
