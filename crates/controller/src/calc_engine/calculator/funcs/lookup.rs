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
    // Approximate match (the default): the largest value <= `num`, matching
    // Excel's behavior on an ascending-sorted first column. Track the best
    // candidate seen so far, starting below every possible value so the first
    // qualifying entry is always taken.
    let mut result_n = f64::NEG_INFINITY;
    let mut result_idx = None;
    for (i, v) in values.iter().enumerate() {
        if let Value::Number(n) = v {
            if approximatly {
                if *n <= num && *n > result_n {
                    result_idx = Some(i);
                    result_n = *n;
                }
            } else if num == *n {
                return Some(i);
            }
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

/// MATCH(lookup_value, lookup_array, [match_type]) — 1-based position of
/// `lookup_value` in the (1-D) `lookup_array`. match_type 1 (default) finds the
/// largest value <= lookup (array sorted ascending), 0 finds an exact match
/// (case-insensitive, wildcards allowed for text), -1 finds the smallest value
/// >= lookup (array sorted descending). #N/A when nothing matches.
pub fn calc_match<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 2 && args.len() <= 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    let lookup = match first {
        CalcValue::Scalar(v) => v,
        _ => return CalcVertex::from_error(ast::Error::Value),
    };
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_range_from_calc_value!(arr, second);
    let match_type = if let Some(a) = args_iter.next() {
        let v = fetcher.get_calc_value(a);
        assert_f64_from_calc_value!(mt, v);
        mt.trunc() as i64
    } else {
        1
    };

    let values: Vec<Value> = arr.into_iter().collect();
    let idx = if match_type == 0 {
        match_exact_position(&lookup, &values)
    } else if match_type > 0 {
        // Largest value <= lookup (ascending); on ties the later one wins.
        match_ordered_position(&lookup, &values, true)
    } else {
        // Smallest value >= lookup (descending); on ties the later one wins.
        match_ordered_position(&lookup, &values, false)
    };
    match idx {
        Some(i) => CalcVertex::from_number((i + 1) as f64),
        None => CalcVertex::from_error(ast::Error::Na),
    }
}

fn match_exact_position(lookup: &Value, values: &[Value]) -> Option<usize> {
    match lookup {
        Value::Number(n) => values
            .iter()
            .position(|v| matches!(v, Value::Number(m) if m == n)),
        Value::Boolean(b) => values
            .iter()
            .position(|v| matches!(v, Value::Boolean(x) if x == b)),
        Value::Text(p) => {
            let pl = p.to_lowercase();
            values.iter().position(|v| match v {
                Value::Text(s) => match_text_pattern(&pl, &s.to_lowercase()),
                _ => false,
            })
        }
        _ => None,
    }
}

/// Shared ordered scan for match types 1 and -1. `le` selects the largest value
/// <= lookup; otherwise the smallest value >= lookup. Ties keep the later index.
fn match_ordered_position(lookup: &Value, values: &[Value], le: bool) -> Option<usize> {
    match lookup {
        Value::Number(target) => {
            let mut best: Option<(f64, usize)> = None;
            for (i, v) in values.iter().enumerate() {
                if let Value::Number(n) = v {
                    let ok = if le { *n <= *target } else { *n >= *target };
                    let better = best.map_or(true, |(b, _)| if le { *n >= b } else { *n <= b });
                    if ok && better {
                        best = Some((*n, i));
                    }
                }
            }
            best.map(|(_, i)| i)
        }
        Value::Text(target) => {
            let t = target.to_lowercase();
            let mut best: Option<(String, usize)> = None;
            for (i, v) in values.iter().enumerate() {
                if let Value::Text(s) = v {
                    let sl = s.to_lowercase();
                    let ok = if le { sl <= t } else { sl >= t };
                    let better = best
                        .as_ref()
                        .map_or(true, |(b, _)| if le { sl >= *b } else { sl <= *b });
                    if ok && better {
                        best = Some((sl, i));
                    }
                }
            }
            best.map(|(_, i)| i)
        }
        _ => None,
    }
}
