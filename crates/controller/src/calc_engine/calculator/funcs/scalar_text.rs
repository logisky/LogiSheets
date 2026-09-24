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
        Value::Number(n) => Value::Text(func(&super::super::number_text::number_to_text(*n))),
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

/// `TRIM(text)` — strip the ends AND collapse every internal run of spaces to
/// a single one.
///
/// Not `str::trim`, which only does the ends. Excel documents TRIM as removing
/// "all spaces from text except for single spaces between words", and that
/// second half is the whole reason the function exists rather than people
/// writing a strip: it is meant for text imported with irregular spacing.
///
/// Only the SPACE character, deliberately: Excel's TRIM leaves tabs and other
/// whitespace alone (CLEAN is the one that removes control characters), so
/// `split_whitespace` would take too much.
pub fn calc_trim<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| {
        a.split(' ')
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(" ")
    })
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

pub fn calc_proper<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // Capitalize the first letter of every word (a run of letters); everything
    // else is passed through and resets the "start of word" state.
    calc(args, fetcher, |a| {
        let mut result = String::new();
        let mut prev_alpha = false;
        for ch in a.chars() {
            if ch.is_alphabetic() {
                if prev_alpha {
                    result.extend(ch.to_lowercase());
                } else {
                    result.extend(ch.to_uppercase());
                }
                prev_alpha = true;
            } else {
                result.push(ch);
                prev_alpha = false;
            }
        }
        result
    })
}
