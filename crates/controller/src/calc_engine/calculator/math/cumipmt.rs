use super::{fv::calc_fv, pmt::calc_pmt};

// from [xlsxfin](https://github.com/abetomo/xlsxfin.rs)
pub fn calc_cumipmt(
    rate: f64,
    nper: usize,
    pv: f64,
    start: i64,
    end: i64,
    payment_flag: bool,
) -> Option<f64> {
    if rate <= 0. || nper <= 0 || pv <= 0. {
        return None;
    }
    if start < 1 || end < 1 || start > end {
        return None;
    }
    let pmt = calc_pmt(rate, nper, pv, 0., payment_flag);
    let mut interest = 0.;
    let mut s = start;
    if start == 1 {
        if !payment_flag {
            s += 1;
            interest = -pv;
        }
    }

    for i in s..end + 1 {
        interest += if payment_flag {
            calc_fv(rate, (i - 2) as f64, pmt, pv, true) - pmt
        } else {
            calc_fv(rate, (i - 1) as f64, pmt, pv, false)
        };
    }
    Some(interest * rate)
}

#[cfg(test)]
mod tests {
    use super::calc_cumipmt;

    #[test]
    fn test1() {
        let actual = calc_cumipmt(0.1, 36, 800_000.0, 6, 12, true).unwrap();
        assert!(actual - -488_961.5711288557 < 10e-7);
        let actual = calc_cumipmt(0.1, 36, 800_000.0, 6, 12, false).unwrap();
        assert!(actual - -537_857.7282417413 < 10e-7);
    }
}
