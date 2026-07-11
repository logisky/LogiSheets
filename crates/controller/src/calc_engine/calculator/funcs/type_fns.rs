//! Value-inspection / coercion functions: N, T, TYPE.

use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

fn one_scalar<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> Result<CalcValue, CalcVertex>
where
    C: Connector,
{
    if args.len() != 1 {
        return Err(CalcVertex::from_error(ast::Error::Unspecified));
    }
    Ok(fetcher.get_calc_value(args.into_iter().next().unwrap()))
}

/// N(value) — numbers/dates pass through, TRUE→1, FALSE/blank→0, text→0, an
/// error stays an error.
pub fn calc_n<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let value = match one_scalar(args, fetcher) {
        Ok(v) => v,
        Err(e) => return e,
    };
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Number(n) => CalcVertex::from_number(n),
            Value::Boolean(b) => CalcVertex::from_number(if b { 1. } else { 0. }),
            Value::Blank | Value::Text(_) => CalcVertex::from_number(0.),
            Value::Error(e) => CalcVertex::from_error(e),
        },
        _ => CalcVertex::from_error(ast::Error::Value),
    }
}

/// T(value) — returns the text if the value is text, otherwise an empty string;
/// an error stays an error.
pub fn calc_t<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let value = match one_scalar(args, fetcher) {
        Ok(v) => v,
        Err(e) => return e,
    };
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Text(t) => CalcVertex::from_string(t),
            Value::Error(e) => CalcVertex::from_error(e),
            _ => CalcVertex::from_string(String::new()),
        },
        _ => CalcVertex::from_string(String::new()),
    }
}

/// TYPE(value) — 1 number (or blank), 2 text, 4 logical, 16 error, 64 array.
pub fn calc_type<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let value = match one_scalar(args, fetcher) {
        Ok(v) => v,
        Err(e) => return e,
    };
    let code = match value {
        CalcValue::Scalar(s) => match s {
            Value::Number(_) | Value::Blank => 1.,
            Value::Text(_) => 2.,
            Value::Boolean(_) => 4.,
            Value::Error(_) => 16.,
        },
        _ => 64.,
    };
    CalcVertex::from_number(code)
}
