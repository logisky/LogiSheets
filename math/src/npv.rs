pub fn calc_npv(rate: f64, values: &[f64]) -> f64 {
    if rate == 0.0 {
        return values.iter().sum();
    }
    let result = values.iter().enumerate().fold(0_f64, |prev, (idx, value)| {
        let r = (1. + rate).powi(1 + idx as i32);
        value / r + prev
    });
    result
}

#[cfg(test)]
mod tests {
    use super::calc_npv;

    #[test]
    fn npv_test() {
        let cf = [-1000., 500., 500., 500.];
        let rate = 0.1;
        assert_eq!(calc_npv(rate, &cf), 221.29635953828273)
    }

    #[test]
    fn npv_test2() {
        let cf = [-1000., 500., 500., 500.];
        let rate = 0_f64;
        assert_eq!(calc_npv(rate, &cf), 500.)
    }
}
