use super::condition::{
    get_condition_value, match_condition, parse_condition, Condition, LogicalCondition, Op,
};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

use super::{CalcValue, CalcVertex, Value};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 2 && args.len() <= 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let firtst = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_range_from_calc_value!(range, firtst);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    let condition = match second {
        CalcValue::Scalar(v) => match v {
            Value::Text(t) => parse_condition(&t),
            _ => {
                let value = get_condition_value(&v);
                let condition = Condition::Logical(LogicalCondition { op: Op::Eq, value });
                Some(condition)
            }
        },
        _ => None,
    };
    if condition.is_none() {
        return CalcVertex::from_error(ast::Error::Value);
    }

    let condition = condition.unwrap();

    let result = if let Some(third) = args_iter.next() {
        let sum_range = fetcher.get_calc_value(third);
        assert_range_from_calc_value!(sum_range, sum_range);
        sum_range
            .into_iter()
            .zip(range.into_iter())
            .fold(0., |prev, (c, s)| {
                if match_condition(&condition, &s) {
                    get_num_from_value(c) + prev
                } else {
                    prev
                }
            })
    } else {
        range.into_iter().fold(0., |prev, v| {
            if match_condition(&condition, &v) {
                get_num_from_value(v) + prev
            } else {
                prev
            }
        })
    };
    CalcVertex::from_number(result)
}

#[inline]
fn get_num_from_value(v: Value) -> f64 {
    match v {
        Value::Number(n) => n,
        _ => 0.,
    }
}
