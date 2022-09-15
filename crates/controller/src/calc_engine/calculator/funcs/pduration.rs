use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::pduration::{calc_pduration, calc_rri};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn pduration<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(pv, second);
    assert_or_return!(pv > 0., ast::Error::Num);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(fv, third);
    assert_or_return!(fv > 0., ast::Error::Num);
    let res = calc_pduration(rate, pv, fv);
    CalcVertex::from_number(res)
}

pub fn rri<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(nper, first);
    assert_or_return!(nper > 0., ast::Error::Num);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(pv, second);
    assert_or_return!(pv > 0., ast::Error::Num);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(fv, third);
    assert_or_return!(fv > 0., ast::Error::Num);
    let res = calc_rri(nper, pv, fv);
    CalcVertex::from_number(res)
}
