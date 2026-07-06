use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use logisheets_parser::ast;

pub fn calc_isblank<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |v: &CalcValue| -> Result<bool, ast::Error> {
        match v {
            CalcValue::Scalar(s) => match s {
                Value::Blank => Ok(true),
                _ => Ok(false),
            },
            _ => Ok(false),
        }
    };
    calc(args, fetcher, &f)
}

pub fn calc_isnumber<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |v: &CalcValue| -> Result<bool, ast::Error> {
        match v {
            CalcValue::Scalar(s) => match s {
                Value::Number(_) => Ok(true),
                _ => Ok(false),
            },
            _ => Ok(false),
        }
    };
    calc(args, fetcher, &f)
}

pub fn calc_islogical<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |v: &CalcValue| -> Result<bool, ast::Error> {
        match v {
            CalcValue::Scalar(s) => match s {
                Value::Boolean(_) => Ok(true),
                _ => Ok(false),
            },
            _ => Ok(false),
        }
    };
    calc(args, fetcher, &f)
}

pub fn calc_istext<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |v: &CalcValue| -> Result<bool, ast::Error> {
        match v {
            CalcValue::Scalar(s) => match s {
                Value::Text(_) => Ok(true),
                _ => Ok(false),
            },
            _ => Ok(false),
        }
    };
    calc(args, fetcher, &f)
}

pub fn calc_isnontext<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |v: &CalcValue| -> Result<bool, ast::Error> {
        match v {
            CalcValue::Scalar(s) => match s {
                Value::Text(_) => Ok(false),
                _ => Ok(true),
            },
            _ => Ok(true),
        }
    };
    calc(args, fetcher, &f)
}

pub fn calc_iseven<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, &|v| parity(v))
}

pub fn calc_isodd<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, &|v| parity(v).map(|even| !even))
}

/// Whether a value's (truncated) integer part is even. Numbers/blank/bools
/// coerce; text is #VALUE! and errors propagate — matching ISEVEN/ISODD.
fn parity(v: &CalcValue) -> Result<bool, ast::Error> {
    let n = match v {
        CalcValue::Scalar(s) => match s {
            Value::Number(n) => *n,
            Value::Blank => 0.,
            Value::Boolean(b) => {
                if *b {
                    1.
                } else {
                    0.
                }
            }
            Value::Text(_) => return Err(ast::Error::Value),
            Value::Error(e) => return Err(e.clone()),
        },
        _ => return Err(ast::Error::Value),
    };
    Ok((n.trunc() as i64) % 2 == 0)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, f: &F) -> CalcVertex
where
    C: Connector,
    F: Fn(&CalcValue) -> Result<bool, ast::Error>,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let first = fetcher.get_calc_value(args.into_iter().next().unwrap());
    match f(&first) {
        Ok(b) => CalcVertex::from_bool(b),
        Err(e) => CalcVertex::from_error(e),
    }
}
