use crate::calc_engine::calculator::math::bond::{accrint, DayCountBasis};

use logisheets_parser::ast;

use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;

pub fn calc_accrint<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 6 && args.len() <= 7, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();

    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(issue, first);
    assert_or_return!(issue > 0., ast::Error::Value);

    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(first_interest, second);
    assert_or_return!(first_interest > 0., ast::Error::Value);

    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(settlement, third);
    assert_or_return!(settlement > 0., ast::Error::Value);

    let fourth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, fourth);
    assert_or_return!(rate > 0., ast::Error::Num);

    let fifth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(par, fifth);
    assert_or_return!(par > 0., ast::Error::Num);

    let sixth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(freq, sixth);
    assert_or_return!(freq == 1. || freq == 2. || freq == 4., ast::Error::Num);

    assert_or_return!(settlement > issue, ast::Error::Num);

    let basis = if let Some(arg) = args_iter.next() {
        assert_f64_from_calc_value!(b, fetcher.get_calc_value(arg));
        assert_or_return!(b >= 0. && b <= 4., ast::Error::Num);
        match b.floor() as u8 {
            0 => DayCountBasis::US30Divide360,
            1 => DayCountBasis::ActualDivideActual,
            2 => DayCountBasis::ActualDivide360,
            3 => DayCountBasis::ActualDivide365,
            4 => DayCountBasis::Euro30Divide360,
            _ => unreachable!(),
        }
    } else {
        DayCountBasis::US30Divide360
    };

    let result = accrint(
        issue.floor() as u32,
        settlement.floor() as u32,
        rate,
        par,
        basis,
    );
    CalcVertex::from_number(result)
}

pub fn calc_accrintm<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 6 && args.len() <= 7, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();

    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(issue, first);
    assert_or_return!(issue > 0., ast::Error::Value);

    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(settlement, second);
    assert_or_return!(settlement > 0., ast::Error::Value);

    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, third);
    assert_or_return!(rate > 0., ast::Error::Num);

    let fourth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(par, fourth);
    assert_or_return!(par > 0., ast::Error::Num);

    let fifth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(freq, fifth);
    assert_or_return!(freq == 1. || freq == 2. || freq == 4., ast::Error::Num);

    assert_or_return!(settlement > issue, ast::Error::Num);

    let basis = if let Some(arg) = args_iter.next() {
        assert_f64_from_calc_value!(b, fetcher.get_calc_value(arg));
        assert_or_return!(b >= 0. && b <= 4., ast::Error::Num);
        match b.floor() as u8 {
            0 => DayCountBasis::US30Divide360,
            1 => DayCountBasis::ActualDivideActual,
            2 => DayCountBasis::ActualDivide360,
            3 => DayCountBasis::ActualDivide365,
            4 => DayCountBasis::Euro30Divide360,
            _ => unreachable!(),
        }
    } else {
        DayCountBasis::US30Divide360
    };

    let result = accrint(
        issue.floor() as u32,
        settlement.floor() as u32,
        rate,
        par,
        basis,
    );
    CalcVertex::from_number(result)
}
