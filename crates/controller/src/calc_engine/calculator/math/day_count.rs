#![allow(dead_code)]
use logisheets_base::datetime::{get_serial_num_by_date_1900, EasyDate};

pub trait DayCountTools {
    fn coup_days(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32;
    fn coup_days_bs(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32;
    fn coup_days_nc(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32;
    fn days_between(issue: EasyDate, settlement: EasyDate, position: NumDenumPosition) -> i32;
    fn days_in_year(issue: EasyDate, settlement: EasyDate) -> f64;
}

pub struct UsPsa30_360();
pub struct Europe30_360();
pub struct Actual360();
pub struct Actual365();
pub struct ActualActual();

impl DayCountTools for UsPsa30_360 {
    fn coup_days(_: EasyDate, _: EasyDate, freq: u8) -> u32 {
        360 / freq as u32
    }

    fn coup_days_bs(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let pcd = find_previous_coupon_date(settlement, maturity, freq);
        days_diff_360_us(pcd, settlement, Method360Us::ModifyStartDate) as u32
    }

    fn coup_days_nc(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let pcd = find_previous_coupon_date(settlement, maturity, freq);
        let ncd = find_next_coupon_date(settlement, maturity, freq);
        let tot_days_in_coup = days_diff_360_us(pcd, ncd, Method360Us::ModifyBothDates);
        let days_to_settl = days_diff_360_us(pcd, settlement, Method360Us::ModifyStartDate);

        (tot_days_in_coup - days_to_settl) as u32
    }

    fn days_between(issue: EasyDate, settlement: EasyDate, _: NumDenumPosition) -> i32 {
        days_diff_360_us(issue, settlement, Method360Us::ModifyStartDate)
    }

    fn days_in_year(_issue: EasyDate, _settlement: EasyDate) -> f64 {
        360.
    }
}

impl DayCountTools for Europe30_360 {
    fn coup_days(_: EasyDate, _: EasyDate, freq: u8) -> u32 {
        360 / freq as u32
    }

    fn coup_days_bs(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let pcd = find_previous_coupon_date(settlement, maturity, freq);
        days_diff_360_eu(pcd, settlement) as u32
    }

    fn coup_days_nc(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let ncd = find_next_coupon_date(settlement, maturity, freq);
        days_diff_360_eu(settlement, ncd) as u32
    }

    fn days_between(issue: EasyDate, settlement: EasyDate, _: NumDenumPosition) -> i32 {
        days_diff_360_eu(issue, settlement)
    }

    fn days_in_year(_: EasyDate, _: EasyDate) -> f64 {
        360.
    }
}

impl DayCountTools for Actual360 {
    fn coup_days(_: EasyDate, _: EasyDate, freq: u8) -> u32 {
        360 / freq as u32
    }

    fn coup_days_bs(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let pcd = find_previous_coupon_date(settlement, maturity, freq);
        u32::from(settlement) - u32::from(pcd)
    }

    fn coup_days_nc(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let ncd = find_next_coupon_date(settlement, maturity, freq);
        u32::from(ncd) - u32::from(settlement)
    }

    fn days_between(issue: EasyDate, settlement: EasyDate, pos: NumDenumPosition) -> i32 {
        if matches!(pos, NumDenumPosition::Numerator) {
            (u32::from(settlement) - u32::from(issue)) as i32
        } else {
            days_diff_360_eu(issue, settlement)
        }
    }

    fn days_in_year(_: EasyDate, _: EasyDate) -> f64 {
        360.
    }
}

impl DayCountTools for Actual365 {
    fn coup_days(_: EasyDate, _: EasyDate, freq: u8) -> u32 {
        365 / freq as u32
    }

    fn coup_days_bs(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let pcd = find_previous_coupon_date(settlement, maturity, freq);
        u32::from(settlement) - u32::from(pcd)
    }

    fn coup_days_nc(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let ncd = find_next_coupon_date(settlement, maturity, freq);
        u32::from(ncd) - u32::from(settlement)
    }

    fn days_between(issue: EasyDate, settlement: EasyDate, position: NumDenumPosition) -> i32 {
        if matches!(position, NumDenumPosition::Numerator) {
            (u32::from(settlement) - u32::from(issue)) as i32
        } else {
            days_diff_365(issue, settlement)
        }
    }

    fn days_in_year(_: EasyDate, _: EasyDate) -> f64 {
        365.
    }
}

impl DayCountTools for ActualActual {
    fn coup_days(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let pcd = find_previous_coupon_date(settlement, maturity, freq);
        let ncd = find_next_coupon_date(settlement, maturity, freq);
        u32::from(ncd) - u32::from(pcd)
    }

    fn coup_days_bs(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let pcd = find_previous_coupon_date(settlement, maturity, freq);
        u32::from(settlement) - u32::from(pcd)
    }

    fn coup_days_nc(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
        let ncd = find_next_coupon_date(settlement, maturity, freq);
        u32::from(ncd) - u32::from(settlement)
    }

    fn days_between(issue: EasyDate, settlement: EasyDate, _: NumDenumPosition) -> i32 {
        (u32::from(settlement) - u32::from(issue)) as i32
    }

    fn days_in_year(issue: EasyDate, settlement: EasyDate) -> f64 {
        if issue.year == settlement.year {
            if issue.year % 100 == 0 && issue.year % 400 == 0 {
                return 366.;
            } else if issue.year % 4 == 0 {
                return 366.;
            } else {
                return 365.;
            }
        }
        let s_days: u32 = issue.into();
        let e_days: u32 = settlement.into();
        let actual_days = (e_days - s_days) as f64;
        let sy_first_day: u32 = EasyDate {
            year: issue.year,
            month: 1,
            day: 1,
        }
        .into();
        let ey_first_day: u32 = EasyDate {
            year: (settlement.year + 1) as u32,
            month: 1,
            day: 1,
        }
        .into();
        let average =
            ((ey_first_day - sy_first_day) as f64) / ((settlement.year - issue.year + 1) as f64);
        actual_days / average
    }
}

pub fn find_previous_coupon_date(settlement: EasyDate, maturity: EasyDate, freq: u8) -> EasyDate {
    let delta_month = -12 / freq as i32;

    let mut idx = 1;

    loop {
        let mut curr = maturity.clone();
        curr.add_delta_months(idx * delta_month);
        if curr < settlement {
            if maturity.is_last_date_of_this_month() {
                curr = curr.last_day_of_this_month();
            }
            return curr;
        } else {
            idx += 1;
        }
    }
}

pub fn find_next_coupon_date(settlement: EasyDate, maturity: EasyDate, freq: u8) -> EasyDate {
    let delta_month = -12 / freq as i32;

    let mut idx = 1;

    loop {
        let mut curr = maturity.clone();
        curr.add_delta_months(idx * delta_month);
        if curr < settlement {
            if maturity.is_last_date_of_this_month() {
                curr = curr.last_day_of_this_month();
            }

            curr.add_delta_months(-delta_month);

            if curr > maturity {
                curr = maturity
            }
            return curr;
        } else {
            idx += 1;
        }
    }
}

pub fn get_coupon_num(settlement: EasyDate, maturity: EasyDate, freq: u8) -> u32 {
    let pcd = find_previous_coupon_date(settlement, maturity, freq);
    let mut months = (maturity.year - pcd.year) * 12;
    if maturity.month >= pcd.month {
        months += (maturity.month - pcd.month) as u32;
    } else {
        months -= (pcd.month - maturity.month) as u32;
    }
    months * freq as u32 / 12
}

pub fn days_diff_360(start: EasyDate, end: EasyDate) -> i32 {
    let end_year = end.year as i32;
    let start_year = start.year as i32;
    let end_month = end.month as i32;
    let start_month = start.month as i32;
    let end_day = end.day as i32;
    let start_day = start.day as i32;
    (end_year - start_year) * 360 + (end_month - start_month) * 30 + end_day - start_day
}

// Use this function should assert the year of date is after 1900.
pub fn days_diff_365(start: EasyDate, end: EasyDate) -> i32 {
    let start_num =
        get_serial_num_by_date_1900(start.year, start.month as u32, start.day as u32).unwrap();
    let end_num = get_serial_num_by_date_1900(end.year, end.month as u32, end.day as u32).unwrap();
    let days = (end_num - start_num) as i32;
    let leap_days = (start.year..end.year).into_iter().fold(0, |prev, y| {
        if (y % 100 == 0 && y % 4 == 0) || (y % 100 != 0 && y % 4 == 0) {
            prev + 1
        } else {
            prev
        }
    });
    if end.year >= start.year {
        days - leap_days
    } else {
        days + leap_days
    }
}

pub fn days_diff_360_us(start: EasyDate, end: EasyDate, method: Method360Us) -> i32 {
    let mut sd1 = start.day as i32;
    let sm1 = start.month as i32;
    let sy1 = start.year as i32;
    let mut ed1 = end.day as i32;
    let em1 = end.month as i32;
    let ey1 = end.year as i32;

    if end.is_last_date_of_feburary()
        && (start.is_last_date_of_feburary() || matches!(method, Method360Us::ModifyStartDate))
    {
        ed1 = 30;
    }

    if ed1 == 31 && (sd1 >= 30 || matches!(method, Method360Us::ModifyBothDates)) {
        ed1 = 30;
    }

    if sd1 == 31 {
        sd1 = 30;
    }

    if start.is_last_date_of_feburary() {
        sd1 = 30;
    }

    let d1 = EasyDate {
        year: sy1 as u32,
        month: sm1 as u8,
        day: sd1 as u8,
    };
    let d2 = EasyDate {
        year: ey1 as u32,
        month: em1 as u8,
        day: ed1 as u8,
    };

    days_diff_360(d1, d2)
}

pub fn days_diff_360_eu(start: EasyDate, end: EasyDate) -> i32 {
    let mut sd1 = start.day as i32;
    let sm1 = start.month as i32;
    let sy1 = start.year as i32;
    let mut ed1 = end.day as i32;
    let em1 = end.month as i32;
    let ey1 = end.year as i32;

    if sd1 == 31 {
        sd1 = 30;
    }

    if ed1 == 31 {
        ed1 = 30;
    }

    let d1 = EasyDate {
        year: sy1 as u32,
        month: sm1 as u8,
        day: sd1 as u8,
    };
    let d2 = EasyDate {
        year: ey1 as u32,
        month: em1 as u8,
        day: ed1 as u8,
    };

    days_diff_360(d1, d2)
}

pub fn get_price_yield_factors<T: DayCountTools>(
    settlement: EasyDate,
    maturity: EasyDate,
    freq: u8,
) -> PriceYieldFactors {
    let n = get_coupon_num(settlement, maturity, freq);
    let pcd = find_previous_coupon_date(settlement, maturity, freq);
    let a = T::days_between(pcd, settlement, NumDenumPosition::Numerator);
    let e = T::coup_days(settlement, maturity, freq);
    let dsc = e as i32 - a;
    PriceYieldFactors { n, pcd, a, e, dsc }
}

pub fn get_mat_factors<T: DayCountTools>(
    settlement: EasyDate,
    maturity: EasyDate,
    issue: EasyDate,
) -> MatFactors {
    let b = T::days_in_year(issue, settlement);
    let dim = T::days_between(issue, maturity, NumDenumPosition::Numerator);
    let a = T::days_between(issue, settlement, NumDenumPosition::Numerator);
    let dsm = dim - a;
    MatFactors { b, dim, a, dsm }
}

pub fn get_common_factors<T: DayCountTools>(
    settlement: EasyDate,
    maturity: EasyDate,
) -> CommonFactors {
    let dim = T::days_between(settlement, maturity, NumDenumPosition::Numerator);
    let b = T::days_in_year(settlement, maturity);

    CommonFactors { dim, b }
}

pub enum Method360Us {
    ModifyStartDate,
    ModifyBothDates,
}

pub enum NumDenumPosition {
    Numerator,
    // Denumerator,
}

pub enum DayCountBasis {
    US30Divide360,
    ActualDivideActual,
    ActualDivide360,
    ActualDivide365,
    Euro30Divide360,
}

pub struct PriceYieldFactors {
    pub n: u32,
    pub pcd: EasyDate,
    pub a: i32,
    pub e: u32,
    pub dsc: i32,
}

pub struct MatFactors {
    pub b: f64,
    pub dim: i32,
    pub a: i32,
    pub dsm: i32,
}

pub struct CommonFactors {
    pub dim: i32,
    pub b: f64,
}
