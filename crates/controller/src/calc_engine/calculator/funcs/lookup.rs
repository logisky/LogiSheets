use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};

use super::condition::match_text_pattern;
use logisheets_base::matrix_value::MatrixValue;
use logisheets_parser::ast;

pub fn calc_vlookup<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_lookup(args, fetcher, &vlookup_helper)
}

pub fn calc_hlookup<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_lookup(args, fetcher, &hlookup_helper)
}

fn vlookup_helper(
    lookup: &Value,
    values: MatrixValue<Value>,
    target: usize,
    approximatly: bool,
) -> CalcVertex {
    let (row_cnt, _) = values.get_avail_size();
    let mut to_match_values = vec![];
    for i in 0..row_cnt {
        match values.visit(i, 0) {
            Ok(v) => to_match_values.push(v.clone()),
            Err(v) => to_match_values.push(v),
        }
    }
    if let Some(idx) = match_value(&lookup, &to_match_values, approximatly) {
        match values.visit(idx, target - 1) {
            Ok(v) => CalcVertex::Value(CalcValue::Scalar(v.clone())),
            Err(v) => CalcVertex::Value(CalcValue::Scalar(v)),
        }
    } else {
        CalcVertex::from_error(ast::Error::Na)
    }
}

fn hlookup_helper(
    lookup: &Value,
    values: MatrixValue<Value>,
    target: usize,
    approximatly: bool,
) -> CalcVertex {
    let (_, col_cnt) = values.get_avail_size();
    let mut to_match_values = vec![];
    for i in 0..col_cnt {
        match values.visit(0, i) {
            Ok(v) => to_match_values.push(v.clone()),
            Err(v) => to_match_values.push(v),
        }
    }
    if let Some(idx) = match_value(&lookup, &to_match_values, approximatly) {
        match values.visit(target - 1, idx) {
            Ok(v) => CalcVertex::Value(CalcValue::Scalar(v.clone())),
            Err(v) => CalcVertex::Value(CalcValue::Scalar(v)),
        }
    } else {
        CalcVertex::from_error(ast::Error::Na)
    }
}

fn calc_lookup<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, f: &F) -> CalcVertex
where
    C: Connector,
    F: Fn(&Value, MatrixValue<Value>, usize, bool) -> CalcVertex,
{
    assert_or_return!(args.len() >= 3 && args.len() <= 4, ast::Error::Unspecified);

    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    let lookup_value = match first {
        CalcValue::Scalar(v) => v,
        _ => return CalcVertex::from_error(ast::Error::Value),
    };
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_range_from_calc_value!(values, second);

    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(target, third);
    assert_or_return!(target >= 1., ast::Error::Value);
    let target = target.trunc() as usize;

    let approximatly = {
        if let Some(fourth) = args_iter.next() {
            let third = fetcher.get_calc_value(fourth);
            assert_bool_from_calc_value!(b, third);
            b
        } else {
            true
        }
    };

    f(&lookup_value, values, target, approximatly)
}

fn match_value(pattern: &Value, values: &[Value], approximatly: bool) -> Option<usize> {
    match pattern {
        Value::Number(n) => match_num(*n, values, approximatly),
        Value::Text(pattern) => match_text(pattern, values, approximatly),
        _ => match_exact_value(pattern, values),
    }
}

fn match_exact_value(pattern: &Value, values: &[Value]) -> Option<usize> {
    for (idx, v) in values.iter().enumerate() {
        match (pattern, v) {
            (Value::Blank, Value::Blank) => return Some(idx),
            (Value::Blank, _) => {}
            (Value::Boolean(a), Value::Boolean(b)) => {
                if a == b {
                    return Some(idx);
                }
            }
            (Value::Boolean(_), _) => {}
            (Value::Error(a), Value::Error(b)) => {
                if a == b {
                    return Some(idx);
                }
            }
            (Value::Error(_), _) => {}
            _ => unreachable!(),
        }
    }
    None
}

fn match_num(num: f64, values: &[Value], approximatly: bool) -> Option<usize> {
    let mut result_n = num;
    let mut result_idx = None;
    for (i, v) in values.iter().enumerate() {
        match v {
            Value::Number(n) => {
                if approximatly {
                    if *n < num && *n > result_n {
                        result_idx = Some(i);
                        result_n = *n;
                    }
                } else if num == *n {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    result_idx
}

fn match_text(pattern: &str, values: &[Value], approximatly: bool) -> Option<usize> {
    for (i, v) in values.iter().enumerate() {
        match v {
            Value::Text(s) => {
                if approximatly {
                    if match_text_pattern(pattern, s) {
                        return Some(i);
                    }
                } else if s == pattern {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    return None;
}
