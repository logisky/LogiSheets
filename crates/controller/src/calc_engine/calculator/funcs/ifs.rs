use crate::calc_engine::connector::Connector;

use super::utils::{get_condition_result, ConditionResult};
use super::CalcVertex;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() % 2 == 0, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let mut condition = args_iter.next();
    while condition.is_some() {
        let cond = condition.unwrap();
        let value = fetcher.get_calc_value(cond);
        let cond_res = get_condition_result(value);
        match cond_res {
            ConditionResult::True => {
                return args_iter.next().unwrap();
            }
            ConditionResult::False => {
                args_iter.next();
                condition = args_iter.next();
            }
            ConditionResult::Error(e) => {
                return CalcVertex::from_error(e);
            }
        }
    }
    CalcVertex::from_error(ast::Error::Na)
}
