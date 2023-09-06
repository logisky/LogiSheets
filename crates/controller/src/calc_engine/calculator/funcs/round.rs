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
