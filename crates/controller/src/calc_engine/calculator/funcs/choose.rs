use crate::calc_engine::calculator::calc_vertex::{CalcValue, Value};
use crate::calc_engine::connector::Connector;

use super::CalcVertex;

use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(idx, first);

    let idx = idx.trunc() as usize;
    let v = args_iter.skip(idx - 1).next();
    assert_or_return!(v.is_some(), ast::Error::Value);
    v.unwrap()
}
