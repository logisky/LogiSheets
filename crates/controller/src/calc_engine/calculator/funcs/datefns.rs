//! Date arithmetic that operates on serial numbers (already-parsed dates):
//! DATEDIF, DAYS360, YEARFRAC, NETWORKDAYS. Reuses `math/day_count.rs` for the
//! 30/360 conventions and `logisheets_base::datetime` for serial↔date.

use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::funcs::utils::get_nums_from_value;
use crate::calc_engine::calculator::math::day_count::days_diff_360_eu;
use crate::calc_engine::connector::Connector;
use logisheets_base::datetime::EasyDate;
use logisheets_parser::ast;

fn is_leap(y: u32) -> bool {
    y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
}

/// Days in a month (handles leap February).
fn days_in_month(year: u32, month: u8) -> u8 {
    EasyDate {
        year,
        month,
        day: 1,
    }
    .last_day_of_this_month()
    .day
}

/// Serial number for (year, month, day), clamping the day into the month so an
/// out-of-range day (e.g. Feb 29 in a non-leap year) can't panic.
fn safe_serial(year: u32, month: u8, day: u8) -> u32 {
    let last = days_in_month(year, month);
    let dt = EasyDate {
        year,
        month,
        day: day.min(last),
    };
    u32::from(dt)
}

/// Plain NASD (US) 30/360 day count — no bond/February special-casing (that
/// belongs to YEARFRAC basis 0, not to DAYS360).
fn days360_us(s: EasyDate, e: EasyDate) -> i32 {
    let mut d1 = s.day as i32;
    let mut d2 = e.day as i32;
    if d1 == 31 {
        d1 = 30;
    }
    if d2 == 31 && d1 == 30 {
        d2 = 30;
    }
    (e.year as i32 - s.year as i32) * 360
        + (e.month as i32 - s.month as i32) * 30
        + (d2 - d1)
}

/// DAYS360(start, end, [european]) — days between dates on a 360-day year.
pub fn calc_days360<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2 || args.len() == 3, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(s_ser, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(e_ser, b);
    let european = optional_f64!(iter, fetcher, 0.) != 0.;
    if s_ser < 0. || e_ser < 0. {
        return CalcVertex::from_error(ast::Error::Num);
    }
    let s = EasyDate::from(s_ser.trunc() as u32);
    let e = EasyDate::from(e_ser.trunc() as u32);
    let days = if european {
        days_diff_360_eu(s, e)
    } else {
        days360_us(s, e)
    };
    CalcVertex::from_number(days as f64)
}

/// YEARFRAC(start, end, [basis]) — the fraction of a year between two dates.
/// basis 0=US30/360, 1=actual/actual, 2=actual/360, 3=actual/365, 4=EU30/360.
pub fn calc_yearfrac<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2 || args.len() == 3, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(x, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(y, b);
    let basis = optional_f64!(iter, fetcher, 0.).trunc() as i64;
    if x < 0. || y < 0. {
        return CalcVertex::from_error(ast::Error::Num);
    }
    // YEARFRAC is symmetric; work with the earlier date first.
    let (lo, hi) = if x <= y { (x, y) } else { (y, x) };
    let lo_ser = lo.trunc() as u32;
    let hi_ser = hi.trunc() as u32;
    let s = EasyDate::from(lo_ser);
    let e = EasyDate::from(hi_ser);
    let actual = (hi_ser - lo_ser) as f64;

    let frac = match basis {
        0 => days360_us(s, e) as f64 / 360.,
        4 => days_diff_360_eu(s, e) as f64 / 360.,
        2 => actual / 360.,
        3 => actual / 365.,
        1 => {
            if s.year == e.year {
                actual / if is_leap(s.year) { 366. } else { 365. }
            } else {
                let sy_first = safe_serial(s.year, 1, 1) as f64;
                let ey_next = safe_serial(e.year + 1, 1, 1) as f64;
                let years = (e.year - s.year + 1) as f64;
                let avg = (ey_next - sy_first) / years;
                actual / avg
            }
        }
        _ => return CalcVertex::from_error(ast::Error::Num),
    };
    CalcVertex::from_number(frac)
}

/// DATEDIF(start, end, unit) — difference in "Y"/"M"/"D"/"MD"/"YM"/"YD".
pub fn calc_datedif<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(s_ser, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(e_ser, b);
    let c = fetcher.get_calc_value(iter.next().unwrap());
    assert_text_from_calc_value!(unit, c);

    let s_ser = s_ser.trunc() as u32;
    let e_ser = e_ser.trunc() as u32;
    if e_ser < s_ser {
        return CalcVertex::from_error(ast::Error::Num);
    }
    let s = EasyDate::from(s_ser);
    let e = EasyDate::from(e_ser);

    // Complete months between the two dates.
    let complete_months = |s: EasyDate, e: EasyDate| -> i64 {
        let mut m = (e.year as i64 - s.year as i64) * 12 + (e.month as i64 - s.month as i64);
        if e.day < s.day {
            m -= 1;
        }
        m
    };

    let res: i64 = match unit.to_uppercase().as_str() {
        "Y" => {
            let mut yy = e.year as i64 - s.year as i64;
            if (e.month, e.day) < (s.month, s.day) {
                yy -= 1;
            }
            yy
        }
        "M" => complete_months(s, e),
        "D" => (e_ser - s_ser) as i64,
        "YM" => complete_months(s, e).rem_euclid(12),
        "MD" => {
            if e.day >= s.day {
                (e.day - s.day) as i64
            } else {
                let (py, pm) = if e.month == 1 {
                    (e.year - 1, 12)
                } else {
                    (e.year, e.month - 1)
                };
                days_in_month(py, pm) as i64 - s.day as i64 + e.day as i64
            }
        }
        "YD" => {
            // Days as if `start` were in the same year as `end` (or the prior
            // year, if that anchor would fall after `end`).
            let mut anchor = safe_serial(e.year, s.month, s.day);
            if anchor > e_ser {
                anchor = safe_serial(e.year - 1, s.month, s.day);
            }
            (e_ser - anchor) as i64
        }
        _ => return CalcVertex::from_error(ast::Error::Value),
    };
    CalcVertex::from_number(res as f64)
}

/// NETWORKDAYS(start, end, [holidays]) — count of whole working days (Mon–Fri)
/// between the two dates, excluding any holidays. Negative if start > end.
pub fn calc_networkdays<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2 || args.len() == 3, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(s_ser, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(e_ser, b);

    // Optional holiday list (a range or a single value).
    let mut holidays: Vec<i64> = Vec::new();
    if let Some(h) = iter.next() {
        let v = fetcher.get_calc_value(h);
        match get_nums_from_value(v) {
            Ok(nums) => holidays = nums.into_iter().map(|n| n.trunc() as i64).collect(),
            Err(e) => return CalcVertex::from_error(e),
        }
    }

    let s = s_ser.trunc() as i64;
    let e = e_ser.trunc() as i64;
    let (lo, hi, sign) = if s <= e { (s, e, 1i64) } else { (e, s, -1i64) };

    let mut count = 0i64;
    for d in lo..=hi {
        // WEEKDAY(type 1): serial%7 == 1 is Sunday, == 0 is Saturday.
        if d % 7 == 0 || d % 7 == 1 {
            continue;
        }
        if holidays.contains(&d) {
            continue;
        }
        count += 1;
    }
    CalcVertex::from_number((count * sign) as f64)
}
