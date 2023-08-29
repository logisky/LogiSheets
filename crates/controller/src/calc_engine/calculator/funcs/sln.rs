use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::sln::{calc_sln, calc_syd};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn sln<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(cost, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(salvage, second);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(life, third);
    let res = calc_sln(cost, salvage, life.trunc() as u32);
    CalcVertex::from_number(res)
}

pub fn syd<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 4, ast::Error::Unspecified);

    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(cost, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(salvage, second);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(life, third);
    let fourth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(per, fourth);
    let result = calc_syd(cost, salvage, life.trunc() as u32, per);
    CalcVertex::from_number(result)
}
