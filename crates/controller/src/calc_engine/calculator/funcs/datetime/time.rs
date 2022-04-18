use logisheets_base::datetime::get_decimal_num_by_time;
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
    assert_f64_from_calc_value!(hour, first);
    assert_or_return!(hour >= 0., ast::Error::Num);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(minute, second);
    assert_or_return!(minute >= 0., ast::Error::Num);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(second, third);
    assert_or_return!(second >= 0., ast::Error::Num);
    let res = get_decimal_num_by_time(hour as u32, minute as u32, second as u32);
    match res {
        Some(r) => CalcVertex::from_number(r as f64),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}
