use crate::calc_engine::connector::Connector;

use super::utils::is_error;
use super::CalcVertex;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() != 2 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let value = fetcher.get_calc_value(iter.next().unwrap());
    if is_error(&value) {
        iter.next().unwrap()
    } else {
        CalcVertex::Value(value)
    }
}
