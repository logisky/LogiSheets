use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, f: &F) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, i32) -> f64,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);

    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(digits, second);

    let r = f(num, digits.trunc() as i32);
    CalcVertex::from_number(r)
}

pub fn calc_mround<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);

    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(multiple, second);

    assert_or_return!(multiple * num >= 0., ast::Error::Num);
    if num == 0. {
        return CalcVertex::from_number(0.);
    }
    let n = (num / multiple).round();
    CalcVertex::from_number(n * multiple)
}

pub fn calc_round<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |num: f64, digits: i32| -> f64 {
        let shift_factor = 10_f64.powi(digits);
        (num * shift_factor).round() / shift_factor
    };

    calc(args, fetcher, &f)
}

pub fn calc_rounddown<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |num: f64, digits: i32| -> f64 {
        let shift_factor = 10_f64.powi(digits);
        (num * shift_factor).trunc() / shift_factor
    };

    calc(args, fetcher, &f)
}

pub fn calc_roundup<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |num: f64, digits: i32| -> f64 {
        let shift_factor = 10_f64.powi(digits);
        if num > 0. {
            (num * shift_factor).ceil() / shift_factor
        } else if num == 0. {
            0.
        } else {
            (num * shift_factor).floor() / shift_factor
        }
    };

    calc(args, fetcher, &f)
}

/// TRUNC(number, [num_digits]) — drop the fractional part beyond `num_digits`
/// (default 0), truncating toward zero. `num_digits` may be negative.
pub fn calc_trunc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1 || args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let digits = if let Some(arg) = args_iter.next() {
        let v = fetcher.get_calc_value(arg);
        assert_f64_from_calc_value!(d, v);
        d.trunc() as i32
    } else {
        0
    };
    let shift = 10_f64.powi(digits);
    CalcVertex::from_number((num * shift).trunc() / shift)
}

/// CEILING(number, significance) — round `number` UP (away from zero) to the
/// nearest multiple of `significance`. `number` and `significance` must share a
/// sign (else #NUM!); a zero significance yields 0.
pub fn calc_ceiling<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_to_multiple(args, fetcher, true)
}

/// FLOOR(number, significance) — round `number` DOWN (toward zero) to the
/// nearest multiple of `significance`. Same sign / zero rules as CEILING.
pub fn calc_floor<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_to_multiple(args, fetcher, false)
}

fn calc_to_multiple<C>(args: Vec<CalcVertex>, fetcher: &mut C, up: bool) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(sig, second);
    if sig == 0. || num == 0. {
        return CalcVertex::from_number(0.);
    }
    // number and significance must have the same sign.
    assert_or_return!((num > 0.) == (sig > 0.), ast::Error::Num);
    let q = num / sig;
    let rounded = if up { q.ceil() } else { q.floor() };
    CalcVertex::from_number(rounded * sig)
}
