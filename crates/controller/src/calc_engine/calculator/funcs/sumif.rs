use super::condition::{
    get_condition_value, match_condition, parse_condition, Condition, LogicalCondition, Op,
};
use crate::calc_engine::connector::Connector;
use itertools::Itertools;
use logisheets_parser::ast;

use super::{CalcValue, CalcVertex, Value};

pub fn calc_sumif<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sum_func = |a: f64, b: f64| -> f64 { a + b };
    let result = |sum: f64, _: f64| CalcVertex::from_number(sum);
    calc_if(args, fetcher, &result, &sum_func)
}

pub fn calc_averageif<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sum_func = |a: f64, b: f64| -> f64 { a + b };
    let result = |sum: f64, cnt: f64| {
        if cnt == 0. {
            CalcVertex::from_error(ast::Error::Div0)
        } else {
            CalcVertex::from_number(sum / cnt)
        }
    };
    calc_if(args, fetcher, &result, &sum_func)
}

pub fn calc_sumifs<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sum_func = |a: f64, b: f64| -> f64 { a + b };
    let result = |sum: f64, _: f64| CalcVertex::from_number(sum);
    calc_ifs(args, fetcher, &result, &sum_func)
}

pub fn calc_averageifs<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sum_func = |a: f64, b: f64| -> f64 { a + b };
    let result = |sum: f64, cnt: f64| {
        if cnt == 0. {
            CalcVertex::from_error(ast::Error::Div0)
        } else {
            CalcVertex::from_number(sum / cnt)
        }
    };
    calc_ifs(args, fetcher, &result, &sum_func)
}

pub fn calc_maxifs<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sum_func = |a: f64, b: f64| -> f64 {
        if a > b {
            a
        } else {
            b
        }
    };
    let result = |sum: f64, _: f64| CalcVertex::from_number(sum);
    calc_ifs(args, fetcher, &result, &sum_func)
}

pub fn calc_minifs<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sum_func = |a: f64, b: f64| -> f64 {
        if a > b {
            b
        } else {
            a
        }
    };
    let result = |sum: f64, _: f64| CalcVertex::from_number(sum);
    calc_ifs(args, fetcher, &result, &sum_func)
}

pub fn calc_countifs<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |_, _| -> f64 { 0. };
    let result = |_: f64, cnt: f64| CalcVertex::from_number(cnt);
    calc_ifs(args, fetcher, &result, &func)
}

fn calc_ifs<C, F, SF>(args: Vec<CalcVertex>, fetcher: &mut C, f: &F, sum_func: &SF) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, f64) -> CalcVertex,
    SF: Fn(f64, f64) -> f64,
{
    assert_or_return!(args.len() % 2 == 1, ast::Error::Unspecified);
    let pair_len = (args.len() - 1) / 2;
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_range_from_calc_value!(calc_range, first);
    let mut pair: Vec<Criteria<_>> = Vec::with_capacity(pair_len);

    let mut pair_iter = args_iter.peekable();
    while pair_iter.peek().is_some() {
        let c = fetcher.get_calc_value(pair_iter.next().unwrap());
        let cr = fetcher.get_calc_value(pair_iter.next().unwrap());
        assert_range_from_calc_value!(range, c);
        let condition = match &cr {
            CalcValue::Scalar(v) => match v {
                Value::Text(t) => parse_condition(t),
                _ => {
                    let value = get_condition_value(&v);
                    let condition = Condition::Logical(LogicalCondition { op: Op::Eq, value });
                    Some(condition)
                }
            },
            _ => None,
        };
        assert_or_return!(condition.is_some(), ast::Error::Value);
        let condition = condition.unwrap();
        let criteria = Criteria {
            data: range
                .into_iter()
                .map(|v| match_condition(&condition, &v))
                .collect_vec()
                .into_iter(),
        };
        pair.push(criteria);
    }

    let mut sum = 0.;
    let mut cnt = 0.;
    let mut calc_range = calc_range.into_iter();
    let mut curr_value = calc_range.next();
    while curr_value.is_some() {
        let mut all_true = true;
        for i in pair.iter_mut() {
            if let Some(b) = i.next() {
                if !b {
                    all_true = b;
                    break;
                }
            } else {
                all_true = false;
                break;
            }
        }
        if all_true {
            let v = curr_value.unwrap();
            sum = sum_func(sum, get_num_from_value(v));
            cnt += 1.;
        }
        curr_value = calc_range.next();
    }
    f(sum, cnt)
}

struct Criteria<T: Iterator<Item = bool>> {
    pub data: T,
}

impl<T: Iterator<Item = bool>> Criteria<T> {
    pub fn next(&mut self) -> Option<bool> {
        let v = self.data.next()?;
        Some(v)
    }
}

fn calc_if<C, F, SF>(args: Vec<CalcVertex>, fetcher: &mut C, f: &F, sum_func: &SF) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, f64) -> CalcVertex,
    SF: Fn(f64, f64) -> f64,
{
    assert_or_return!(args.len() >= 2 && args.len() <= 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_range_from_calc_value!(range, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    let condition = match &second {
        CalcValue::Scalar(v) => match v {
            Value::Text(t) => parse_condition(t),
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

    let mut sum = 0.;
    let mut cnt = 0.;

    if let Some(third) = args_iter.next() {
        let sum_range = fetcher.get_calc_value(third);
        assert_range_from_calc_value!(sum_range, sum_range);
        sum_range
            .into_iter()
            .zip(range.into_iter())
            .for_each(|(c, s)| {
                if match_condition(&condition, &s) {
                    sum = sum_func(sum, get_num_from_value(c));
                    cnt += 1.;
                }
            })
    } else {
        range.into_iter().for_each(|v| {
            if match_condition(&condition, &v) {
                sum = sum_func(sum, get_num_from_value(v));
                cnt += 1.;
            }
        })
    };
    f(sum, cnt)
}

#[inline]
fn get_num_from_value(v: Value) -> f64 {
    match v {
        Value::Number(n) => n,
        _ => 0.,
    }
}
