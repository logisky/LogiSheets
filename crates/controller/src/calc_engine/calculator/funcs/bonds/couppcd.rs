use crate::calc_engine::calculator::math::bond::coupncd;
use logisheets_parser::ast;

use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 3 && args.len() <= 4, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(settle_num, first);
    assert_or_return!(settle_num > 0., ast::Error::Value);

    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(maturity_num, second);
    assert_or_return!(maturity_num > 0., ast::Error::Value);

    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(freq_num, third);
    assert_or_return!(
        freq_num == 1. || freq_num == 2. || freq_num == 4.,
        ast::Error::Num
    );

    let forth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(base, forth);
    assert_or_return!(base >= 0. && base <= 4., ast::Error::Num);

    assert_or_return!(settle_num < maturity_num, ast::Error::Num);

    let result = coupncd(
        settle_num.floor() as u32,
        maturity_num.floor() as u32,
        base.floor() as u8,
    ) as f64;
    CalcVertex::from_number(result)
}
