use super::condition::{
    get_condition_value, match_condition, parse_condition, Condition, LogicalCondition, Op,
};
use crate::calc_engine::connector::Connector;
use parser::ast;

use super::{CalcValue, CalcVertex, Value};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() != 2 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let first = fetcher.get_calc_value(iter.next().unwrap());
    let second = fetcher.get_calc_value(iter.next().unwrap());
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
    match condition {
        Some(cond) => CalcVertex::from_number(count_if_calc_value(&cond, first) as f64),
        None => CalcVertex::from_error(ast::Error::Unspecified),
    }
}

fn count_if_calc_value(cond: &Condition, value: CalcValue) -> u32 {
    match value {
        CalcValue::Scalar(v) => count_if_value(cond, &v),
        CalcValue::Range(r) => r
            .into_iter()
            .fold(0, |prev, this| prev + count_if_value(&cond, &this)),
        CalcValue::Cube(c) => c
            .into_iter()
            .fold(0, |prev, this| prev + count_if_value(&cond, &this)),
        CalcValue::Union(values) => values
            .into_iter()
            .map(|v| count_if_calc_value(cond, *v))
            .fold(0_u32, |prev, this| prev + this),
    }
}

fn count_if_value(condition: &Condition, v: &Value) -> u32 {
    if match_condition(condition, v) {
        1
    } else {
        0
    }
}
