use logisheets_base::datetime::{get_date_by_serial_num_1900, EasyDate};

use crate::calc_engine::calculator::math::day_count::{
    find_next_coupon_date, find_previous_coupon_date, get_coupon_num, get_price_yield_factors,
    PriceYieldFactors,
};

pub use super::day_count::DayCountBasis;
use super::day_count::{
    get_common_factors, get_mat_factors, CommonFactors, DayCountTools, MatFactors,
};

pub fn couppcd(settle: u32, maturity: u32, freq: u8) -> u32 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let settle_date = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let result = find_previous_coupon_date(settle_date, maturity_date, freq);
    result.into()
}

pub fn coupncd(settle: u32, maturity: u32, freq: u8) -> u32 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let settle_date = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let result = find_next_coupon_date(settle_date, maturity_date, freq);
    result.into()
}

pub fn price<T: DayCountTools>(
    settle: u32,
    maturity: u32,
    rate: f64,
    yld: f64,
    redemption: f64,
    freq: u8,
) -> f64 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let settlement = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);
    let PriceYieldFactors {
        n,
        pcd: _,
        a,
        e,
        dsc,
    } = get_price_yield_factors::<T>(settlement, maturity_date, freq);

    let coupon = 100. * rate / freq as f64;
    let accrint = 100. * rate * a as f64 / e as f64 / freq as f64;

    if n == 1 {
        (redemption + coupon) / (1. + dsc as f64 / e as f64 * yld / freq as f64) - accrint
    } else {
        let pv_factor = |k: usize| {
            let base = 1. + yld / freq as f64;
            let exp = k as f64 - 1. + dsc as f64 / e as f64;
            base.powf(exp)
        };
        let mut pv_of_coupons = 0.;

        for k in 1..=n as usize {
            pv_of_coupons += coupon / pv_factor(k);
        }
        let pv_of_redemption = redemption / pv_factor(n as usize);
        pv_of_redemption + pv_of_coupons - accrint
    }
}

pub fn pricemat<T: DayCountTools>(
    settle: u32,
    maturity: u32,
    issue: u32,
    rate: f64,
    yld: f64,
) -> f64 {
    let settlement = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);
    let issue_date = EasyDate::from(issue);
    let MatFactors { b, dim, a, dsm } = get_mat_factors::<T>(settlement, maturity_date, issue_date);

    let num1 = 100. + (dim as f64 / b as f64 * rate * 100.);
    let den1 = 1. + (dsm as f64 / b as f64 * yld);
    let fact2 = a as f64 / b as f64 * rate * 100.;

    num1 / den1 - fact2
}

pub fn yieldmat<T: DayCountTools>(
    settle: u32,
    maturity: u32,
    issue: u32,
    rate: f64,
    pr: f64,
) -> f64 {
    let settlement = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);
    let issue_date = EasyDate::from(issue);
    let MatFactors { b, dim, a, dsm } = get_mat_factors::<T>(settlement, maturity_date, issue_date);

    let term1 = dim as f64 / b * rate + 1. - pr / 100. - a as f64 / b * rate;
    let term2 = pr / 100. + a as f64 / b * rate;
    let term3 = b / dsm as f64;

    term1 / term2 * term3
}

pub fn intrate<T: DayCountTools>(
    settle: u32,
    maturity: u32,
    investment: f64,
    redemption: f64,
) -> f64 {
    let settlement = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let CommonFactors { dim, b } = get_common_factors::<T>(settlement, maturity_date);

    (redemption - investment) / investment * b / dim as f64
}

pub fn received<T: DayCountTools>(
    settle: u32,
    maturity: u32,
    investment: f64,
    discount: f64,
) -> f64 {
    let settlement = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let CommonFactors { dim, b } = get_common_factors::<T>(settlement, maturity_date);

    investment / (1. - discount * dim as f64 / b)
}

pub fn disc<T: DayCountTools>(settle: u32, maturity: u32, pr: f64, redemption: f64) -> f64 {
    let settlement = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let CommonFactors { dim, b } = get_common_factors::<T>(settlement, maturity_date);

    (-pr / redemption + 1.) * b / dim as f64
}

pub fn pricedisc<T: DayCountTools>(
    settle: u32,
    maturity: u32,
    discount: f64,
    redemption: f64,
) -> f64 {
    let settlement = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let CommonFactors { dim, b } = get_common_factors::<T>(settlement, maturity_date);
    redemption - discount * redemption * dim as f64 / b
}

pub fn yielddisc<T: DayCountTools>(settle: u32, maturity: u32, pr: f64, redemption: f64) -> f64 {
    let settlement = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let CommonFactors { dim, b } = get_common_factors::<T>(settlement, maturity_date);
    (redemption - pr) / pr * b / dim as f64
}

// https://github.com/formula/formula/blob/master/src/accrint.js#L10
pub fn accrint(issue: u32, settlement: u32, rate: f64, par: f64, basis: DayCountBasis) -> f64 {
    let issue_date = EasyDate::from(issue);
    let settlement_date = EasyDate::from(settlement);
    par * rate * yearfrac(issue_date, settlement_date, basis)
}

pub fn coupnum(settle: u32, maturity: u32, freq: u8) -> u32 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let settle_date = get_date_by_serial_num_1900(settle);
    let maturity_date = get_date_by_serial_num_1900(maturity);
    get_coupon_num(settle_date, maturity_date, freq)
}

// https://github.com/formula/formula/blob/master/src/yearfrac.js#L7
fn yearfrac(start: EasyDate, end: EasyDate, basis: DayCountBasis) -> f64 {
    let mut sd = start.day as i32;
    let sm = start.month as i32;
    let sy = start.year as i32;
    let mut ed = end.day as i32;
    let em = end.month as i32;
    let ey = end.year as i32;
    match basis {
        DayCountBasis::US30Divide360 => {
            if sd == 31 && ed == 31 {
                sd = 30;
                ed = 30;
            } else if sd == 31 {
                sd = 30
            } else if sd == 30 && ed == 31 {
                ed = 30
            }
            let days = (ed + em * 30 + ey * 360 - (sd + sm * 30 + sy * 360)) as f64;
            days / 360.
        }
        DayCountBasis::ActualDivideActual => {
            let s_days: u32 = start.into();
            let e_days: u32 = end.into();
            let actual_days = (e_days - s_days) as f64;
            let sy_first_day: u32 = EasyDate {
                year: sy as u32,
                month: 1,
                day: 1,
            }
            .into();
            let ey_first_day: u32 = EasyDate {
                year: (ey + 1) as u32,
                month: 1,
                day: 1,
            }
            .into();
            let average = ((ey_first_day - sy_first_day) as f64) / ((ey - sy + 1) as f64);
            actual_days / average
        }
        DayCountBasis::ActualDivide360 => {
            let s_days: u32 = start.into();
            let e_days: u32 = end.into();
            ((e_days - s_days) as f64) / 360.
        }
        DayCountBasis::ActualDivide365 => {
            let s_days: u32 = start.into();
            let e_days: u32 = end.into();
            ((e_days - s_days) as f64) / 365.
        }
        DayCountBasis::Euro30Divide360 => {
            ((ed + em * 30 + ey * 360 - (sd + sm * 30 + sy * 360)) as f64) / 360.
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{coupncd, coupnum, couppcd};
    use logisheets_base::datetime::get_serial_num_by_date_1900;

    #[test]
    fn test_couppcd() {
        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 4;
        let res = couppcd(settle, maturity, freq);
        assert_eq!(res, get_serial_num_by_date_1900(2018, 11, 30).unwrap());

        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 1;
        let res = couppcd(settle, maturity, freq);
        assert_eq!(res, get_serial_num_by_date_1900(2018, 2, 28).unwrap());
    }

    #[test]
    fn test_coupncd() {
        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 4;
        let res = coupncd(settle, maturity, freq);
        assert_eq!(res, get_serial_num_by_date_1900(2019, 2, 28).unwrap());

        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 1;
        let res = coupncd(settle, maturity, freq);
        assert_eq!(res, get_serial_num_by_date_1900(2019, 2, 28).unwrap());
    }

    #[test]
    fn test_coupnum() {
        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 4;
        let res = coupnum(settle, maturity, freq);
        assert_eq!(res, 9);

        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 2;
        let res = coupnum(settle, maturity, freq);
        assert_eq!(res, 5);
    }

    // #[test]
    // fn test_days360() {
    //     let start = EasyDate {
    //         year: 2018,
    //         month: 12,
    //         day: 31,
    //     };
    //     let end = EasyDate {
    //         year: 2021,
    //         month: 2,
    //         day: 28,
    //     };
    //     let res = days_between_360(start, end);
    //     assert_eq!(res, 778);
    // }
}
