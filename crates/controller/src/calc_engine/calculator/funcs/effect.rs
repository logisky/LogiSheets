use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::effect::{calc_effect, calc_nominal};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn effect<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(nper, second);
    let nper = nper.floor() as i32;
    assert_or_return!(nper > 0, ast::Error::Num);
    let res = calc_effect(rate, nper);
    CalcVertex::from_number(res)
}

pub fn nominal<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, first);
    assert_or_return!(rate > 0., ast::Error::Num);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(npery, second);
    let npery = npery.floor() as u32;
    assert_or_return!(npery >= 1, ast::Error::Num);
    let res = calc_nominal(rate, npery);
    CalcVertex::from_number(res)
}
