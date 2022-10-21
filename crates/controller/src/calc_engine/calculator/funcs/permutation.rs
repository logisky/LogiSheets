use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::combine::{
    calc_combine as combine, calc_permut as permut,
};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc_combine<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, combine)
}

pub fn calc_permut<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, permut)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(u64, u64) -> Option<u64>,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(first, first);
    let number = first.floor();
    assert_or_return!(number >= 0., ast::Error::Num);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(second, second);
    let chosen = second.floor();
    assert_or_return!(chosen >= 0., ast::Error::Num);
    assert_or_return!(chosen <= number, ast::Error::Num);
    let number = number as u64;
    let chosen = chosen as u64;
    let res = func(number, chosen);
    if let Some(res) = res {
        CalcVertex::from_number(res as f64)
    } else {
        CalcVertex::from_error(ast::Error::Num)
    }
}
