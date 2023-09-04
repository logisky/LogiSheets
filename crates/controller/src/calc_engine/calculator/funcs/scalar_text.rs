use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};
use logisheets_parser::ast;

pub fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: 'static + Fn(&str) -> String,
{
    if args.len() != 1 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let arg = args.into_iter().next().unwrap();
    let value = fetcher.get_calc_value(arg);
    let v = match value {
        CalcValue::Scalar(s) => CalcValue::Scalar(call(&s, &func)),
        CalcValue::Range(r) => {
            let vec2d = r.map(move |v| call(v, &func));
            CalcValue::Range(vec2d)
        }
        CalcValue::Cube(_) => CalcValue::Scalar(Value::Error(ast::Error::Ref)),
        CalcValue::Union(u) => {
            if u.len() == 1 {
                let arg = *u.into_iter().next().unwrap();
                let v = vec![CalcVertex::Value(arg)];
                if let CalcVertex::Value(value) = calc(v, fetcher, func) {
                    value
                } else {
                    CalcValue::Scalar(Value::Error(ast::Error::Value))
                }
            } else {
                CalcValue::Scalar(Value::Error(ast::Error::Value))
            }
        }
    };
    CalcVertex::Value(v)
}

fn call<F>(value: &Value, func: &F) -> Value
where
    F: Fn(&str) -> String,
{
    match value {
        Value::Blank => Value::Text(func("")),
        Value::Number(n) => Value::Text(func(&n.to_string())),
        Value::Text(t) => Value::Text(func(t)),
        Value::Boolean(b) => {
            if *b {
                Value::Text(func("TRUE"))
            } else {
                Value::Text(func("FALSE"))
            }
        }
        Value::Error(e) => Value::Text(func(e.get_err_str())),
    }
}

pub fn calc_trim<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.trim().to_string())
}

pub fn calc_upper<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.to_uppercase().to_string())
}

pub fn calc_lower<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.to_lowercase().to_string())
}
