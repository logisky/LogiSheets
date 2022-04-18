use super::newton_iter::newton;
use super::npv::calc_npv;

pub fn calc_irr(values: &[f64], guess: Option<f64>) -> Option<f64> {
    validate_cashflow(values)?;
    let f_npv = |x: f64| calc_npv(x, values);
    newton(guess.unwrap_or(0.), f_npv)
}

fn validate_cashflow(values: &[f64]) -> Option<()> {
    if values.len() < 2 {
        return None;
    }
    let mut positve = 0_u32;
    let mut negative = 0_u32;
    values.iter().for_each(|v| {
        if *v > 0_f64 {
            positve += 1;
        } else if *v < 0_f64 {
            negative += 1;
        }
    });
    // cashflow must contain more than one value, and include positive and
    // negative values
    if positve > 0 && negative > 0 {
        Some(())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::calc_irr;

    #[test]
    fn irr_test1() {
        let cf = [-500., 100., 100., 100., 100.];
        let guess = Some(-0.);
        let r = calc_irr(&cf, guess).unwrap();
        assert!((r - -0.08364542).abs() < 1e-7)
    }
}
