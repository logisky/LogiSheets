use crate::calc_engine::calculator::math::tbill::{tbilleq, tbillprice, tbillyield};

use logisheets_parser::ast;

use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, f: F) -> CalcVertex
where
    C: Connector,
    F: Fn(u32, u32, f64) -> f64,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();

    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(settlement, first);
    assert_or_return!(settlement > 0., ast::Error::Value);

    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(maturity, second);
    assert_or_return!(maturity > 0., ast::Error::Value);

    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(pr_or_discount, third);
    assert_or_return!(pr_or_discount > 0., ast::Error::Num);

    assert_or_return!(settlement < maturity, ast::Error::Num);

    let result = f(
        settlement.floor() as u32,
        maturity.floor() as u32,
        pr_or_discount,
    );
    CalcVertex::from_number(result)
}

pub fn calc_tbilleq<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |x, y, z| tbilleq(x, y, z))
}

pub fn calc_tbillprice<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |x, y, z| tbillprice(x, y, z))
}

pub fn calc_tbillyield<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |x, y, z| tbillyield(x, y, z))
}
