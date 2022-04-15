use controller_base::datetime::{get_time_by_decimal_num, Time};
use parser::ast;

use crate::calc_engine::connector::Connector;

use super::super::{CalcValue, CalcVertex, Value};

pub fn calc_hour<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |t| t.hour)
}

pub fn calc_minute<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |t| t.minute)
}

pub fn calc_second<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |t| t.second)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(Time) -> u32,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let first = fetcher.get_calc_value(args.into_iter().next().unwrap());
    assert_f64_from_calc_value!(n, first);
    let date = get_time_by_decimal_num(n);
    let r = func(date) as f64;
    CalcVertex::from_number(r)
}
