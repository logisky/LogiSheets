use controller_base::datetime::{get_date_by_serial_num_1900, Date};
use parser::ast;

use crate::calc_engine::connector::Connector;

use super::super::{CalcValue, CalcVertex, Value};

pub fn calc_year<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |d| d.year)
}

pub fn calc_month<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |d| d.month)
}

pub fn calc_day<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |d| d.day)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(Date) -> u32,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let first = fetcher.get_calc_value(args.into_iter().next().unwrap());
    assert_f64_from_calc_value!(n, first);
    let n = n.trunc() as u32;
    let date = get_date_by_serial_num_1900(n);
    let r = func(date) as f64;
    CalcVertex::from_number(r)
}
