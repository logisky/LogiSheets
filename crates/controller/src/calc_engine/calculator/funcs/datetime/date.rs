use logisheets_base::datetime::get_serial_num_by_date_1900;
use logisheets_parser::ast;

use crate::calc_engine::connector::Connector;

use super::super::{CalcValue, CalcVertex, Value};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(year, first);
    assert_or_return!(year >= 0., ast::Error::Num);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(month, second);
    assert_or_return!(month >= 0., ast::Error::Num);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(day, third);
    assert_or_return!(day >= 0., ast::Error::Num);
    let res = get_serial_num_by_date_1900(year as u32, month as u32, day as u32);
    match res {
        Some(r) => CalcVertex::from_number(r as f64),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}
