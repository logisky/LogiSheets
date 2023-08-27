use logisheets_base::datetime::{
    get_date_by_serial_num_1900, get_serial_num_by_date_1900, EasyDate,
};

pub fn couppcd(settle: u32, maturity: u32, freq: u8) -> u32 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let settle_date = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let delta_month = -12 / freq as i32;

    let mut idx = 1;

    loop {
        let mut curr = maturity_date.clone();
        curr.add_delta_months(idx * delta_month);
        if curr < settle_date {
            if maturity_date.is_last_date_of_this_month() {
                curr = curr.last_day_of_this_month();
            }
            return get_serial_num_by_date_1900(curr.year, curr.month as u32, curr.day as u32)
                .unwrap();
        } else {
            idx += 1;
        }
    }
}

pub fn coupncd(settle: u32, maturity: u32, freq: u8) -> u32 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let settle_date = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let delta_month = -12 / freq as i32;

    let mut idx = 1;

    loop {
        let mut curr = maturity_date.clone();
        curr.add_delta_months(idx * delta_month);
        if curr < settle_date {
            if maturity_date.is_last_date_of_this_month() {
                curr = curr.last_day_of_this_month();
            }

            curr.add_delta_months(-delta_month);

            if curr > maturity_date {
                curr = maturity_date
            }
            return get_serial_num_by_date_1900(curr.year, curr.month as u32, curr.day as u32)
                .unwrap();
        } else {
            idx += 1;
        }
    }
}

// https://github.com/formula/formula/blob/master/src/accrint.js#L10
pub fn accrint(issue: u32, settlement: u32, rate: f64, par: f64, basis: DayCountBasis) -> f64 {
    let issue_date = EasyDate::from(issue);
    let settlement_date = EasyDate::from(settlement);
    par * rate * yearfrac(issue_date, settlement_date, basis)
}

pub fn coupnum(settle: u32, maturity: u32, freq: u8) -> u32 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let pcd = couppcd(settle, maturity, freq);
    let pc_date = get_date_by_serial_num_1900(pcd);
    let maturity_date = get_date_by_serial_num_1900(maturity);

    let mut months = (maturity_date.year - pc_date.year) * 12;
    if maturity_date.month >= pc_date.month {
        months += (maturity_date.month - pc_date.month) as u32;
    } else {
        months -= (pc_date.month - maturity_date.month) as u32;
    }
    months * freq as u32 / 12
}

// pub fn days_between_360(start: EasyDate, end: EasyDate) -> i32 {
//     let end_year = end.year as i32;
//     let start_year = start.year as i32;
//     let end_month = end.month as i32;
//     let start_month = start.month as i32;
//     let end_day = end.day as i32;
//     let start_day = start.day as i32;
//     (end_year - start_year) * 360 + (end_month - start_month) * 30 + end_day - start_day
// }

// Use this function should assert the year of date is after 1900.
// fn days_between_365(start: EasyDate, end: EasyDate) -> i32 {
//     let start_num =
//         get_serial_num_by_date_1900(start.year, start.month as u32, start.day as u32).unwrap();
//     let end_num = get_serial_num_by_date_1900(end.year, end.month as u32, end.day as u32).unwrap();
//     let days = (end_num - start_num) as i32;
//     let leap_days = (start.year..end.year).into_iter().fold(0, |prev, y| {
//         if (y % 100 == 0 && y % 4 == 0) || (y % 100 != 0 && y % 4 == 0) {
//             prev + 1
//         } else {
//             prev
//         }
//     });
//     if end.year >= start.year {
//         days - leap_days
//     } else {
//         days + leap_days
//     }
// }

// https://github.com/formula/formula/blob/master/src/yearfrac.js#L7
pub fn yearfrac(start: EasyDate, end: EasyDate, basis: DayCountBasis) -> f64 {
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

pub enum DayCountBasis {
    US30Divide360,
    ActualDivideActual,
    ActualDivide360,
    ActualDivide365,
    Euro30Divide360,
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
