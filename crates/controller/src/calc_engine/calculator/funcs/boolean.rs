use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// NOT(logical) — negate a boolean. Numbers coerce (0 => FALSE, else TRUE) and
/// a blank is FALSE; text is #VALUE!, errors propagate.
pub fn calc_not<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() != 1 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let value = fetcher.get_calc_value(args.into_iter().next().unwrap());
    let b = match value {
        CalcValue::Scalar(s) => match s {
            Value::Boolean(b) => b,
            Value::Number(n) => n != 0.,
            Value::Blank => false,
            Value::Error(e) => return CalcVertex::from_error(e),
            Value::Text(_) => return CalcVertex::from_error(ast::Error::Value),
        },
        _ => return CalcVertex::from_error(ast::Error::Value),
    };
    CalcVertex::from_bool(!b)
}

pub fn calc_true(args: Vec<CalcVertex>) -> CalcVertex {
    if args.len() > 0 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    CalcVertex::from_bool(true)
}

pub fn calc_false(args: Vec<CalcVertex>) -> CalcVertex {
    if args.len() > 0 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    CalcVertex::from_bool(false)
}
