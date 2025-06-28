use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(first_str, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(second_str, second);
    CalcVertex::from_string(first_str + second_str.as_str())
}
