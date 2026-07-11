//! Annuity/depreciation functions that complete the families already present
//! (`math/pmt.rs`, `math/fv.rs`, `math/cumipmt.rs`, `math/newton_iter.rs`).

use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::cumipmt::calc_cumipmt;
use crate::calc_engine::calculator::math::fv::calc_fv;
use crate::calc_engine::calculator::math::newton_iter::newton;
use crate::calc_engine::calculator::math::pmt::calc_pmt;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// NPER(rate, pmt, pv, [fv], [type]) — number of payment periods.
pub fn calc_nper<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 3 && args.len() <= 5, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(rate, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(pmt, b);
    let c = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(pv, c);
    let fv = optional_f64!(iter, fetcher, 0.);
    let ty = optional_f64!(iter, fetcher, 0.);
    assert_or_return!(ty == 0. || ty == 1., ast::Error::Num);

    if rate == 0. {
        if pmt == 0. {
            return CalcVertex::from_error(ast::Error::Num);
        }
        return CalcVertex::from_number(-(pv + fv) / pmt);
    }
    let z = pmt * (1. + rate * ty);
    let num = z - fv * rate;
    let den = z + pv * rate;
    if den == 0. || num / den <= 0. {
        return CalcVertex::from_error(ast::Error::Num);
    }
    CalcVertex::from_number((num / den).ln() / (1. + rate).ln())
}

/// RATE(nper, pmt, pv, [fv], [type], [guess]) — interest rate per period,
/// solved iteratively (reuses `math::newton_iter::newton`).
pub fn calc_rate<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 3 && args.len() <= 6, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(nper, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(pmt, b);
    let c = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(pv, c);
    let fv = optional_f64!(iter, fetcher, 0.);
    let ty = optional_f64!(iter, fetcher, 0.);
    let guess = optional_f64!(iter, fetcher, 0.1);
    assert_or_return!(ty == 0. || ty == 1., ast::Error::Num);

    // The rate that makes the future value of (pv, pmt) equal the target fv.
    let beginning = ty == 1.;
    let f = |r: f64| calc_fv(r, nper, pmt, pv, beginning) - fv;
    match newton(guess, f) {
        Some(r) => CalcVertex::from_number(r),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}

/// CUMPRINC(rate, nper, pv, start, end, type) — cumulative principal paid
/// between `start` and `end`. Uses the identity Σppmt = count·pmt − Σipmt, so it
/// reuses the tested `calc_pmt` / `calc_cumipmt`.
pub fn calc_cumprinc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 6, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(rate, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(nper, b);
    let c = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(pv, c);
    let d = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(start, d);
    let e = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(end, e);
    let g = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(ty, g);
    assert_or_return!(ty == 0. || ty == 1., ast::Error::Num);

    let nper = nper.floor() as usize;
    let start = start.floor() as i64;
    let end = end.floor() as i64;
    let beginning = ty == 1.;
    let pmt = calc_pmt(rate, nper, pv, 0., beginning);
    match calc_cumipmt(rate, nper, pv, start, end, beginning) {
        Some(cumi) => {
            let count = (end - start + 1) as f64;
            CalcVertex::from_number(pmt * count - cumi)
        }
        None => CalcVertex::from_error(ast::Error::Num),
    }
}

/// DB(cost, salvage, life, period, [month]) — fixed-declining-balance depreciation.
pub fn calc_db<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 4 && args.len() <= 5, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(cost, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(salvage, b);
    let c = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(life, c);
    let d = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(period, d);
    let month = optional_f64!(iter, fetcher, 12.);

    if cost <= 0. || salvage < 0. || life <= 0. || period < 1. || month < 1. || month > 12. {
        return CalcVertex::from_error(ast::Error::Num);
    }
    if period > life + 1. {
        return CalcVertex::from_error(ast::Error::Num);
    }
    // Depreciation rate = round(1 − (salvage/cost)^(1/life), 3) (Excel's definition).
    let rate = ((1. - (salvage / cost).powf(1. / life)) * 1000.).round() / 1000.;

    let p = period.floor() as i64;
    let mut total = 0.;
    let mut dep = 0.;
    for i in 1..=p {
        dep = if i == 1 {
            cost * rate * month / 12.
        } else if i as f64 >= life + 1. {
            (cost - total) * rate * (12. - month) / 12.
        } else {
            (cost - total) * rate
        };
        total += dep;
    }
    CalcVertex::from_number(dep)
}

/// DDB(cost, salvage, life, period, [factor]) — double- (or factor-) declining
/// balance depreciation, clamped so book value never dips below salvage.
pub fn calc_ddb<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 4 && args.len() <= 5, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(cost, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(salvage, b);
    let c = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(life, c);
    let d = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(period, d);
    let factor = optional_f64!(iter, fetcher, 2.);

    if cost < 0. || salvage < 0. || life <= 0. || period < 1. || factor <= 0. {
        return CalcVertex::from_error(ast::Error::Num);
    }
    if period > life + 1. {
        return CalcVertex::from_error(ast::Error::Num);
    }
    let rate = factor / life;
    let p = period.floor() as i64;
    let mut total = 0.;
    let mut dep = 0.;
    for _ in 1..=p {
        dep = (cost - total) * rate;
        let remaining = (cost - salvage - total).max(0.);
        if dep > remaining {
            dep = remaining;
        }
        total += dep;
    }
    CalcVertex::from_number(dep)
}
