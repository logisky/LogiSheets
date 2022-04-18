use crate::calc_engine::connector::Connector;

use super::utils::{get_condition_result, ConditionResult};
use super::CalcVertex;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() > 3 || args.len() < 2 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let first = fetcher.get_calc_value(iter.next().unwrap());
    let second = iter.next().unwrap();
    let third = iter.next().unwrap_or(CalcVertex::from_bool(false));
    let result = get_condition_result(first);
    match result {
        ConditionResult::True => second,
        ConditionResult::False => third,
        ConditionResult::Error(e) => CalcVertex::from_error(e),
    }
}
