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
